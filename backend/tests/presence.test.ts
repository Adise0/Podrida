import { GameStatus } from "@podrida/shared";
import Games from "../src/database/models/Games";
import { loginAs, useApi, wait } from "./helpers/api";
import { connectAs, expectOk } from "./helpers/socket";

// The grace periods, short enough to test.
jest.mock("../src/data/serverConfig/server-config", () => ({
  ...jest.requireActual("../src/data/serverConfig/server-config"),
  roomReconnectGraceInSeconds: 0.3,
  gameAbandonAfterSeconds: 0.3,
}));

useApi();

describe("a member whose connections drop", () => {
  test("keeps their seat if they come back in time", async () => {
    const host = await loginAs();
    const guest = await loginAs();
    const hostSocket = await connectAs(host.token);
    let guestSocket = await connectAs(guest.token);

    const { room } = expectOk(await hostSocket.request("rooms:create", { name: "Reload" }));
    expectOk(await guestSocket.request("rooms:join", { roomId: room.id }));

    await guestSocket.close();
    const { room: away } = await hostSocket.nextEvent("room:updated", (event) =>
      event.room.members.some((member) => !member.isConnected),
    );
    expect(away.members[1]).toMatchObject({ userId: guest.user.id, isConnected: false });

    guestSocket = await connectAs(guest.token);
    expect(expectOk(await guestSocket.request("session:auth", { token: guest.token })).roomId).toBe(
      room.id,
    );
    await hostSocket.nextEvent("room:updated", (event) =>
      event.room.members.every((member) => member.isConnected),
    );

    await wait(500);
    expect(
      expectOk(await guestSocket.request("rooms:join", { roomId: room.id })).room.members,
    ).toHaveLength(2);

    await Promise.all([hostSocket.close(), guestSocket.close()]);
  });

  test("loses it if they don't, and the host's seat passes on", async () => {
    const host = await loginAs();
    const guest = await loginAs();
    const hostSocket = await connectAs(host.token);
    const guestSocket = await connectAs(guest.token);

    const { room } = expectOk(await hostSocket.request("rooms:create", { name: "Gone" }));
    expectOk(await guestSocket.request("rooms:join", { roomId: room.id }));

    await hostSocket.close();
    const { room: after } = await guestSocket.nextEvent(
      "room:updated",
      (event) => event.room.members.length === 1,
    );
    expect(after.hostId).toBe(guest.user.id);

    await guestSocket.close();
  });
});

test("a game nobody is connected to is abandoned", async () => {
  const host = await loginAs();
  const guest = await loginAs();
  const hostSocket = await connectAs(host.token);
  const guestSocket = await connectAs(guest.token);

  const { room } = expectOk(await hostSocket.request("rooms:create", { name: "Ghosts" }));
  expectOk(await guestSocket.request("rooms:join", { roomId: room.id }));
  const { gameId } = expectOk(await hostSocket.request("rooms:start"));

  await Promise.all([hostSocket.close(), guestSocket.close()]);
  await wait(700);

  expect((await Games.findById(gameId))?.status).toBe(GameStatus.abandoned);
});
