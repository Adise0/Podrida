// The browser side of "sign in with Google/Apple": the random values sent with the authorization
// request, kept in sessionStorage because the redirect to the provider wipes everything in memory.
const PENDING_OAUTH_KEY = "podrida.pendingOAuth";

export type OAuthMode = "login" | "link";

export interface PendingOAuth {
  provider: string;
  mode: OAuthMode;
  state: string;
  nonce: string;
  codeVerifier?: string; // Only for providers that support PKCE.
  returnTo: string;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomBase64Url(byteLength: number): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

// PKCE (RFC 7636): the challenge is the base64url SHA-256 of the verifier.
export async function getCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  return toBase64Url(new Uint8Array(digest));
}

export function savePendingOAuth(pending: PendingOAuth): void {
  sessionStorage.setItem(PENDING_OAUTH_KEY, JSON.stringify(pending));
}

// Read once: it's removed straight away, so a callback URL can never be replayed.
export function takePendingOAuth(): PendingOAuth | null {
  try {
    const stored = sessionStorage.getItem(PENDING_OAUTH_KEY);
    sessionStorage.removeItem(PENDING_OAUTH_KEY);
    return stored ? (JSON.parse(stored) as PendingOAuth) : null;
  } catch {
    return null;
  }
}

export function getProviderLabel(provider: string): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}
