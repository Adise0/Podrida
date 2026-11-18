import {
  BotDifficulty,
  botLimits,
  cardKey,
  ErrorCode,
  GameStatus,
  PodridaPhase,
  playableCards,
  roomLimits,
  type Card,
  type Game,
  type SocketEvent,
} from "@podrida/shared";
import { botNames, pickBotName } from "../src/data/bots/botNames";
import Games from "../src/database/models/Games";
import PodridaMatch from "../src/realtime/games/PodridaMatch";
import { loginAs, useApi, wait } from "./helpers/api";
import { connectAs, expectError, expectOk, type TestSocket } from "./helpers/socket";

// Games at test speed (the bots themselves still decide in worker threads, as in production).
jest.mock("../src/data/serverConfig/server-config", () => {
  const actual = jest.requireActual("../src/data/serverConfig/server-config");
  return {
    ...actual,
    socketRateLimitBurst: 10_000,
    socketRateLimitPerSecond: 10_000,
    gameTimings: {
      dealingBaseMs: 2,
      dealingPerCardMs: 0,
      dealingMaxMs: 2,
      trickEndMs: 1,
      roundSummaryMs: 1,
    },
  };
});

useApi();

const open: TestSocket[] = [];

afterEach(async () => {
  await Promise.all(open.splice(0).map((socket) => socket.close()));
});

const player = async () => {
  const { user, token } = await loginAs();
  const socket = await connectAs(token);
  open.push(socket);
  return { user, token, socket };
};

const hostRoom = async () => {
  const host = await player();
  const { room } = expectOk(await host.socket.request("rooms:create", { name: "Bot table" }));
  return { host, room };
};

const latest = (socket: TestSocket): Game | undefined => {
  for (let index = socket.events.length - 1; index >= 0; index -= 1) {
    const event = socket.events[index] as SocketEvent<"game:updated">;
    if (event.event === "game:updated") return event.payload.game;
  }
  return undefined;
};

const latestRoomId = (socket: TestSocket) => {
  const event = [...socket.events].reverse().find((item) => item.event === "room:updated") as
    SocketEvent<"room:updated"> | undefined;
  return event?.payload.room.id ?? "";
};

const ended = (socket: TestSocket) => socket.events.some((event) => event.event === "game:ended");

describe("bot names", () => {
  test("every name fits next to (Bot)", () => {
    Object.values(botNames)
      .flat()
      .forEach((name) => expect(name.length).toBeLessThanOrEqual(botLimits.nameMaxLength));
  });

  test("its difficulty's list first, then the shared list, then numbered", () => {
    const first = (max: number) => max - max; // Always the first free name.
    const casual = botNames[BotDifficulty.casual];
    expect(pickBotName(BotDifficulty.casual, [], first)).toBe(casual[0]);
    // Taken, whatever the case, by a person or a bot.
    expect(pickBotName(BotDifficulty.casual, [casual[0].toUpperCase()], first)).toBe(casual[1]);
    expect(pickBotName(BotDifficulty.casual, casual, first)).toBe(botNames.shared[0]);
    expect(pickBotName(BotDifficulty.casual, [...casual, ...botNames.shared], first)).toBe(
      `${casual[0]} 2`,
    );
  });
});

