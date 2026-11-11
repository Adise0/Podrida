// What the auth pages hand each other through the router's location state (it survives a reload,
// and keeps short-lived tokens out of the URL and out of the stores).
export interface AuthLocationState {
  from?: string; // Where to go once logged in.
  notice?: string; // A message for the page to show, eg. why the user was sent back to login.
  oauthSignup?: {
    signupToken: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  email?: string; // The address an email was just sent to.
}

export function readAuthState(state: unknown): AuthLocationState {
  return typeof state === "object" && state !== null ? (state as AuthLocationState) : {};
}

// Only paths of this app: a "from" can never send the user to another site.
export function getSafeReturnPath(path: unknown, fallback = "/"): string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//")
    ? path
    : fallback;
}
