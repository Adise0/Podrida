import {
  ErrorCode,
  GameStatus,
  PodridaPhase,
  playableCards,
  type Game,
  type SocketEvent,
} from "@podrida/shared";
import Games from "../src/database/models/Games";
import { getMatchForTests } from "../src/realtime/games/gameManager";
import { call, loginAs, useApi, wait } from "./helpers/api";
import { connectAs, expectError, expectOk, type TestSocket } from "./helpers/socket";

// A game at test speed.
jest.mock("../src/data/serverConfig/server-config", () => {
  const actual = jest.requireActual("../src/data/serverConfig/server-config");
  return {
    ...actual,
    // Faster than any person plays.
    socketRateLimitBurst: 10_000,
    socketRateLimitPerSecond: 10_000,
    gameTimings: {
      dealingBaseMs: 5,
      dealingPerCardMs: 0,
      dealingMaxMs: 5,
      trickEndMs: 2,
      roundSummaryMs: 2,
      automaticMoveMs: 2,
    },
  };
});

useApi();

interface Seat {
  user: { id: string; information: { username: string } };
  token: string;
  socket: TestSocket;
}

const open: TestSocket[] = [];

afterEach(async () => {
  await Promise.all(open.splice(0).map((socket) => socket.close()));
});

const seat = async (): Promise<Seat> => {
  const { user, token } = await loginAs();
  const socket = await connectAs(token);
  open.push(socket);
  return { user, token, socket };
};

// A started game with these players, the first one hosting.
const startGame = async (count: number) => {
  const seats = await Promise.all(Array.from({ length: count }, seat));
  const { room } = expectOk(await seats[0].socket.request("rooms:create", { name: "Test table" }));
  await Promise.all(
    seats.slice(1).map((player) => player.socket.request("rooms:join", { roomId: room.id })),
  );
  const { gameId } = expectOk(await seats[0].socket.request("rooms:start"));
  return { gameId, seats };
};

// The last state the server sent this connection.
const latest = (socket: TestSocket): Game | undefined => {
  for (let index = socket.events.length - 1; index >= 0; index -= 1) {
    const event = socket.events[index] as SocketEvent<"game:updated">;
    if (event.event === "game:updated") return event.payload.game;
  }
  return undefined;
};

const waitFor = async (check: () => boolean, what: string) => {
  for (let tries = 0; tries < 500; tries += 1) {
    if (check()) return;
    await wait(10);
  }
  throw new Error(`Timed out waiting for ${what}`);
};

const ended = (socket: TestSocket) => socket.events.some((event) => event.event === "game:ended");

// Every seat bids 0 and plays its first playable card on its turn, until the game ends.
const playToTheEnd = async (seats: Seat[]) => {
  for (let step = 0; step < 100_000 && !seats.every(({ socket }) => ended(socket)); step += 1) {
    let acted = false;

    for (let index = 0; index < seats.length; index += 1) {
      const { user, socket } = seats[index];
      const game = latest(socket);
      const state = game?.state;

      if (!ended(socket) && state?.turnId === user.id) {
        if (state.phase === PodridaPhase.bidding) {
          expectOk(await socket.request("games:bid", { bid: 0 }));
          acted = true;
        } else if (state.phase === PodridaPhase.playing) {
          const [card] = playableCards(state.hand, state.trick, state.trumpSuit);
          expectOk(await socket.request("games:play", { card }));
          acted = true;
        }
      }
    }

    if (!acted) await wait(3);
  }
};

