import { authApi } from "../../api/auth";
import { ReauthCancelledError } from "../../api/client";
import { freshAuthMaxAgeInMinutes } from "../../config";
import { dispatcher } from "../../flux/dispatcher";
import { decodeSessionToken } from "../../lib/jwt";
import { tokenStorage } from "../../lib/tokenStorage";
import { replaceSessionToken } from "../session/actions";

// Sensitive actions need a recent login. When the API answers REAUTH_REQUIRED, the request waits
// here while the modal asks the user to log in again, then the API client retries it. Several
// requests can wait at once, they're all released together.
interface Waiting {
  resolve: () => void;
  reject: (reason: Error) => void;
}

let waiting: Waiting[] = [];

export function requestReauth(): Promise<void> {
  return new Promise((resolve, reject) => {
    waiting.push({ resolve, reject });
    if (waiting.length === 1) dispatcher.dispatch({ type: "REAUTH_REQUESTED" });
  });
}

// The re-login gave a brand new session: it takes over, and the old one is signed out so they
// don't pile up.
export function completeReauth(token: string) {
  const previousToken = tokenStorage.get();
  replaceSessionToken(token);

  if (previousToken && previousToken !== token) {
    authApi.logout(previousToken).catch(() => {
      // It expires on its own anyway.
    });
  }

  const released = waiting;
  waiting = [];
  dispatcher.dispatch({ type: "REAUTH_FINISHED" });
  released.forEach(({ resolve }) => resolve());
}

export function cancelReauth() {
  const released = waiting;
  waiting = [];
  dispatcher.dispatch({ type: "REAUTH_FINISHED" });
  released.forEach(({ reject }) => reject(new ReauthCancelledError()));
}

// For flows that can't be retried once they've started, like linking a provider (which leaves the
// page): ask for the login up front instead of waiting for the API to refuse.
export async function ensureFreshAuth() {
  const token = tokenStorage.get();
  const authTime = token ? decodeSessionToken(token)?.authTime : undefined;
  const marginInSeconds = 30; // Time left to actually go through with the action.

  const isFresh =
    authTime !== undefined &&
    Date.now() / 1000 - authTime < freshAuthMaxAgeInMinutes * 60 - marginInSeconds;

  if (!isFresh) await requestReauth();
}
