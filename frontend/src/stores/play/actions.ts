import type { BotDifficulty, RoomSettings } from "@podrida/shared";
import { realtime } from "../../api/realtime";
import { dispatcher } from "../../flux/dispatcher";

// Rooms and games. The server sends every change as an event too (see wireRealtime), these only
// dispatch what the reply already says so the page doesn't wait for the event.

export async function createRoom(name: string) {
  const { room } = await realtime.request("rooms:create", { name });
  dispatcher.dispatch({ type: "ROOM_ENTERED", room });
  return room;
}

// Also how a page gets the room it shows: joining your own room just answers it.
export async function joinRoom(roomId: string) {
  const { room } = await realtime.request("rooms:join", { roomId });
  dispatcher.dispatch({ type: "ROOM_ENTERED", room });
  return room;
}

export async function leaveRoom() {
  await realtime.request("rooms:leave");
  dispatcher.dispatch({ type: "ROOM_LEFT" });
}

// Bots and settings: the host's, before the game starts.
export async function addBot(difficulty: BotDifficulty) {
  const { room } = await realtime.request("rooms:addBot", { difficulty });
  dispatcher.dispatch({ type: "ROOM_UPDATED", room });
}

export async function removeBot(userId: string) {
  const { room } = await realtime.request("rooms:removeBot", { userId });
  dispatcher.dispatch({ type: "ROOM_UPDATED", room });
}

export async function setBotDifficulty(userId: string, difficulty: BotDifficulty) {
  const { room } = await realtime.request("rooms:setBotDifficulty", { userId, difficulty });
  dispatcher.dispatch({ type: "ROOM_UPDATED", room });
}

export async function updateRoomSettings(settings: Partial<RoomSettings>) {
  const { room } = await realtime.request("rooms:updateSettings", settings);
  dispatcher.dispatch({ type: "ROOM_UPDATED", room });
}

export async function startGame() {
  const { gameId } = await realtime.request("rooms:start");
  dispatcher.dispatch({ type: "GAME_STARTED", gameId });
  return gameId;
}

// The game the game page has open in this tab. Only that tab counts as being at the table, so a
// reconnect re-attaches it (see wireRealtime), and leaving the page detaches it.
let attachedGameId: string | null = null;

export const getAttachedGameId = () => attachedGameId;

export async function attachGame(gameId: string) {
  attachedGameId = gameId;
  const { game } = await realtime.request("games:attach", { gameId });
  dispatcher.dispatch({ type: "GAME_ATTACHED", game });
  return game;
}

export function detachGame() {
  attachedGameId = null;
  realtime.request("games:detach").catch(() => {}); // Offline: it's detached anyway.
}

// Host only. Players can't leave a game: it ends on its own, or the host ends it early.
export async function endGame() {
  await realtime.request("games:end");
}

export async function kickPlayer(userId: string) {
  await realtime.request("games:kick", { userId });
}
