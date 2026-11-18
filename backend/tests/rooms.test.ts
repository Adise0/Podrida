import { GameStatus, roomLimits } from "@podrida/shared";
import Games from "../src/database/models/Games";
import { interruptStaleGames } from "../src/realtime/games/gameManager";
import { loginAs, useApi } from "./helpers/api";
import { connectAs, expectError, expectOk, type TestSocket } from "./helpers/socket";

useApi();

const open: TestSocket[] = [];

// A logged in user with an authenticated connection, closed after the test.
const player = async () => {
  const { user, token } = await loginAs();
  const socket = await connectAs(token);
  open.push(socket);
  return { user, socket };
};

afterEach(async () => {
  await Promise.all(open.splice(0).map((socket) => socket.close()));
});

const createRoom = async (socket: TestSocket, name = "Friday table") =>
  expectOk(await socket.request("rooms:create", { name })).room;

describe("lobby", () => {
  test("lists the rooms and follows them as they change", async () => {
    const watcher = await player();
    const host = await player();
    const guest = await player();

    expect(expectOk(await watcher.socket.request("lobby:subscribe")).rooms).toEqual([]);

    const room = await createRoom(host.socket);
    expect((await watcher.socket.nextEvent("lobby:roomUpdated")).room).toMatchObject({
      id: room.id,
      name: "Friday table",
      hostId: host.user.id,
      members: [
        { userId: host.user.id, username: host.user.information.username, isConnected: true },
      ],
    });

    expectOk(await guest.socket.request("rooms:join", { roomId: room.id }));
    const updated = await watcher.socket.nextEvent(
      "lobby:roomUpdated",
      (event) => event.room.members.length === 2,
    );
    expect(updated.room.members.map((member) => member.userId)).toEqual([
      host.user.id,
      guest.user.id,
    ]);

    // A new subscription gets it in the list straight away.
    const late = await player();
    expect(expectOk(await late.socket.request("lobby:subscribe")).rooms).toHaveLength(1);

    // Once empty, it's gone.
    expectOk(await host.socket.request("rooms:leave"));
    expectOk(await guest.socket.request("rooms:leave"));
    expect(await watcher.socket.nextEvent("lobby:roomRemoved")).toEqual({ roomId: room.id });

    // Unsubscribed connections hear nothing more.
    expectOk(await watcher.socket.request("lobby:unsubscribe"));
    await createRoom(host.socket, "Another one");
    await expect(
      watcher.socket.nextEvent("lobby:roomUpdated", (event) => event.room.name === "Another one"),
    ).rejects.toThrow();
  });
});

describe("rooms", () => {
  test("members hear about each other, and the host's seat passes on", async () => {
    const host = await player();
    const guest = await player();
    const room = await createRoom(host.socket);

    const joined = expectOk(await guest.socket.request("rooms:join", { roomId: room.id })).room;
    expect(joined.members).toHaveLength(2);
    expect(
      (await host.socket.nextEvent("room:updated", (event) => event.room.members.length === 2)).room
        .members[1].userId,
    ).toBe(guest.user.id);

    expectOk(await host.socket.request("rooms:leave"));
    const { room: afterLeave } = await guest.socket.nextEvent(
      "room:updated",
      (event) => event.room.members.length === 1,
    );
    expect(afterLeave.hostId).toBe(guest.user.id);
  });

  test("one room at a time, and joining your own again is fine", async () => {
    const host = await player();
    const room = await createRoom(host.socket);

    expect(expectOk(await host.socket.request("rooms:join", { roomId: room.id })).room.id).toBe(
      room.id,
    );

    const error = expectError(await host.socket.request("rooms:create", { name: "Second" }));
    expect(error.code).toBe("ALREADY_IN_ROOM");
    expect(error.details).toEqual({ roomId: room.id });

    // Nor joining someone else's.
    const otherRoom = await createRoom((await player()).socket, "Other");
    expect(
      expectError(await host.socket.request("rooms:join", { roomId: otherRoom.id })).code,
    ).toBe("ALREADY_IN_ROOM");
  });

  test("full rooms and gone rooms can't be joined", async () => {
    const host = await player();
    const room = await createRoom(host.socket);

    for (let seat = 1; seat < roomLimits.maxPlayers; seat += 1) {
      const guest = await player();
      expectOk(await guest.socket.request("rooms:join", { roomId: room.id }));
    }

    const late = await player();
    expect(expectError(await late.socket.request("rooms:join", { roomId: room.id })).code).toBe(
      "ROOM_FULL",
    );
    expect(expectError(await late.socket.request("rooms:join", { roomId: "AAAAAAAA" })).code).toBe(
      "ROOM_NOT_FOUND",
    );
    expect(expectError(await late.socket.request("rooms:leave")).code).toBe("NOT_IN_ROOM");
  });

  test("a member's other tabs follow along", async () => {
    const { user, token } = await loginAs();
    const firstTab = await connectAs(token);
    const secondTab = await connectAs(token);
    open.push(firstTab, secondTab);

    const room = await createRoom(firstTab);
    expect((await secondTab.nextEvent("room:updated")).room.id).toBe(room.id);
    expect(expectOk(await secondTab.request("session:auth", { token }))).toEqual({
      userId: user.id,
      roomId: room.id,
    });
  });
});

