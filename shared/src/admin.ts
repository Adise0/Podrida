// The admin side of the contract (everything under /admin).
import type { BotDifficulty } from "./bots";
import type { GameStatus } from "./rooms";
import type { MyUser, UserRole } from "./user";

// What an admin gets to see of a user (dates are ISO strings).
export interface AdminUser {
  id: string;
  information: MyUser["information"];
  role: UserRole;
  isDisabled: boolean;
  activatedAt?: string; // Missing while the account is pending activation.
  resetPasswordOnLogin?: boolean; // An admin forced a password reset that hasn't happened yet.
  scheduledDeletionAt?: string; // The owner deleted it, logging in before this cancels it.
  createdAt: string;
  updatedAt: string;
}

// GET /admin/users query string. search matches the start of the email or username.
export interface AdminUserListQuery {
  page?: number;
  limit?: number; // At most 100.
  search?: string;
  role?: UserRole;
  isDisabled?: boolean;
  isActivated?: boolean;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// SUPERUSER can't be granted through the API.
export interface ChangeUserRoleData {
  role: UserRole.user | UserRole.admin;
}

// GAMES

export interface AdminGamePlayer {
  userId: string;
  username: string; // As it was when the game started.
  kickedAt?: string;
  kickedBy?: string; // A user id: the host or an admin.
  takenOverBy?: BotDifficulty; // The bot that played their seat after the kick.
  bot?: { difficulty: BotDifficulty; seed: number }; // A bot (its id has no account).
  total: number; // Points so far.
  isConnected?: boolean; // Only while the game is being played.
}

// A game's record, with what's live about it while it's being played.
export interface AdminGame {
  id: string;
  roomName: string;
  hostId: string;
  players: AdminGamePlayer[];
  status: GameStatus;
  isLive: boolean; // Being played on this server right now: it can be ended and players kicked.
  startedAt: string;
  endedAt?: string;
  endedBy?: { userId: string; username: string }; // Who ended it early.
}

// GET /admin/games query string. playerId only lists the games that user sat at.
export interface AdminGameListQuery {
  page?: number;
  limit?: number; // At most 100.
  status?: GameStatus;
  playerId?: string;
}

export interface AdminGameListResponse {
  games: AdminGame[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
