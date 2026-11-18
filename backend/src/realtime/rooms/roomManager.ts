import { randomBytes, randomInt } from "node:crypto";
import {
  defaultRoomSettings,
  roomLimits,
  type BotDifficulty,
  type Room,
  type RoomSettings,
} from "@podrida/shared";
import { Types } from "mongoose";
import { pickBotName } from "../../data/bots/botNames";
import { roomReconnectGraceInSeconds } from "../../data/serverConfig/server-config";
import {
  getAlreadyInGameError,
  getBotNotFoundError,
  getAlreadyInRoomError,
  getNotEnoughPlayersError,
  getNotInRoomError,
  getNotRoomHostError,
  getRoomFullError,
  getRoomNotFoundError,
  getRoomStartingError,
} from "../../data/errorObjects/roomErrors";
import { getUserNotFoundForIdError } from "../../data/errorObjects/userErrors";
import Users from "../../database/models/Users";
import { liveCounts } from "../../server/utils/metrics";
import { getAvatarUrl } from "../../server/utils/users/avatar";
import { isUserConnected, onUserConnected, onUserDisconnected, sendToUsers } from "../connections";
import { createGame, getGameIdOfUser } from "../games/gameManager";
import { publishRoomRemoved, publishRoomUpdated } from "./lobbyFeed";

// The rooms of the lobby. They only live here, in memory: they change all the time, and nothing
// about them is worth keeping until one starts a game (which is then stored, see gameManager).
// The catch is they're per server process: running several needs a shared store (eg. Redis).
//
// Every operation does its awaits first and then checks and changes the state in one go, with no
// await in between, so two requests (two tabs of one user, say) can't both pass the same check.
//
// The host can add bots (computer players) before the game starts: they take a seat like anyone,
// with a name from their difficulty's list (data/bots), and are never the host. A room with no
// person left in it closes, its bots with it.

interface LiveMember {
  userId: string; // A bot's is its own id (an ObjectId, no account).
  username: string;
  avatarUrl?: string;
  joinedAt: Date;
  bot?: { difficulty: BotDifficulty };
  removalTimer?: NodeJS.Timeout; // While all their connections are down.
}

interface LiveRoom {
  id: string;
  name: string;
  hostId: string;
  members: Map<string, LiveMember>; // In the order they joined.
  settings: RoomSettings;
  createdAt: Date;
  isStarting: boolean; // Its game is being stored: nobody joins or leaves meanwhile.
}

const rooms = new Map<string, LiveRoom>();
const roomIdByUser = new Map<string, string>();

liveCounts.rooms = () => rooms.size;

// 8 URL-safe characters: short enough to share, too many to guess (2^48).
const newRoomId = () => {
  let id: string;

  do {
    id = randomBytes(6).toString("base64url");
  } while (rooms.has(id));

  return id;
};

const toRoom = (room: LiveRoom): Room => ({
  id: room.id,
  name: room.name,
  hostId: room.hostId,
  members: [...room.members.values()].map((member) => ({
    userId: member.userId,
    username: member.username,
    avatarUrl: member.avatarUrl,
    joinedAt: member.joinedAt.toISOString(),
    isConnected: member.bot ? true : isUserConnected(member.userId),
    ...(member.bot && { bot: { difficulty: member.bot.difficulty } }),
  })),
  settings: { ...room.settings },
  createdAt: room.createdAt.toISOString(),
});

// Tells the members and the lobby. Answers what it sent, for the caller's reply.
const publishRoom = (room: LiveRoom): Room => {
  const view = toRoom(room);
  const people = [...room.members.values()].filter((member) => !member.bot);
  sendToUsers(
    people.map((member) => member.userId),
    "room:updated",
    { room: view },
  );
  publishRoomUpdated(view);
  return view;
};

