// Every error the API can answer with carries one of these codes. They're the contract with the
// frontend: it switches on the code (never on the message, which is only a human-readable fallback),
// so once a code is in use NEVER rename or reuse it - add a new one instead.
// This file has no dependencies on purpose: it is shared as-is between the backend and the frontend.

export enum ErrorCode {
  // Generic
  INTERNAL_ERROR = "INTERNAL_ERROR",
  BAD_REQUEST = "BAD_REQUEST", // Malformed request the API couldn't even read (eg. broken JSON).
  NOT_FOUND = "NOT_FOUND", // No such endpoint.
  METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED",
  VALIDATION_FAILED = "VALIDATION_FAILED", // See "fields" for what's wrong with each field.
  TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS", // See "details.retryAfterSeconds".

  // Session
  MISSING_AUTH = "MISSING_AUTH", // No Authorization header.
  INVALID_TOKEN = "INVALID_TOKEN", // Session expired or revoked: log the user out.
  REAUTH_REQUIRED = "REAUTH_REQUIRED", // Sensitive action: send the user through the login again.
  FORBIDDEN = "FORBIDDEN", // Logged in, but the user's role isn't allowed to do this.

  // Email links (activation, cancel registration, revoke OTP, reset password...)
  INVALID_OR_EXPIRED_LINK = "INVALID_OR_EXPIRED_LINK",

  // Login. Deliberately one code for "no such account" and "wrong password", so the response
  // never tells which accounts exist.
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",

  // Account state
  USER_NOT_FOUND = "USER_NOT_FOUND",
  USER_DISABLED = "USER_DISABLED",
  ACCOUNT_NOT_ACTIVATED = "ACCOUNT_NOT_ACTIVATED",
  ACCOUNT_ALREADY_ACTIVATED = "ACCOUNT_ALREADY_ACTIVATED",
  PASSWORD_RESET_REQUIRED = "PASSWORD_RESET_REQUIRED", // An admin forced it: the emailed link is the only way in.
  AVATAR_NOT_FOUND = "AVATAR_NOT_FOUND", // The user has no avatar.

  // Registration
  DUPLICATE_KEY = "DUPLICATE_KEY", // See "fields" for which of email/username is TAKEN.
  REGISTRATION_COOLDOWN = "REGISTRATION_COOLDOWN", // See "details.retryAfterSeconds".
  ACTIVATION_EMAIL_FAILED = "ACTIVATION_EMAIL_FAILED",

  // Email change
  EMAIL_CHANGE_EMAIL_FAILED = "EMAIL_CHANGE_EMAIL_FAILED",

  // OAuth (sign in with Google, Apple...)
  OAUTH_PROVIDER_UNAVAILABLE = "OAUTH_PROVIDER_UNAVAILABLE", // Unknown provider, or not configured on this server.
  OAUTH_FAILED = "OAUTH_FAILED", // The provider refused the code, or its answer didn't check out: start over.
  OAUTH_EMAIL_NOT_VERIFIED = "OAUTH_EMAIL_NOT_VERIFIED", // The provider hasn't verified the account's email.
  OAUTH_EMAIL_IN_USE = "OAUTH_EMAIL_IN_USE", // An account already has this email: log in to it and link the provider from there.
  OAUTH_ALREADY_LINKED = "OAUTH_ALREADY_LINKED", // This provider account (or this provider) is already linked.
  OAUTH_NOT_LINKED = "OAUTH_NOT_LINKED",

  // Two-factor authentication
  TWO_FACTOR_INVALID_CODE = "TWO_FACTOR_INVALID_CODE",
  TWO_FACTOR_ALREADY_ENABLED = "TWO_FACTOR_ALREADY_ENABLED",
  TWO_FACTOR_NOT_ENABLED = "TWO_FACTOR_NOT_ENABLED",
  TWO_FACTOR_SETUP_NOT_STARTED = "TWO_FACTOR_SETUP_NOT_STARTED", // Call setup first, then enable.

  // Realtime connection
  UNKNOWN_REQUEST = "UNKNOWN_REQUEST", // No such request type.

  // Rooms and games
  ROOM_NOT_FOUND = "ROOM_NOT_FOUND", // Gone (emptied or started), or never existed.
  ROOM_FULL = "ROOM_FULL",
  ROOM_STARTING = "ROOM_STARTING", // Its game is being created: nobody can join or leave right now.
  ALREADY_IN_ROOM = "ALREADY_IN_ROOM", // Leave the current one first (see "details.roomId").
  ALREADY_IN_GAME = "ALREADY_IN_GAME", // Until the current game ends (see "details.gameId").
  NOT_IN_ROOM = "NOT_IN_ROOM",
  NOT_ROOM_HOST = "NOT_ROOM_HOST",
  NOT_ENOUGH_PLAYERS = "NOT_ENOUGH_PLAYERS",
  GAME_NOT_FOUND = "GAME_NOT_FOUND", // No such game, or it isn't running anymore.
  NOT_IN_GAME = "NOT_IN_GAME",
  NOT_GAME_HOST = "NOT_GAME_HOST",
  CANNOT_KICK_YOURSELF = "CANNOT_KICK_YOURSELF", // The host ends the game instead.
  BOT_NOT_FOUND = "BOT_NOT_FOUND", // No bot with that id in the room.
  CANNOT_KICK_BOT = "CANNOT_KICK_BOT", // Bots can't be kicked from a game: it would only hand the seat to another bot.
  WRONG_PHASE = "WRONG_PHASE", // Eg. a bid while cards are being played.
  NOT_YOUR_TURN = "NOT_YOUR_TURN",
  INVALID_BID = "INVALID_BID", // From 0 to the cards of the round.
  CARD_NOT_PLAYABLE = "CARD_NOT_PLAYABLE", // Not in the hand, or the rules don't allow it: see "details.rule".
}

// What's wrong with a single field, used in the "fields" object of an error response
// (eg. { "email": "TAKEN", "password": "TOO_SHORT" }).
export enum FieldErrorCode {
  REQUIRED = "REQUIRED",
  INVALID_TYPE = "INVALID_TYPE", // Eg. a number where a string was expected.
  INVALID_FORMAT = "INVALID_FORMAT", // Eg. not an email.
  TOO_SHORT = "TOO_SHORT",
  TOO_LONG = "TOO_LONG",
  TAKEN = "TAKEN", // Email/username already in use.
  INVALID = "INVALID", // Anything not covered above.
}

export type FieldErrors = Record<string, FieldErrorCode>;

// The body of every error response the API sends.
export interface ResponseError {
  error: true;
  status: number; // Same as the HTTP status code.
  code: ErrorCode;
  message: string;
  fields?: FieldErrors;
  details?: Record<string, unknown>;
}
