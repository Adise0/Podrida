import { ErrorSeverity } from "../../types/errorTypes/ServerError";
import { ErrorCode } from "../../types/errorTypes/ErrorCode";
import ControlledError from "./ControlledError";

export const getUnknownRequestError = (type: string) =>
  new ControlledError({
    code: ErrorCode.UNKNOWN_REQUEST,
    message: "Unknown realtime request type",
    statusCode: 404,
    messageToSend: `Unknown request: ${type}`,
    severity: ErrorSeverity.low,
  });

export const getSocketNotAuthenticatedError = () =>
  new ControlledError({
    code: ErrorCode.MISSING_AUTH,
    message: "Realtime request before session:auth",
    statusCode: 401,
    messageToSend: "Send session:auth first",
    severity: ErrorSeverity.low,
  });

export const getTooManyConnectionsError = () =>
  new ControlledError({
    code: ErrorCode.TOO_MANY_REQUESTS,
    message: "Too many realtime connections for one user",
    statusCode: 429,
    messageToSend: "Too many tabs open, close one and try again",
    severity: ErrorSeverity.low,
  });

// A connection belongs to one user for good.
export const getSocketUserChangedError = () =>
  new ControlledError({
    code: ErrorCode.FORBIDDEN,
    message: "session:auth with another user's token",
    statusCode: 403,
    messageToSend: "This connection belongs to another user, open a new one",
    severity: ErrorSeverity.low,
  });

export const getSocketRateLimitError = () =>
  new ControlledError({
    code: ErrorCode.TOO_MANY_REQUESTS,
    message: "Realtime connection over its rate limit",
    statusCode: 429,
    messageToSend: "Too many requests, slow down",
    severity: ErrorSeverity.low,
    details: { retryAfterSeconds: 1 },
  });
