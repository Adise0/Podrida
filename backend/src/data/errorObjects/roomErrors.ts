import { ErrorSeverity } from "../../types/errorTypes/ServerError";
import { ErrorCode } from "../../types/errorTypes/ErrorCode";
import ControlledError from "./ControlledError";

const roomError = (
  code: ErrorCode,
  statusCode: number,
  messageToSend: string,
  details?: Record<string, unknown>,
) =>
  new ControlledError({
    code,
    message: messageToSend,
    statusCode,
    messageToSend,
    severity: ErrorSeverity.low,
    details,
  });

export const getRoomNotFoundError = () =>
  roomError(ErrorCode.ROOM_NOT_FOUND, 404, "This room doesn't exist anymore");

export const getRoomFullError = () => roomError(ErrorCode.ROOM_FULL, 409, "This room is full");

export const getRoomStartingError = () =>
  roomError(ErrorCode.ROOM_STARTING, 409, "This room's game is starting");

export const getAlreadyInRoomError = (roomId: string) =>
  roomError(ErrorCode.ALREADY_IN_ROOM, 409, "You're already in a room, leave it first", { roomId });

export const getAlreadyInGameError = (gameId: string) =>
  roomError(ErrorCode.ALREADY_IN_GAME, 409, "You're in a game, wait for it to end", { gameId });

export const getNotInRoomError = () =>
  roomError(ErrorCode.NOT_IN_ROOM, 409, "You're not in a room");

export const getNotRoomHostError = () =>
  roomError(ErrorCode.NOT_ROOM_HOST, 403, "Only the host can do that");

export const getNotEnoughPlayersError = (minPlayers: number) =>
  roomError(ErrorCode.NOT_ENOUGH_PLAYERS, 409, `A game needs at least ${minPlayers} players`, {
    minPlayers,
  });

export const getGameNotFoundError = () =>
  roomError(ErrorCode.GAME_NOT_FOUND, 404, "This game isn't running");

export const getNotInGameError = () =>
  roomError(ErrorCode.NOT_IN_GAME, 403, "You're not playing in this game");

export const getNotGameHostError = () =>
  roomError(ErrorCode.NOT_GAME_HOST, 403, "Only the host can do that");

export const getCannotKickYourselfError = () =>
  roomError(ErrorCode.CANNOT_KICK_YOURSELF, 409, "You can't kick yourself, end the game instead");

// The target of a kick, unlike getNotInGameError which is about whoever is asking.
export const getPlayerNotInGameError = () =>
  roomError(ErrorCode.NOT_IN_GAME, 409, "That player isn't in this game");

// No record at all, unlike getGameNotFoundError which is about a game not being played.
export const getGameRecordNotFoundError = () =>
  roomError(ErrorCode.GAME_NOT_FOUND, 404, "Game not found");
