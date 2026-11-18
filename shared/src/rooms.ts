// Rooms (the tables in the lobby, before a game starts) and games (what a room becomes once it
// starts). Both are sent over the realtime connection, see realtime.ts.
import type { BotDifficulty, RoomSettings } from "./bots";
import { podridaLimits, type PodridaRoundRecord, type PodridaState } from "./podrida";

export const roomLimits = <const>{
  nameMinLength: 1,
  nameMaxLength: 32,
  minPlayers: podridaLimits.minPlayers, // To start a game.
  maxPlayers: podridaLimits.maxPlayers,
};

export interface RoomMember {
  userId: string;
  username: string;
  avatarUrl?: string; // Same as MyUser.avatarUrl: a path on the API.
  joinedAt: string;
  // False while every connection of theirs is down. They're dropped from the room if they don't
  // come back in time (a page reload is fine). Bots are always connected.
  isConnected: boolean;
  bot?: { difficulty: BotDifficulty }; // A computer player, added by the host. Its userId is its own.
}

// A room lives in the server's memory only, it isn't stored until it starts a game.
export interface Room {
  id: string;
  name: string;
  hostId: string; // Starts the game. Passes to the longest-seated member when the host leaves.
  members: RoomMember[]; // In the order they joined. Bots count toward the limit.
  settings: RoomSettings;
  createdAt: string;
}

// Players can't leave a game: it runs until it ends on its own, or the host (or an admin) ends it.
export enum GameStatus {
  inProgress = "IN_PROGRESS",
  finished = "FINISHED", // Played to the end.
  endedEarly = "ENDED_EARLY", // By the host, or by an admin.
  abandoned = "ABANDONED", // No player was connected for too long.
  interrupted = "INTERRUPTED", // The server restarted mid-game.
}

export interface GamePlayer {
  userId: string;
  username: string;
  avatarUrl?: string;
  isConnected: boolean;
  isKicked: boolean; // Removed by the host or an admin. Their seat stays, played by a bot.
  bot?: { difficulty: BotDifficulty }; // A computer player from the start (not a kicked seat).
}

// The game as it's being played. Its record is stored from the start, the play itself runs live.
export interface Game {
  id: string;
  roomName: string;
  hostId: string; // Can end the game and kick players. Passes on if an admin kicks the host.
  players: GamePlayer[];
  status: GameStatus;
  startedAt: string;
  state: PodridaState; // As this player sees it.
}

// A game that was played to the end, as its players can look back on it (REST, /games/finished).
export interface FinishedGamePlayer {
  userId: string;
  username: string;
  avatarUrl?: string;
  total: number;
  isWinner: boolean; // Highest total. Ties share the win.
  wasKicked: boolean;
  bot?: { difficulty: BotDifficulty };
}

export interface FinishedGameSummary {
  id: string;
  roomName: string;
  startedAt: string;
  endedAt: string;
  players: FinishedGamePlayer[]; // In seat order.
}

export interface FinishedGameListResponse {
  games: FinishedGameSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface FinishedGameDetails extends FinishedGameSummary {
  hostId: string;
  roundCount: number;
  rounds: PodridaRoundRecord[];
}
