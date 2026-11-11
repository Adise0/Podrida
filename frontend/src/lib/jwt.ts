// What the frontend reads from a session token. It's only decoded, never verified: the backend is
// the one that decides if it's valid, this is just to know when to refresh and how fresh it is.
export interface SessionClaims {
  id: string;
  authTime: number; // Seconds, when the user last really logged in (refreshing keeps it).
  iat: number; // Seconds, when this token was issued.
  exp: number; // Seconds.
  tokenRefreshTime?: number; // Hours after iat the token should be refreshed.
}

export function decodeSessionToken(token: string): SessionClaims | null {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));

    if (
      typeof claims !== "object" ||
      claims === null ||
      typeof (claims as SessionClaims).exp !== "number" ||
      typeof (claims as SessionClaims).iat !== "number"
    ) {
      return null;
    }

    return claims as SessionClaims;
  } catch {
    return null;
  }
}