// Read when they join, so the room shows the name and avatar they have now.
const getMemberProfile = async (userId: string) => {
  const user = await Users.findById(userId).select("information.username avatar");

  if (!user) {
    throw getUserNotFoundForIdError(userId);
  }

  return { username: user.information.username, avatarUrl: getAvatarUrl(user.id, user.avatar) };
};

// One room or one game at a time.
const assertIsFree = (userId: string) => {
  const gameId = getGameIdOfUser(userId);

  if (gameId) {
    throw getAlreadyInGameError(gameId);
  }

  const roomId = roomIdByUser.get(userId);

  if (roomId) {
    throw getAlreadyInRoomError(roomId);
  }
};

const addMember = (
  room: LiveRoom,
  userId: string,
  profile: { username: string; avatarUrl?: string },
) => {
  room.members.set(userId, { userId, ...profile, joinedAt: new Date() });
  roomIdByUser.set(userId, room.id);
};

const removeMember = (roomId: string, userId: string) => {
  const room = rooms.get(roomId);

  if (!room) {
    return;
  }

  clearTimeout(room.members.get(userId)?.removalTimer);
  room.members.delete(userId);
  roomIdByUser.delete(userId);

  const people = [...room.members.values()].filter((member) => !member.bot);

  // Bots don't keep a room open on their own.
  if (people.length === 0) {
    rooms.delete(room.id);
    publishRoomRemoved(room.id);
    return;
  }

  // The seat passes to the person who has been there the longest.
  if (room.hostId === userId) {
    room.hostId = people[0].userId;
  }

  publishRoom(room);
};

const getRoomOfUser = (userId: string) => {
  const roomId = roomIdByUser.get(userId);
  const room = roomId ? rooms.get(roomId) : undefined;

  if (!room) {
    throw getNotInRoomError();
  }

  return room;
};

// The user's room, for something only its host can do before the game starts.
const getHostedRoom = (userId: string) => {
  const room = getRoomOfUser(userId);

  if (room.hostId !== userId) {
    throw getNotRoomHostError();
  }

  if (room.isStarting) {
    throw getRoomStartingError();
  }

  return room;
};

const getBot = (room: LiveRoom, botId: string) => {
  const member = room.members.get(botId);

  if (!member?.bot) {
    throw getBotNotFoundError();
  }

  return member;
};

const takenNames = (room: LiveRoom, except?: string) =>
  [...room.members.values()]
    .filter((member) => member.userId !== except)
    .map((member) => member.username);

export const getRoomIdOfUser = (userId: string) => roomIdByUser.get(userId);

