import { ErrorCode } from "@podrida/shared";
import { useEffect, type ReactNode } from "react";
import { NETWORK_ERROR_STATUS, hasErrorCode, isApiError } from "../../api/client";
import { TOKEN_STORAGE_KEY } from "../../lib/tokenStorage";
import { endSession, refreshSession, replaceSessionToken, syncSessionFromStorage } from "./actions";
import { sessionStore, useSession } from "./store";

const RETRY_REFRESH_AFTER_MS = 60_000;

// The session's side effects: checking a restored token, refreshing on time, following other tabs.
function SessionEffects() {
  const { status, token, refreshAt, userId } = useSession();

  // A token from a previous visit: trade it for a fresh one, which also proves it's still valid.
  useEffect(() => {
    if (status !== "restoring" || !token) return;

    refreshSession().catch((error: unknown) => {
      // Offline: keep the (unexpired) token, the refresh timer will try again.
      if (isApiError(error) && error.status === NETWORK_ERROR_STATUS) {
        replaceSessionToken(token);
        return;
      }

      // INVALID_TOKEN and USER_DISABLED already ended it through the API client.
      if (!hasErrorCode(error, ErrorCode.INVALID_TOKEN, ErrorCode.USER_DISABLED)) {
        endSession("expired");
      }
    });
  }, [status, token]);

  useEffect(() => {
    if (status !== "authenticated" || refreshAt === null) return undefined;

    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      refreshSession().catch(() => {
        timer = setTimeout(refresh, RETRY_REFRESH_AFTER_MS);
      });
    };

    timer = setTimeout(refresh, Math.max(0, refreshAt - Date.now()));
    return () => clearTimeout(timer);
  }, [status, refreshAt]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === TOKEN_STORAGE_KEY && event.newValue !== token) {
        syncSessionFromStorage(event.newValue, userId);
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [token, userId]);

  return null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <sessionStore.Provider>
      <SessionEffects />
      {children}
    </sessionStore.Provider>
  );
}
