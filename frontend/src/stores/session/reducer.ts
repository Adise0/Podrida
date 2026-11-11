import type { Reducer } from "../../flux/createStore";
import { decodeSessionToken } from "../../lib/jwt";
import { tokenStorage } from "../../lib/tokenStorage";

// "restoring": there's a token from a previous visit, being checked with the server.
export type SessionStatus = "restoring" | "anonymous" | "authenticated";

export type SessionEndReason =
  "logout" | "expired" | "disabled" | "signedOutEverywhere" | "accountDeleted";

export interface SessionState {
  status: SessionStatus;
  token: string | null;
  userId: string | null;
  authTime: number | null; // Milliseconds, the last real login (what fresh-auth checks look at).
  refreshAt: number | null; // Milliseconds.
  expiresAt: number | null; // Milliseconds.
  endReason: SessionEndReason | null;
}

export type SessionAction =
  // A new login: a new user, possibly a different one.
  | { type: "SESSION_STARTED"; token: string }
  // A new token for the same user: refresh, re-login, password change.
  | { type: "SESSION_REFRESHED"; token: string }
  | { type: "SESSION_ENDED"; reason: SessionEndReason };

const anonymousState: SessionState = {
  status: "anonymous",
  token: null,
  userId: null,
  authTime: null,
  refreshAt: null,
  expiresAt: null,
  endReason: null,
};

function fromToken(token: string, status: SessionStatus): SessionState {
  const claims = decodeSessionToken(token);

  if (!claims) return anonymousState;

  // Without the hint, refresh halfway through the token's life.
  const refreshInSeconds = claims.tokenRefreshTime
    ? claims.tokenRefreshTime * 60 * 60
    : (claims.exp - claims.iat) / 2;

  return {
    status,
    token,
    userId: claims.id,
    authTime: claims.authTime * 1000,
    refreshAt: (claims.iat + refreshInSeconds) * 1000,
    expiresAt: claims.exp * 1000,
    endReason: null,
  };
}

// Picks up the token from the last visit. An expired one is dropped right away.
export function getInitialSessionState(): SessionState {
  const token = tokenStorage.get();
  const restored = token ? fromToken(token, "restoring") : anonymousState;

  if (restored.expiresAt === null || restored.expiresAt <= Date.now()) {
    tokenStorage.clear();
    return anonymousState;
  }

  return restored;
}

export const sessionReducer: Reducer<SessionState> = (state, action) => {
  switch (action.type) {
    case "SESSION_STARTED":
    case "SESSION_REFRESHED":
      return fromToken(action.token, "authenticated");

    case "SESSION_ENDED":
      return { ...anonymousState, endReason: action.reason };

    default:
      return state;
  }
};
