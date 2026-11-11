import type { OAuthProviderInfo } from "@podrida/shared";
import { oauthApi } from "../api/oauth";
import { getCodeChallenge, randomBase64Url, savePendingOAuth, type OAuthMode } from "../lib/oauth";
import { ensureFreshAuth } from "../stores/reauth/actions";
import { useRequest } from "./useRequest";

// Sends the user to the provider. They come back to /auth/oauth/:provider/callback (OAuthCallbackPage).
async function startOAuth(provider: OAuthProviderInfo, mode: OAuthMode, returnTo: string) {
  // Linking needs a recent login, and can't be retried once the page is left: check it first.
  if (mode === "link") await ensureFreshAuth();

  const state = randomBase64Url(16);
  const nonce = randomBase64Url(16);
  const codeVerifier = provider.supportsPkce ? randomBase64Url(32) : undefined;
  const codeChallenge = codeVerifier ? await getCodeChallenge(codeVerifier) : undefined;

  const { url } = await oauthApi.authorizationUrl(provider.name, { state, nonce, codeChallenge });

  savePendingOAuth({ provider: provider.name, mode, state, nonce, codeVerifier, returnTo });
  window.location.assign(url);
}

export function useOAuthStart() {
  return useRequest(startOAuth);
}
