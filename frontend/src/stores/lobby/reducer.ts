import type { Room } from "@podrida/shared";
import type { Reducer } from "../../flux/createStore";

// The open rooms, while the lobby page watches them.
export interface LobbyState {
  rooms: Room[]; // Newest first.
  status: "idle" | "loading" | "loaded" | "error";
  error: unknown;
}

export type LobbyAction =
  | { type: "LOBBY_LOADING" }
  | { type: "LOBBY_LOADED"; rooms: Room[] }
  | { type: "LOBBY_LOAD_FAILED"; error: unknown }
  | { type: "LOBBY_ROOM_UPDATED"; room: Room }
  | { type: "LOBBY_ROOM_REMOVED"; roomId: string }
  | { type: "LOBBY_CLOSED" };

export const initialLobbyState: LobbyState = { rooms: [], status: "idle", error: null };

export const lobbyReducer: Reducer<LobbyState> = (state, action) => {
  switch (action.type) {
    case "LOBBY_LOADING":
      // A reload (after a reconnect) keeps the list on screen.
      return { ...state, status: state.status === "loaded" ? "loaded" : "loading", error: null };

    case "LOBBY_LOADED":
      return { rooms: action.rooms, status: "loaded", error: null };

    case "LOBBY_LOAD_FAILED":
      return { ...state, status: "error", error: action.error };

    case "LOBBY_ROOM_UPDATED": {
      const exists = state.rooms.some((room) => room.id === action.room.id);
      const rooms = exists
        ? state.rooms.map((room) => (room.id === action.room.id ? action.room : room))
        : [action.room, ...state.rooms];
      return { ...state, rooms };
    }

    case "LOBBY_ROOM_REMOVED":
      return { ...state, rooms: state.rooms.filter((room) => room.id !== action.roomId) };

    case "LOBBY_CLOSED":
    case "SESSION_STARTED":
    case "SESSION_ENDED":
      return initialLobbyState;

    default:
      return state;
  }
};
