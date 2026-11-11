// Where the session token persists between reloads. Only the session action creators write here;
// the session store holds the same token for the views, and the API client reads it from here.
export const TOKEN_STORAGE_KEY = "podrida.sessionToken";

// Storage can throw (private mode, blocked site data): the app then just forgets the session on reload.
export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },

  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // Nothing to do, see above.
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Nothing to do, see above.
    }
  },
};