describe("bots in rooms", () => {
  test("the host adds bots, changes their level (and name) and removes them", async () => {
    const { host, room } = await hostRoom();
    const guest = await player();
    expectOk(await guest.socket.request("rooms:join", { roomId: room.id }));

    const added = expectOk(
      await host.socket.request("rooms:addBot", { difficulty: BotDifficulty.skilled }),
    ).room;
    const bot = added.members[2];
    expect(bot).toMatchObject({ bot: { difficulty: BotDifficulty.skilled }, isConnected: true });
    expect(botNames[BotDifficulty.skilled]).toContain(bot.username);
    expect(bot.userId).toMatch(/^[0-9a-f]{24}$/);

    // The others see it.
    const seen = await guest.socket.nextEvent("room:updated", (event) =>
      event.room.members.some((member) => member.bot),
    );
    expect(seen.room.members).toHaveLength(3);

    // Only the host.
    expect(
      expectError(await guest.socket.request("rooms:addBot", { difficulty: BotDifficulty.casual }))
        .code,
    ).toBe(ErrorCode.NOT_ROOM_HOST);
    expect(
      expectError(await guest.socket.request("rooms:removeBot", { userId: bot.userId })).code,
    ).toBe(ErrorCode.NOT_ROOM_HOST);

    // A new level, a new name from its list.
    const changed = expectOk(
      await host.socket.request("rooms:setBotDifficulty", {
        userId: bot.userId,
        difficulty: BotDifficulty.expert,
      }),
    ).room.members[2];
    expect(changed).toMatchObject({
      userId: bot.userId,
      bot: { difficulty: BotDifficulty.expert },
    });
    expect(botNames[BotDifficulty.expert]).toContain(changed.username);

    // Not a person's seat.
    expect(
      expectError(await host.socket.request("rooms:removeBot", { userId: guest.user.id })).code,
    ).toBe(ErrorCode.BOT_NOT_FOUND);

    const removed = expectOk(await host.socket.request("rooms:removeBot", { userId: bot.userId }));
    expect(removed.room.members).toHaveLength(2);
  });

  test("bots count toward the limit and get names nobody else has", async () => {
    const { host } = await hostRoom();
    for (let seat = 1; seat < roomLimits.maxPlayers; seat += 1) {
      expectOk(await host.socket.request("rooms:addBot", { difficulty: BotDifficulty.lero }));
    }
    const full = expectError(
      await host.socket.request("rooms:addBot", { difficulty: BotDifficulty.lero }),
    );
    expect(full.code).toBe(ErrorCode.ROOM_FULL);

    // Nor can a person take a seat.
    const late = await player();
    const roomId = latestRoomId(host.socket);
    expect(expectError(await late.socket.request("rooms:join", { roomId })).code).toBe(
      ErrorCode.ROOM_FULL,
    );
  });

  test("names stay unique across levels, and a room with only bots left closes", async () => {
    const { host, room } = await hostRoom();
    const watcher = await player();
    expectOk(await watcher.socket.request("lobby:subscribe"));

    const names: string[] = [];
    for (let seat = 1; seat < roomLimits.maxPlayers; seat += 1) {
      const { room: updated } = expectOk(
        await host.socket.request("rooms:addBot", { difficulty: BotDifficulty.casual }),
      );
      names.push(updated.members.at(-1)!.username);
    }
    expect(new Set(names.map((name) => name.toLowerCase())).size).toBe(names.length);

    expectOk(await host.socket.request("rooms:leave"));
    const removed = await watcher.socket.nextEvent("lobby:roomRemoved");
    expect(removed.roomId).toBe(room.id);
  });

  test("the host sets the bots' thinking time, within limits", async () => {
    const { host, room } = await hostRoom();
    expect(room.settings).toEqual({ botThinkingMaxMs: 2000 });

    const updated = expectOk(
      await host.socket.request("rooms:updateSettings", { botThinkingMaxMs: 500 }),
    );
    expect(updated.room.settings.botThinkingMaxMs).toBe(500);

    const tooLong = expectError(
      await host.socket.request("rooms:updateSettings", { botThinkingMaxMs: 60_000 }),
    );
    expect(tooLong.code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  test("a person and bots make a game", async () => {
    const { host } = await hostRoom();
    expect(expectError(await host.socket.request("rooms:start")).code).toBe(
      ErrorCode.NOT_ENOUGH_PLAYERS,
    );
    expectOk(await host.socket.request("rooms:addBot", { difficulty: BotDifficulty.beginner }));
    expectOk(await host.socket.request("rooms:start"));
  });
});

describe("bots in games", () => {
  test("a person against every level of bot plays a whole game, bots stored with their seed", async () => {
    const { host } = await hostRoom();
    expectOk(await host.socket.request("rooms:updateSettings", { botThinkingMaxMs: 0 }));
    const levels = [BotDifficulty.lero, BotDifficulty.skilled, BotDifficulty.expert];
    await levels.reduce(async (previous, difficulty) => {
      await previous;
      expectOk(await host.socket.request("rooms:addBot", { difficulty }));
    }, Promise.resolve());
    const { gameId } = expectOk(await host.socket.request("rooms:start"));
    const { game } = expectOk(await host.socket.request("games:attach", { gameId }));

    expect(game.players.map((seat) => seat.bot?.difficulty)).toEqual([undefined, ...levels]);
    expect(game.players.every((seat) => seat.isConnected)).toBe(true);

    // Bots can't be kicked.
    const kickBot = expectError(
      await host.socket.request("games:kick", { userId: game.players[1].userId }),
    );
    expect(kickBot.code).toBe(ErrorCode.CANNOT_KICK_BOT);

    // The person bids 0 and plays their first playable card, the bots play themselves.
    const deadline = Date.now() + 90_000;
    for (let step = 0; Date.now() < deadline && !ended(host.socket); step += 1) {
      const state = latest(host.socket)?.state;
      if (state?.turnId === host.user.id && state.phase === PodridaPhase.bidding) {
        expectOk(await host.socket.request("games:bid", { bid: 0 }));
      } else if (state?.turnId === host.user.id && state.phase === PodridaPhase.playing) {
        const [card] = playableCards(state.hand, state.trick, state.trumpSuit);
        expectOk(await host.socket.request("games:play", { card }));
      } else {
        await wait(2);
      }
    }

    if (!ended(host.socket)) {
      const stuck = latest(host.socket)?.state;
      throw new Error(`Stuck: ${JSON.stringify({ ...stuck, history: stuck?.history.length })}`);
    }
    expect(host.socket.events.find((event) => event.event === "game:ended")?.payload).toEqual({
      gameId,
      status: GameStatus.finished,
    });
    const record = await Games.findById(gameId);
    expect(record?.rounds).toHaveLength(28);
    expect(record?.players.map((seat) => seat.bot?.difficulty)).toEqual([undefined, ...levels]);
    record?.players.slice(1).forEach((seat) => expect(seat.bot?.seed).toEqual(expect.any(Number)));
    expect(record?.settings.botThinkingMaxMs).toBe(0);
  }, 120_000);
});

describe("what a bot is told", () => {
  test("its own cards and what's public, nothing else", () => {
    const seats = ["a", "b", "c", "d"];
    const match = new PodridaMatch(seats);
    const playCard = () => {
      const userId = match.turnId as string;
      const state = match.viewFor(userId);
      const [card] = playableCards(state.hand, state.trick, state.trumpSuit);
      if (match.play(userId, card)) match.finishTrick();
    };

    // Rounds 1 and 2 in full, then round 3 (3 cards each) half played.
    for (let round = 1; round <= 3; round += 1) {
      match.beginBidding();
      seats.forEach(() => match.bid(match.turnId as string, 1));
      const plays = round < 3 ? round * seats.length : 6;
      for (let played = 0; played < plays; played += 1) playCard();
      if (round < 3) match.nextRound();
    }
    expect(match.phase).toBe(PodridaPhase.playing);

    seats.forEach((userId) => {
      const view = match.botViewFor(userId);
      const own = match.peekRound().log.hands.find((hand) => hand.userId === userId)!.cards;
      const allowed = new Set([
        ...own.map(cardKey),
        ...view.tricks.flatMap((trick) => trick.cards.map(({ card }) => cardKey(card))),
        ...view.trick.map(({ card }) => cardKey(card)),
        ...(view.trumpCard ? [cardKey(view.trumpCard)] : []),
      ]);
      // Every card anywhere in the view is one this seat has seen.
      const everyCard: Card[] = [];
      JSON.stringify(view, (key, value) => {
        if (value && typeof value === "object" && "suit" in value && "rank" in value) {
          everyCard.push(value as Card);
        }
        return value;
      });
      everyCard.forEach((card) => expect(allowed.has(cardKey(card))).toBe(true));
      expect(view.dealtHand).toEqual(own);
    });
  });

  test("a Lero seat's card isn't checked against the rules (but has to be its own)", () => {
    // Deals until one where "lero" could answer with a card the rules don't allow.
    const tryDeal = () => {
      const match = new PodridaMatch(["lero", "other"], undefined, ["lero"]);
      while (match.roundNumber < 3) {
        match.beginBidding();
        match.bid(match.turnId as string, 0);
        match.bid(match.turnId as string, 0);
        while (match.phase === PodridaPhase.playing) {
          const userId = match.turnId as string;
          const state = match.viewFor(userId);
          const [card] = playableCards(state.hand, state.trick, state.trumpSuit);
          if (match.play(userId, card)) match.finishTrick();
        }
        match.nextRound();
      }
      match.beginBidding();
      match.bid(match.turnId as string, 0);
      match.bid(match.turnId as string, 0);
      // Round 3: 3 cards each. "other" has to lead.
      if (match.turnId !== "other") return false;
      match.play("other", match.viewFor("other").hand[0]);
      const leroHand = match.viewFor("lero");
      const legal = playableCards(leroHand.hand, leroHand.trick, leroHand.trumpSuit);
      const illegal = leroHand.hand.find(
        (card) => !legal.some((ok) => cardKey(ok) === cardKey(card)),
      );
      if (!illegal) return false;

      expect(() => match.play("lero", illegal)).not.toThrow();
      return true;
    };

    if (!Array.from({ length: 200 }).some(tryDeal)) {
      throw new Error("No deal with an illegal option came up");
    }
  });
});
