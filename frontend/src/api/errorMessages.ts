import { ErrorCode, FieldErrorCode } from "@podrida/shared";
import { isApiError, NETWORK_ERROR_STATUS } from "./client";

const messages: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.INTERNAL_ERROR]: "Something went wrong on our side. Try again in a moment.",
  [ErrorCode.VALIDATION_FAILED]: "Some fields need fixing.",
  [ErrorCode.MISSING_AUTH]: "You need to log in first.",
  [ErrorCode.INVALID_TOKEN]: "Your session has expired. Log in again.",
  [ErrorCode.REAUTH_REQUIRED]: "Confirm it's you to continue.",
  [ErrorCode.FORBIDDEN]: "You're not allowed to do that.",
  [ErrorCode.INVALID_OR_EXPIRED_LINK]: "This link is invalid or has expired.",
  [ErrorCode.INVALID_CREDENTIALS]: "Wrong username, email or password.",
  [ErrorCode.USER_NOT_FOUND]: "That user doesn't exist.",
  [ErrorCode.USER_DISABLED]: "This account has been disabled.",
  [ErrorCode.ACCOUNT_NOT_ACTIVATED]: "This account isn't activated yet. Check your inbox.",
  [ErrorCode.ACCOUNT_ALREADY_ACTIVATED]: "This account is already active. You can log in.",
  [ErrorCode.PASSWORD_RESET_REQUIRED]:
    "This account needs a new password. Use “Forgot your password?” to set one.",
  [ErrorCode.DUPLICATE_KEY]: "That's already taken.",
  [ErrorCode.ACTIVATION_EMAIL_FAILED]: "We couldn't send the activation email. Try again later.",
  [ErrorCode.EMAIL_CHANGE_EMAIL_FAILED]:
    "We couldn't send the confirmation email. Try again later.",
  [ErrorCode.OAUTH_PROVIDER_UNAVAILABLE]: "That sign-in method isn't available.",
  [ErrorCode.OAUTH_FAILED]: "The sign-in didn't go through. Try again.",
  [ErrorCode.OAUTH_EMAIL_NOT_VERIFIED]:
    "Verify your email with that provider first, then try again.",
  [ErrorCode.OAUTH_EMAIL_IN_USE]:
    "An account already uses this email. Log in to it and link this sign-in method from your security settings.",
  [ErrorCode.OAUTH_ALREADY_LINKED]: "That sign-in method is already linked to an account.",
  [ErrorCode.OAUTH_NOT_LINKED]: "That sign-in method isn't linked.",
};

function formatWait(seconds: number) {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

// The text to show for any error thrown by the API layer (or anything else).
export function getErrorMessage(error: unknown): string {
  if (!isApiError(error)) return "Something went wrong. Try again.";

  if (error.status === NETWORK_ERROR_STATUS)
    return "Can't reach the server. Check your connection.";

  if (
    error.code === ErrorCode.TOO_MANY_REQUESTS ||
    error.code === ErrorCode.REGISTRATION_COOLDOWN
  ) {
    const retryAfter = Number(error.body.details?.retryAfterSeconds);
    return Number.isFinite(retryAfter) && retryAfter > 0
      ? `Too many attempts. Try again in ${formatWait(retryAfter)}.`
      : "Too many attempts. Try again later.";
  }

  return messages[error.code] ?? error.message;
}

const fieldMessages: Record<FieldErrorCode, string> = {
  [FieldErrorCode.REQUIRED]: "Required",
  [FieldErrorCode.INVALID_TYPE]: "Invalid value",
  [FieldErrorCode.INVALID_FORMAT]: "Invalid format",
  [FieldErrorCode.TOO_SHORT]: "Too short",
  [FieldErrorCode.TOO_LONG]: "Too long",
  [FieldErrorCode.TAKEN]: "Already taken",
  [FieldErrorCode.INVALID]: "Invalid value",
};

// Per-field messages from an error's "fields", eg. { username: "Already taken" }.
export function getFieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error) || !error.body.fields) return {};

  return Object.fromEntries(
    Object.entries(error.body.fields).map(([field, code]) => [field, fieldMessages[code]]),
  );
}
