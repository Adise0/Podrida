import { randomBytes } from "node:crypto";
import { roomLimits, type Room } from "@podrida/shared";
import { roomReconnectGraceInSeconds } from "../../data/serverConfig/server-config";
import {
  getAlreadyInGameError,
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

interface LiveMember {
  userId: string;
  username: string;
  avatarUrl?: string;
  joinedAt: Date;
  removalTimer?: NodeJS.Timeout; // While all their connections are down.
}

interface LiveRoom {
  id: string;
  name: string;
  hostId: string;
  members: Map<string, LiveMember>; // In the order they joined.
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
    isConnected: isUserConnected(member.userId),
  })),
  createdAt: room.createdAt.toISOString(),
});

// Tells the members and the lobby. Answers what it sent, for the caller's reply.
const publishRoom = (room: LiveRoom): Room => {
  const view = toRoom(room);
  sendToUsers(room.members.keys(), "room:updated", { room: view });
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

  if (room.members.size === 0) {
    rooms.delete(room.id);
    publishRoomRemoved(room.id);
    return;
  }

  // The seat passes to whoever has been there the longest.
  if (room.hostId === userId) {
    room.hostId = room.members.keys().next().value as string;
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
      players: members.map(({ userId: id, username, avatarUrl }) => ({
        userId: id,
        username,
        avatarUrl,
      })),
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
    members.map((member) => member.userId),
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
