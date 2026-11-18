import type { Room } from "@podrida/shared";
import SocketClient from "../SocketClient";

// The connections watching the list of rooms ("lobby:subscribe"). Per connection, not per user:
// a tab on the lobby page wants it, another tab mid-game doesn't.
const subscribers = new Set<SocketClient>();

export const subscribeToLobby = (client: SocketClient) => {
  subscribers.add(client);
};

export const unsubscribeFromLobby = (client: SocketClient) => {
  subscribers.delete(client);
};

export const publishRoomUpdated = (room: Room) => {
  subscribers.forEach((client) => client.sendEvent("lobby:roomUpdated", { room }));
};

export const publishRoomRemoved = (roomId: string) => {
  subscribers.forEach((client) => client.sendEvent("lobby:roomRemoved", { roomId }));
};
