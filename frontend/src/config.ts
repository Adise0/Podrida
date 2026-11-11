// Copies of a few backend settings (backend/src/data/serverConfig/server-config.ts) the UI needs to
// know ahead of time. The backend stays the one enforcing them: if they drift, the UI just asks a
// bit too early or too late, the API answers decide.

// Sensitive actions need a login at most this old (freshAuthMaxAgeInMinutes).
export const freshAuthMaxAgeInMinutes = 5;

// How long a deleted account can still be recovered by logging in (accountDeletionGraceInDays).
export const accountDeletionGraceInDays = 14;

// Minimum time between two emails of the same kind for an account (the *RetryCooldownInSeconds).
export const emailRetryCooldownInSeconds = 60;