describe("starting a game", () => {
  test("only the host, and only with enough players", async () => {
    const host = await player();
    const guest = await player();
    const room = await createRoom(host.socket);

    expect(expectError(await host.socket.request("rooms:start")).code).toBe("NOT_ENOUGH_PLAYERS");

    expectOk(await guest.socket.request("rooms:join", { roomId: room.id }));
    expect(expectError(await guest.socket.request("rooms:start")).code).toBe("NOT_ROOM_HOST");
  });

  test("stores the game, moves the members into it and takes the room off the lobby", async () => {
    const watcher = await player();
    const host = await player();
    const guest = await player();
    const outsider = await player();
    expectOk(await watcher.socket.request("lobby:subscribe"));

    const room = await createRoom(host.socket, "Big game");
    expectOk(await guest.socket.request("rooms:join", { roomId: room.id }));

    const { gameId } = expectOk(await host.socket.request("rooms:start"));

    expect(await guest.socket.nextEvent("room:gameStarted")).toEqual({ roomId: room.id, gameId });
    expect(await watcher.socket.nextEvent("lobby:roomRemoved")).toEqual({ roomId: room.id });
    expect(expectOk(await outsider.socket.request("lobby:subscribe")).rooms).toEqual([]);

    const record = await Games.findById(gameId);
    expect(record).toMatchObject({ roomName: "Big game", status: GameStatus.inProgress });
    expect(record?.host.toString()).toBe(host.user.id);
    expect(record?.players.map((seat) => seat.user.toString())).toEqual([
      host.user.id,
      guest.user.id,
    ]);

    const { game } = expectOk(await guest.socket.request("games:attach", { gameId }));
    expect(game).toMatchObject({ id: gameId, roomName: "Big game", hostId: host.user.id });
    // Connected means at the table: the guest has the game open, the host doesn't yet.
    expect(game.players.map((seat) => [seat.userId, seat.isConnected, seat.isKicked])).toEqual([
      [host.user.id, false, false],
      [guest.user.id, true, false],
    ]);

    expect(expectError(await outsider.socket.request("games:attach", { gameId })).code).toBe(
      "NOT_IN_GAME",
    );

    // In a game: no new rooms until they leave it.
    const error = expectError(await host.socket.request("rooms:create", { name: "Next" }));
    expect(error.code).toBe("ALREADY_IN_GAME");
    expect(error.details).toEqual({ gameId });
  });

  test("players can't leave, only the host can end it", async () => {
    const host = await player();
    const guest = await player();
    const room = await createRoom(host.socket);
    expectOk(await guest.socket.request("rooms:join", { roomId: room.id }));
    const { gameId } = expectOk(await host.socket.request("rooms:start"));

    expect(expectError(await guest.socket.request("games:leave" as "games:end")).code).toBe(
      "UNKNOWN_REQUEST",
    );
    expect(expectError(await guest.socket.request("games:end")).code).toBe("NOT_GAME_HOST");

    expectOk(await host.socket.request("games:end"));
    expect(await guest.socket.nextEvent("game:ended")).toEqual({
      gameId,
      status: GameStatus.endedEarly,
    });

    const record = await Games.findById(gameId);
    expect(record?.status).toBe(GameStatus.endedEarly);
    expect(record?.endedAt).toBeInstanceOf(Date);
    expect(record?.endedBy).toMatchObject({ username: host.user.information.username });
    expect(record?.endedBy?.user.toString()).toBe(host.user.id);

    // Both are free again.
    await createRoom(guest.socket, "After");
    expect(expectError(await host.socket.request("games:attach", { gameId })).code).toBe(
      "GAME_NOT_FOUND",
    );
  });

  test("the host can kick players, not themselves", async () => {
    const host = await player();
    const guest = await player();
    const other = await player();
    const room = await createRoom(host.socket);
    expectOk(await guest.socket.request("rooms:join", { roomId: room.id }));
    expectOk(await other.socket.request("rooms:join", { roomId: room.id }));
    const { gameId } = expectOk(await host.socket.request("rooms:start"));

    expect(
      expectError(await host.socket.request("games:kick", { userId: host.user.id })).code,
    ).toBe("CANNOT_KICK_YOURSELF");
    expect(
      expectError(await guest.socket.request("games:kick", { userId: other.user.id })).code,
    ).toBe("NOT_GAME_HOST");

    expectOk(await host.socket.request("games:kick", { userId: guest.user.id }));

    expect(await guest.socket.nextEvent("game:kicked")).toEqual({ gameId });
    const { game } = await other.socket.nextEvent("game:updated", (event) =>
      event.game.players.some((seat) => seat.isKicked),
    );
    expect(game.players.map((seat) => [seat.userId, seat.isKicked])).toEqual([
      [host.user.id, false],
      [guest.user.id, true],
      [other.user.id, false],
    ]);

    const seat = (await Games.findById(gameId))?.players[1];
    expect(seat?.kickedAt).toBeInstanceOf(Date);
    expect(seat?.kickedBy?.toString()).toBe(host.user.id);

    // Out of it for good, and free to play elsewhere.
    expect(expectError(await guest.socket.request("games:attach", { gameId })).code).toBe(
      "NOT_IN_GAME",
    );
    expect(
      expectError(await host.socket.request("games:kick", { userId: guest.user.id })).code,
    ).toBe("NOT_IN_GAME");
    await createRoom(guest.socket, "Elsewhere");
  });

  test("games still running at startup are marked as interrupted", async () => {
    const { user } = await loginAs();
    const game = await Games.create({
      roomName: "Old",
      host: user.id,
      players: [{ user: user.id, username: "x" }],
      startedAt: new Date(),
      roundCount: 1,
    });

    await interruptStaleGames();

    expect((await Games.findById(game.id))?.status).toBe(GameStatus.interrupted);
  });
});