describe("playing a game", () => {
  test("the players who are at the table count as connected", async () => {
    const { gameId, seats } = await startGame(2);
    const [host, guest] = seats;

    const { game } = expectOk(await host.socket.request("games:attach", { gameId }));
    expect(game.players.map((player) => player.isConnected)).toEqual([true, false]);
    expect(game.state).toMatchObject({ roundNumber: 1, cardsPerPlayer: 1, roundCount: 51 });
    expect(game.state.hand).toHaveLength(1);

    expectOk(await guest.socket.request("games:attach", { gameId }));
    await waitFor(
      () => latest(host.socket)?.players.every((player) => player.isConnected) ?? false,
      "both at the table",
    );

    expectOk(await guest.socket.request("games:detach"));
    await waitFor(
      () => latest(host.socket)?.players[1].isConnected === false,
      "the guest to show as away",
    );
  });

  test("moves are checked: phase, turn and the rules", async () => {
    const { gameId, seats } = await startGame(2);
    const match = getMatchForTests(gameId)!;

    expect(expectError(await seats[0].socket.request("games:bid", { bid: 0 })).code).toBe(
      ErrorCode.WRONG_PHASE,
    );

    await waitFor(() => match.phase === PodridaPhase.bidding, "the bidding");
    const turn = seats.find(({ user }) => user.id === match.turnId)!;
    const other = seats.find(({ user }) => user.id !== match.turnId)!;

    expect(expectError(await other.socket.request("games:bid", { bid: 0 })).code).toBe(
      ErrorCode.NOT_YOUR_TURN,
    );
    expect(expectError(await turn.socket.request("games:bid", { bid: 5 })).code).toBe(
      ErrorCode.INVALID_BID,
    );

    expectOk(await turn.socket.request("games:bid", { bid: 1 }));
    expectOk(await other.socket.request("games:bid", { bid: 1 }));

    const leader = seats.find(({ user }) => user.id === match.turnId)!;
    const notMine = match.peekHand(seats.find((s) => s !== leader)!.user.id)[0];
    const error = expectError(await leader.socket.request("games:play", { card: notMine }));
    expect(error.code).toBe(ErrorCode.CARD_NOT_PLAYABLE);
    expect(error.details).toEqual({ rule: null });
  });

  test("a full game: rounds are stored, kicked seats play themselves, and it can be looked back on", async () => {
    const { gameId, seats } = await startGame(3);
    const [host, guest, kicked] = seats;
    await Promise.all(seats.map(({ socket }) => socket.request("games:attach", { gameId })));

    // The third player is kicked early: their seat plays on its own until the end.
    expectOk(await host.socket.request("games:kick", { userId: kicked.user.id }));
    await playToTheEnd([host, guest]);

    expect(host.socket.events.find((event) => event.event === "game:ended")?.payload).toEqual({
      gameId,
      status: GameStatus.finished,
    });
    const final = latest(host.socket)!;
    expect(final.state.phase).toBe(PodridaPhase.finished);
    expect(final.state.history).toHaveLength(33);

    const record = await Games.findById(gameId);
    expect(record?.status).toBe(GameStatus.finished);
    expect(record?.rounds).toHaveLength(33);

    // Every round is stored in full: the hands as dealt, and each trick card by card.
    record?.rounds.forEach((round) => {
      expect(round.hands).toHaveLength(3);
      round.hands.forEach((hand) => expect(hand.cards).toHaveLength(round.cardsPerPlayer));
      expect(round.tricks).toHaveLength(round.cardsPerPlayer);
      const dealt = round.hands.flatMap((hand) =>
        hand.cards.map((c) => `${hand.user}-${c.rank}-${c.suit}`),
      );
      const played = round.tricks.flatMap((trick) =>
        trick.cards.map((c) => `${c.user}-${c.rank}-${c.suit}`),
      );
      expect(played.sort()).toEqual(dealt.sort());
    });
    expect(record?.players.map((player) => player.total)).toEqual(
      seats.map(({ user }) => final.state.totals[user.id]),
    );

    // Its players find it in their finished games, with the final points.
    const list = await call("GET", "/games/finished", { token: guest.token });
    expect(list.json.total).toBe(1);
    expect(list.json.games[0]).toMatchObject({ id: gameId, roomName: "Test table" });
    expect(list.json.games[0].players[2]).toMatchObject({
      userId: kicked.user.id,
      wasKicked: true,
      total: final.state.totals[kicked.user.id],
    });
    const best = Math.max(...Object.values(final.state.totals));
    expect(
      list.json.games[0].players.filter((player: { isWinner: boolean }) => player.isWinner).length,
    ).toBe(Object.values(final.state.totals).filter((total) => total === best).length);

    const details = await call("GET", `/games/finished/${gameId}`, { token: kicked.token });
    expect(details.json).toMatchObject({ id: gameId, roundCount: 33, hostId: host.user.id });
    expect(details.json.rounds[0].results).toHaveLength(3);
    expect(
      details.json.rounds.at(-1).results.map((result: { total: number }) => result.total),
    ).toEqual(seats.map(({ user }) => final.state.totals[user.id]));

    // Not to someone who didn't play it.
    const stranger = await loginAs();
    expect((await call("GET", `/games/finished/${gameId}`, { token: stranger.token })).status).toBe(
      404,
    );
    expect((await call("GET", "/games/finished", { token: stranger.token })).json.total).toBe(0);
  }, 60_000);
});
