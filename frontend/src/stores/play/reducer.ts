import type { Game, GameStatus, Room } from "@podrida/shared";
import type { RealtimeStatus } from "../../api/realtime";
import type { Reducer } from "../../flux/createStore";

// Where the user sits: a room in the lobby, or a game (one or the other, or neither). The ids come
// from the server as soon as the connection is up, the details once a page asks for them.
export interface PlayState {
  status: RealtimeStatus;
  hasBeenOnline: boolean; // A drop after that is a reconnect, worth telling the user about.
  roomId: string | null;
  room: Room | null;
  gameId: string | null;
  game: Game | null;
  // The last game the user was taken out of: it ended (with its status), or they were kicked.
  // A game played to the end keeps its final state, for the final score sheet.
  endedGame: { gameId: string; reason: GameStatus | "kicked"; finalGame: Game | null } | null;
}

export type PlayAction =
  | { type: "REALTIME_STATUS_CHANGED"; status: RealtimeStatus }
  | { type: "REALTIME_LOCATED"; roomId: string | null; gameId: string | null }
  | { type: "ROOM_ENTERED"; room: Room }
  | { type: "ROOM_UPDATED"; room: Room }
  | { type: "ROOM_LEFT" }
  | { type: "GAME_STARTED"; gameId: string }
  | { type: "GAME_ATTACHED"; game: Game }
  | { type: "GAME_UPDATED"; game: Game }
  | { type: "GAME_KICKED"; gameId: string }
  | { type: "GAME_ENDED"; gameId: string; status: GameStatus };

export const initialPlayState: PlayState = {
  status: "offline",
  hasBeenOnline: false,
  roomId: null,
  room: null,
  gameId: null,
  game: null,
  endedGame: null,
};

const seatless = { roomId: null, room: null, gameId: null, game: null };

export const playReducer: Reducer<PlayState> = (state, action) => {
  switch (action.type) {
    case "REALTIME_STATUS_CHANGED":
      return {
        ...state,
        status: action.status,
        hasBeenOnline: state.hasBeenOnline || action.status === "online",
      };

    // The server's word on where the user is, after every (re)connect. Details that no longer
    // match are dropped, the pages fetch them again.
    case "REALTIME_LOCATED":
      return {
        ...state,
        roomId: action.roomId,
        room: state.room?.id === action.roomId ? state.room : null,
        gameId: action.gameId,
        game: state.game?.id === action.gameId ? state.game : null,
      };

    case "ROOM_ENTERED":
      return { ...state, ...seatless, roomId: action.room.id, room: action.room, endedGame: null };

    case "ROOM_UPDATED":
      return action.room.id === state.roomId ? { ...state, room: action.room } : state;

    case "ROOM_LEFT":
      return { ...state, roomId: null, room: null };

    case "GAME_STARTED":
      return { ...state, ...seatless, gameId: action.gameId, endedGame: null };

    case "GAME_ATTACHED":
    case "GAME_UPDATED":
      return action.game.id === state.gameId ? { ...state, game: action.game } : state;

    case "GAME_KICKED":
      return action.gameId === state.gameId
        ? {
            ...state,
            gameId: null,
            game: null,
            endedGame: { gameId: action.gameId, reason: "kicked", finalGame: null },
          }
        : state;

    case "GAME_ENDED":
      return action.gameId === state.gameId
        ? {
            ...state,
            gameId: null,
            game: null,
            endedGame: { gameId: action.gameId, reason: action.status, finalGame: state.game },
          }
        : state;

    case "SESSION_STARTED":
    case "SESSION_ENDED":
      return initialPlayState;

    default:
      return state;
  }
};
