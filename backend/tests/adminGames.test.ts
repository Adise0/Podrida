import { GameStatus } from "@podrida/shared";
import Games from "../src/database/models/Games";
import { call, loginAs, useApi } from "./helpers/api";
import { connectAs, expectOk, type TestSocket } from "./helpers/socket";

useApi();

const open: TestSocket[] = [];

afterEach(async () => {
  await Promise.all(open.splice(0).map((socket) => socket.close()));
});

const player = async () => {
  const { user, token } = await loginAs();
  const socket = await connectAs(token);
  open.push(socket);
  return { user, socket };
};

// A live game with a host and two more players.
const startGame = async () => {
  const host = await player();
  const guest = await player();
  const other = await player();
  const { room } = expectOk(await host.socket.request("rooms:create", { name: "Watched" }));
  expectOk(await guest.socket.request("rooms:join", { roomId: room.id }));
  expectOk(await other.socket.request("rooms:join", { roomId: room.id }));
  const { gameId } = expectOk(await host.socket.request("rooms:start"));
  return { gameId, host, guest, other };
};

const gameUrl = (gameId: string, action = "") => `/admin/games/${gameId}${action}`;

describe("admin games", () => {
  test("are only for admins", async () => {
    const { token } = await loginAs();

    expect((await call("GET", "/admin/games", { token })).status).toBe(403);
  });

  test("lists games newest first, filtered by status or player, with who's connected", async () => {
    const { token } = await loginAs({ role: "ADMIN" });
    const { gameId, host } = await startGame();
    expectOk(await host.socket.request("games:attach", { gameId }));
    const oldOne = await Games.create({
      roomName: "Old",
      host: host.user.id,
      players: [{ user: host.user.id, username: "x" }],
      status: GameStatus.finished,
      startedAt: new Date(Date.now() - 60_000),
      roundCount: 1,
    });

    const { json } = await call("GET", "/admin/games", { token });
    expect(json).toMatchObject({ total: 2, page: 1, totalPages: 1 });
    expect(json.games.map((game: { id: string }) => game.id)).toEqual([gameId, oldOne.id]);
    expect(json.games[0]).toMatchObject({
      roomName: "Watched",
      hostId: host.user.id,
      status: GameStatus.inProgress,
      isLive: true,
    });
    expect(json.games[0].players[0]).toMatchObject({ userId: host.user.id, isConnected: true });
    expect(json.games[1]).toMatchObject({ isLive: false });
    expect(json.games[1].players[0].isConnected).toBeUndefined();

    const finished = await call("GET", "/admin/games?status=FINISHED", { token });
    expect(finished.json.games.map((game: { id: string }) => game.id)).toEqual([oldOne.id]);

    const stranger = await loginAs();
    const byPlayer = await call("GET", `/admin/games?playerId=${stranger.user.id}`, { token });
    expect(byPlayer.json.total).toBe(0);

    expect((await call("GET", "/admin/games?status=NOPE", { token })).status).toBe(400);
  });

  test("one game, by id", async () => {
    const { token } = await loginAs({ role: "ADMIN" });
    const { gameId } = await startGame();

    expect((await call("GET", gameUrl(gameId), { token })).json.id).toBe(gameId);
    expect((await call("GET", gameUrl("0123456789abcdef01234567"), { token })).status).toBe(404);
    expect((await call("GET", gameUrl("nope"), { token })).status).toBe(400);
  });

  test("can force-end a live game", async () => {
    const { user: admin, token } = await loginAs({ role: "ADMIN" });
    const { gameId, guest } = await startGame();

    const { status, json } = await call("POST", gameUrl(gameId, "/end"), { token });

    expect(status).toBe(200);
    expect(json).toMatchObject({
      status: GameStatus.endedEarly,
      isLive: false,
      endedBy: { userId: admin.id, username: admin.information.username },
    });
    expect(await guest.socket.nextEvent("game:ended")).toEqual({
      gameId,
      status: GameStatus.endedEarly,
    });

    // Not live anymore: nothing left to end.
    expect((await call("POST", gameUrl(gameId, "/end"), { token })).json.code).toBe(
      "GAME_NOT_FOUND",
    );
  });

  test("can kick anyone, the host included, and the seat passes on", async () => {
    const { user: admin, token } = await loginAs({ role: "ADMIN" });
    const { gameId, host, guest, other } = await startGame();

    const { json } = await call("POST", gameUrl(gameId, `/players/${host.user.id}/kick`), {
      token,
    });

    expect(json.hostId).toBe(guest.user.id);
    expect(json.players[0]).toMatchObject({ userId: host.user.id, kickedBy: admin.id });
    expect(json.players[0].kickedAt).toEqual(expect.any(String));
    expect(await host.socket.nextEvent("game:kicked")).toEqual({ gameId });
    expect(
      (await other.socket.nextEvent("game:updated", (event) => event.game.hostId === guest.user.id))
        .game.hostId,
    ).toBe(guest.user.id);

    // The new host has the controls.
    expectOk(await guest.socket.request("games:kick", { userId: other.user.id }));

    // Kicking the last one left ends the game.
    await call("POST", gameUrl(gameId, `/players/${guest.user.id}/kick`), { token });
    const record = await Games.findById(gameId);
    expect(record?.status).toBe(GameStatus.endedEarly);
    expect(record?.endedBy?.user.toString()).toBe(admin.id);
  });

  test("can't kick someone who isn't in the game", async () => {
    const { token } = await loginAs({ role: "ADMIN" });
    const stranger = await loginAs();
    const { gameId } = await startGame();

    const { status, json } = await call(
      "POST",
      gameUrl(gameId, `/players/${stranger.user.id}/kick`),
      { token },
    );

    expect(status).toBe(409);
    expect(json.code).toBe("NOT_IN_GAME");
  });
});
