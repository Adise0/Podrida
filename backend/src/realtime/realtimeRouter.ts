import { SocketCloseCode } from "@podrida/shared";
import {
  addBotData,
  attachGameData,
  bidData,
  createRoomData,
  playCardData,
  kickPlayerData,
  joinRoomData,
  removeBotData,
  roomSettingsData,
  setBotDifficultyData,
  socketAuthData,
} from "../data/joiObjects/realtimeData";
import {
  getSocketUserChangedError,
  getTooManyConnectionsError,
} from "../data/errorObjects/realtimeErrors";
import verifySessionToken from "../server/utils/auth/verifySessionToken";
import { authenticateClient } from "./connections";
import {
  attachToGame,
  bidInGame,
  detachClient,
  endGameAsHost,
  getGameIdOfUser,
  kickPlayerAsHost,
  playInGame,
} from "./games/gameManager";
import { subscribeToLobby, unsubscribeFromLobby } from "./rooms/lobbyFeed";
import {
  addBot,
  createRoom,
  getRoomIdOfUser,
  joinRoom,
  leaveRoom,
  listRooms,
  removeBot,
  setBotDifficulty,
  startRoom,
  updateRoomSettings,
} from "./rooms/roomManager";
import SocketRouter from "./socketRouter";

// Every realtime request type, like routers/ for REST. The types and their payloads are the
// contract in realtime.ts (@podrida/shared). Handlers stay thin: the rules are in the managers.
const realtimeRouter = new SocketRouter();

// SESSION

realtimeRouter.on(
  "session:auth",
  { isPublic: true, schema: socketAuthData },
  async ({ client, payload }) => {
    let session;

    try {
      session = await verifySessionToken(payload.token);
    } catch (error) {
      // A connection that never authenticated has nothing left to do. One that did keeps its
      // current session, which still closes when it expires.
      if (!client.session) {
        setImmediate(() => client.close(SocketCloseCode.sessionEnded, "Invalid session"));
      }
      throw error;
    }

    // Both answered, then closed (setImmediate runs after the reply is sent).
    // A connection belongs to one user for good: someone else logging in opens a new one.
    if (client.session && client.session.userId !== session.userId) {
      setImmediate(() => client.close(SocketCloseCode.sessionEnded, "Session changed user"));
      throw getSocketUserChangedError();
    }

    if (!authenticateClient(client, session)) {
      setImmediate(() => client.close(SocketCloseCode.tooManyConnections, "Too many connections"));
      throw getTooManyConnectionsError();
    }

    return {
      userId: session.userId,
      roomId: getRoomIdOfUser(session.userId),
      gameId: getGameIdOfUser(session.userId),
    };
  },
);

// LOBBY

realtimeRouter.on("lobby:subscribe", {}, ({ client }) => {
  subscribeToLobby(client);
  return { rooms: listRooms() };
});

realtimeRouter.on("lobby:unsubscribe", {}, ({ client }) => {
  unsubscribeFromLobby(client);
  return null;
});

// ROOMS

realtimeRouter.on("rooms:create", { schema: createRoomData }, async ({ userId, payload }) => ({
  room: await createRoom(userId, payload.name),
}));

realtimeRouter.on("rooms:join", { schema: joinRoomData }, async ({ userId, payload }) => ({
  room: await joinRoom(userId, payload.roomId),
}));

realtimeRouter.on("rooms:leave", {}, ({ userId }) => {
  leaveRoom(userId);
  return null;
});

realtimeRouter.on("rooms:start", {}, async ({ userId }) => ({
  gameId: await startRoom(userId),
}));

// Host only, before the game starts.

realtimeRouter.on("rooms:addBot", { schema: addBotData }, ({ userId, payload }) => ({
  room: addBot(userId, payload.difficulty),
}));

realtimeRouter.on("rooms:removeBot", { schema: removeBotData }, ({ userId, payload }) => ({
  room: removeBot(userId, payload.userId),
}));

realtimeRouter.on(
  "rooms:setBotDifficulty",
  { schema: setBotDifficultyData },
  ({ userId, payload }) => ({
    room: setBotDifficulty(userId, payload.userId, payload.difficulty),
  }),
);

realtimeRouter.on("rooms:updateSettings", { schema: roomSettingsData }, ({ userId, payload }) => ({
  room: updateRoomSettings(userId, payload),
}));

// GAMES. Players can't leave a game. The rules are checked in PodridaMatch.

realtimeRouter.on("games:attach", { schema: attachGameData }, ({ client, payload }) => ({
  game: attachToGame(client, payload.gameId),
}));

realtimeRouter.on("games:detach", {}, ({ client }) => {
  detachClient(client);
  return null;
});

realtimeRouter.on("games:bid", { schema: bidData }, ({ userId, payload }) => {
  bidInGame(userId, payload.bid);
  return null;
});

realtimeRouter.on("games:play", { schema: playCardData }, ({ userId, payload }) => {
  playInGame(userId, payload.card);
  return null;
});

realtimeRouter.on("games:end", {}, async ({ userId }) => {
  await endGameAsHost(userId);
  return null;
});

realtimeRouter.on("games:kick", { schema: kickPlayerData }, async ({ userId, payload }) => {
  await kickPlayerAsHost(userId, payload.userId);
  return null;
});

export default realtimeRouter;