// Newest first.
export const listRooms = (): Room[] =>
  [...rooms.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(toRoom);

export const createRoom = async (userId: string, name: string): Promise<Room> => {
  const profile = await getMemberProfile(userId);

  assertIsFree(userId);

  const room: LiveRoom = {
    id: newRoomId(),
    name,
    hostId: userId,
    members: new Map(),
    settings: { ...defaultRoomSettings },
    createdAt: new Date(),
    isStarting: false,
  };

  rooms.set(room.id, room);
  addMember(room, userId, profile);
  return publishRoom(room);
};

export const joinRoom = async (userId: string, roomId: string): Promise<Room> => {
  const profile = await getMemberProfile(userId);
  const room = rooms.get(roomId);

  if (!room) {
    throw getRoomNotFoundError();
  }

  // Already in it (eg. opened the room's link again): nothing to do.
  if (room.members.has(userId)) {
    return toRoom(room);
  }

  assertIsFree(userId);

  if (room.isStarting) {
    throw getRoomStartingError();
  }

  if (room.members.size >= roomLimits.maxPlayers) {
    throw getRoomFullError();
  }

  addMember(room, userId, profile);
  return publishRoom(room);
};

export const leaveRoom = (userId: string) => {
  const room = getRoomOfUser(userId);

  if (room.isStarting) {
    throw getRoomStartingError();
  }

  removeMember(room.id, userId);
};

// A bot takes the next seat, with a free name from its difficulty's list.
export const addBot = (userId: string, difficulty: BotDifficulty): Room => {
  const room = getHostedRoom(userId);

  if (room.members.size >= roomLimits.maxPlayers) {
    throw getRoomFullError();
  }

  const id = new Types.ObjectId().toHexString();
  room.members.set(id, {
    userId: id,
    username: pickBotName(difficulty, takenNames(room), randomInt),
    joinedAt: new Date(),
    bot: { difficulty },
  });
  return publishRoom(room);
};

export const removeBot = (userId: string, botId: string): Room => {
  const room = getHostedRoom(userId);
  getBot(room, botId);
  room.members.delete(botId);
  return publishRoom(room);
};

// A new difficulty comes with a new name, from that difficulty's list.
export const setBotDifficulty = (
  userId: string,
  botId: string,
  difficulty: BotDifficulty,
): Room => {
  const room = getHostedRoom(userId);
  const bot = getBot(room, botId);

  if (bot.bot?.difficulty !== difficulty) {
    bot.bot = { difficulty };
    bot.username = pickBotName(difficulty, takenNames(room, botId), randomInt);
  }

  return publishRoom(room);
};

export const updateRoomSettings = (userId: string, settings: Partial<RoomSettings>): Room => {
  const room = getHostedRoom(userId);
  room.settings = { ...room.settings, ...settings };
  return publishRoom(room);
};

// The room becomes a game: it's stored, its members become the players, and it leaves the lobby.
export const startRoom = async (userId: string): Promise<string> => {
  const room = getRoomOfUser(userId);

  if (room.hostId !== userId) {
    throw getNotRoomHostError();
  }

  if (room.isStarting) {
    throw getRoomStartingError();
  }

  if (room.members.size < roomLimits.minPlayers) {
    throw getNotEnoughPlayersError(roomLimits.minPlayers);
  }

  // From here until the game exists, nobody can join or leave, so the members stay the same.
  room.isStarting = true;
  const members = [...room.members.values()];
  let gameId: string;

  try {
    gameId = await createGame({
      roomName: room.name,
      hostId: room.hostId,
      players: members.map(({ userId: id, username, avatarUrl, bot }) => ({
        userId: id,
        username,
        avatarUrl,
        ...(bot && { bot }),
      })),
      settings: room.settings,
    });
  } catch (error) {
    room.isStarting = false;
    throw error;
  }

  members.forEach((member) => {
    clearTimeout(member.removalTimer);
    roomIdByUser.delete(member.userId);
  });
  rooms.delete(room.id);
  publishRoomRemoved(room.id);
  sendToUsers(
    members.filter((member) => !member.bot).map((member) => member.userId),
    "room:gameStarted",
    { roomId: room.id, gameId },
  );

  return gameId;
};

// A member whose connections all dropped keeps their seat for roomReconnectGraceInSeconds.
onUserDisconnected((userId) => {
  const roomId = roomIdByUser.get(userId);
  const room = roomId ? rooms.get(roomId) : undefined;
  const member = room?.members.get(userId);

  if (!room || !member) {
    return;
  }

  member.removalTimer = setTimeout(() => {
    // A starting room is about to become a game, which deals with presence on its own.
    if (!room.isStarting && room.members.get(userId) === member) {
      removeMember(room.id, userId);
    }
  }, roomReconnectGraceInSeconds * 1000);
  member.removalTimer.unref();

  publishRoom(room);
});

onUserConnected((userId) => {
  const roomId = roomIdByUser.get(userId);
  const room = roomId ? rooms.get(roomId) : undefined;
  const member = room?.members.get(userId);

  if (!room || !member) {
    return;
  }

  clearTimeout(member.removalTimer);
  member.removalTimer = undefined;
  publishRoom(room);
});

// Tests only: forgets every room.
export const resetRooms = () => {
  rooms.forEach((room) => room.members.forEach((member) => clearTimeout(member.removalTimer)));
  rooms.clear();
  roomIdByUser.clear();
};
