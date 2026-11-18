// Which browser origins may call the API: CORS_ORIGINS if set (comma-separated), the frontend
// otherwise. Read on every call, so it's never evaluated before validateEnv has checked the URLs.
// Used by CORS for requests and by the WebSocket upgrade, which CORS doesn't cover.
export const getAllowedOrigins = (): string[] =>
  (process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) => new URL(url).origin);

// Postman, curl and server-to-server calls don't send an Origin, so they're never in the way.
export const isOriginAllowed = (origin: string | undefined) =>
  !origin || getAllowedOrigins().includes(origin);
