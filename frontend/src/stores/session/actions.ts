import { authApi } from "../../api/auth";
import { dispatcher } from "../../flux/dispatcher";
import { decodeSessionToken } from "../../lib/jwt";
import { tokenStorage } from "../../lib/tokenStorage";
import { notify } from "../notifications/actions";
import type { SessionEndReason } from "./reducer";

// Session action creators. They're the only code writing the token to storage, so storage and the
// session store always agree.

export function startSession(token: string) {
  tokenStorage.set(token);
  dispatcher.dispatch({ type: "SESSION_STARTED", token });
}

export function replaceSessionToken(token: string) {
  tokenStorage.set(token);
  dispatcher.dispatch({ type: "SESSION_REFRESHED", token });
}

const endMessages: Partial<Record<SessionEndReason, Parameters<typeof notify>>> = {
  expired: ["Your session has expired. Log in again.", "info"],
  disabled: ["This account has been disabled.", "error"],
  signedOutEverywhere: ["You've been signed out of every device.", "success"],
};

export function endSession(reason: SessionEndReason) {
  tokenStorage.clear();
  dispatcher.dispatch({ type: "SESSION_ENDED", reason });

  const message = endMessages[reason];
  if (message) notify(...message);
}

// A failure that isn't the session being invalid (eg. offline) is left to the caller: the API
// client has already ended the session on INVALID_TOKEN.
export async function refreshSession() {
  const { token } = await authApi.refreshToken();
  replaceSessionToken(token);
}

// Signing out locally always happens, even if the server can't be reached.
export async function logout() {
  try {
    await authApi.logout();
  } catch {
    // The token is dropped anyway, it expires on its own.
  }

  endSession("logout");
}

export async function signOutEverywhere() {
  await authApi.signOutEverywhere();
  endSession("signedOutEverywhere");
}

// Another tab logged in, refreshed or logged out: follow it.
export function syncSessionFromStorage(token: string | null, currentUserId: string | null) {
  if (!token) {
    dispatcher.dispatch({ type: "SESSION_ENDED", reason: "logout" });
    return;
  }

  // Same user: just a newer token. Someone else: a whole new session.
  const isSameUser = currentUserId !== null && decodeSessionToken(token)?.id === currentUserId;
  dispatcher.dispatch({ type: isSameUser ? "SESSION_REFRESHED" : "SESSION_STARTED", token });
}
