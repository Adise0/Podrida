import { setSessionHandlers } from "../api/client";
import { tokenStorage } from "../lib/tokenStorage";
import { requestReauth } from "./reauth/actions";
import { endSession } from "./session/actions";

// Tells the API client how the session works. Called once, before the app renders.
export function wireApiClient() {
  setSessionHandlers({
    getToken: tokenStorage.get,

    onInvalidToken(usedToken) {
      if (tokenStorage.get() === usedToken) endSession("expired");
    },

    onUserDisabled(usedToken) {
      if (tokenStorage.get() === usedToken) endSession("disabled");
    },

    onReauthRequired: requestReauth,
  });
}
