// The realtime connection: one WebSocket per tab, at realtimePath on the API.
//
// Every client message is a request with an id, and the server answers every one of them with a
// reply carrying that id. The server also pushes events on its own. All of it is JSON.
//
//   client -> { id: 1, type: "rooms:join", payload: { roomId } }
//   server -> { kind: "reply", id: 1, ok: true, payload: { room } }
//   server -> { kind: "reply", id: 1, ok: false, error: ResponseError }
//   server -> { kind: "event", event: "room:updated", payload: { room } }
//
// The first request has to be "session:auth" with the session token (browsers can't put headers
// on a WebSocket, and a token in the URL ends up in logs). Send it again with every new token: the
// connection closes when the token it was opened with expires.
import type { ResponseError } from "./errors";
import type { Card } from "./podrida";
import type { Game, Room } from "./rooms";

export const realtimePath = "/ws";

// Why the server closed the connection (besides the standard 1000 and 1001).
export enum SocketCloseCode {
  normal = 1000,
  goingAway = 1001, // The server is shutting down: reconnect.
  authTimeout = 4000, // No "session:auth" in time.
  sessionEnded = 4001, // The session expired or was revoked: check it (refresh) before reconnecting.
  tooManyConnections = 4002, // Too many tabs open for one user.
  protocolError = 4003, // Something that isn't a request (broken JSON, no id...).
}

// Where the user is, so a reconnecting tab can put them back.
export interface UserLocation {
  roomId?: string;
  gameId?: string;
}

// Every request type, with its payload and the payload of its successful reply.
export interface SocketRequests {
  "session:auth": { payload: { token: string }; reply: { userId: string } & UserLocation };

  // The list of open rooms: answers all of them, then "lobby:*" events keep it up to date.
  "lobby:subscribe": { payload: undefined; reply: { rooms: Room[] } };
  "lobby:unsubscribe": { payload: undefined; reply: null };

  // A user is in one room or one game at most.
  "rooms:create": { payload: { name: string }; reply: { room: Room } };
  "rooms:join": { payload: { roomId: string }; reply: { room: Room } }; // Joining yours again is fine.
  "rooms:leave": { payload: undefined; reply: null };
  "rooms:start": { payload: undefined; reply: { gameId: string } }; // Host only.

  // Players only. A player counts as connected to the game while one of their connections is
  // attached to it (on the game page), until it detaches or closes.
  "games:attach": { payload: { gameId: string }; reply: { game: Game } };
  "games:detach": { payload: undefined; reply: null };
  // On your turn. The server checks everything, see podrida.ts for the rules.
  "games:bid": { payload: { bid: number }; reply: null };
  "games:play": { payload: { card: Card }; reply: null };
  // Host only, on their current game.
  "games:end": { payload: undefined; reply: null };
  "games:kick": { payload: { userId: string }; reply: null };
}

export type SocketRequestType = keyof SocketRequests;

// Every event the server pushes, with its payload.
export interface SocketEvents {
  // Only to lobby subscribers.
  "lobby:roomUpdated": { room: Room }; // Created or changed.
  "lobby:roomRemoved": { roomId: string }; // Emptied, or started a game.

  // To the members of the room.
  "room:updated": { room: Room };
  "room:gameStarted": { roomId: string; gameId: string };

  // To the players of the game.
  "game:updated": { game: Game }; // Each player gets their own view (their hand only).
  "game:ended": { gameId: string; status: Game["status"] };
  "game:kicked": { gameId: string }; // Only to the kicked player.
}

export type SocketEventType = keyof SocketEvents;

export interface SocketRequest<T extends SocketRequestType = SocketRequestType> {
  id: number;
  type: T;
  payload?: SocketRequests[T]["payload"];
}

export type SocketReply =
  | { kind: "reply"; id: number; ok: true; payload: unknown }
  | { kind: "reply"; id: number; ok: false; error: ResponseError };

export interface SocketEvent<T extends SocketEventType = SocketEventType> {
  kind: "event";
  event: T;
  payload: SocketEvents[T];
}

export type SocketServerMessage = SocketReply | SocketEvent;
