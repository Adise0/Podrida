import { ErrorCode, type ResponseError } from "@podrida/shared";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// The status of an ApiError when the server couldn't be reached at all.
export const NETWORK_ERROR_STATUS = 0;

// Thrown for every error answer of the API. Switch on `code` (an ErrorCode), never on the message.
export class ApiError extends Error {
  readonly body: ResponseError;

  constructor(body: ResponseError) {
    super(body.message);
    this.name = "ApiError";
    this.body = body;
  }

  get code(): ErrorCode {
    return this.body.code;
  }

  get status(): number {
    return this.body.status;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

// Thrown instead of REAUTH_REQUIRED when the user closes the "confirm it's you" modal. Nothing went
// wrong, so it's never shown as an error.
export class ReauthCancelledError extends Error {
  constructor() {
    super("The user didn't confirm it was them");
    this.name = "ReauthCancelledError";
  }
}

export const isReauthCancelled = (error: unknown) => error instanceof ReauthCancelledError;

export const hasErrorCode = (error: unknown, ...codes: ErrorCode[]) =>
  isApiError(error) && codes.includes(error.code);

// The client knows nothing about stores: the session wiring (src/stores/wireApiClient.ts) plugs in
// how to get the token and what to do when the session breaks.
export interface SessionHandlers {
  getToken(): string | null;
  // `usedToken` is the token the failing request was sent with, so a late answer to an old request
  // can't end a newer session.
  onInvalidToken(usedToken: string): void;
  onUserDisabled(usedToken: string): void;
  // Resolves once the user has logged in again (the request is then retried once), rejects if they gave up.
  onReauthRequired(): Promise<void>;
}

let sessionHandlers: SessionHandlers | null = null;

export function setSessionHandlers(handlers: SessionHandlers) {
  sessionHandlers = handlers;
}

type QueryValue = string | number | boolean | undefined;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  // Sends the current session token. A 401/403 on it is handled here (see SessionHandlers).
  auth?: boolean;
  // Sends this token instead of the current session's, and skips the session handling.
  token?: string;
}

// Fills in the ":name" parts of an endpoint, eg. withParams("/:provider/login", { provider: "google" }).
export function withParams(path: string, params: Record<string, string>): string {
  return path.replace(/:(\w+)/g, (_, name: string) => encodeURIComponent(params[name] ?? ""));
}

const isResponseError = (body: unknown): body is ResponseError =>
  typeof body === "object" && body !== null && (body as ResponseError).error === true;

const createError = (status: number, code: ErrorCode, message: string) =>
  new ApiError({ error: true, status, code, message });

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(`${API_URL}${path}`);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  });

  return url;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const { method = "GET", body, query, auth = false } = options;
  const usesSession = auth && options.token === undefined;
  const token = options.token ?? (auth ? sessionHandlers?.getToken() : null) ?? null;

  if (auth && !token) {
    throw createError(401, ErrorCode.MISSING_AUTH, "You're not logged in");
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;

  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw createError(NETWORK_ERROR_STATUS, ErrorCode.INTERNAL_ERROR, "Can't reach the server");
  }

  const responseBody: unknown = await response.json().catch(() => null);

  if (response.ok) return responseBody as T;

  const error = isResponseError(responseBody)
    ? new ApiError(responseBody)
    : createError(response.status, ErrorCode.INTERNAL_ERROR, "Unexpected answer from the server");

  if (usesSession && token && sessionHandlers) {
    if (error.code === ErrorCode.INVALID_TOKEN) sessionHandlers.onInvalidToken(token);
    if (error.code === ErrorCode.USER_DISABLED) sessionHandlers.onUserDisabled(token);

    // Sensitive action on a session that isn't fresh: ask the user to log in again, then retry.
    if (error.code === ErrorCode.REAUTH_REQUIRED && !isRetry) {
      try {
        await sessionHandlers.onReauthRequired();
      } catch (reason) {
        throw reason instanceof ReauthCancelledError ? reason : error;
      }

      return request<T>(path, options, true);
    }
  }

  throw error;
}
