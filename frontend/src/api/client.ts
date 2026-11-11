import type { ResponseError } from "@podrida/shared";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// Thrown for every error answer of the API. Switch on `body.code` (an ErrorCode), never on the message.
export class ApiError extends Error {
  readonly body: ResponseError;

  constructor(body: ResponseError) {
    super(body.message);
    this.body = body;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) throw new ApiError(body as ResponseError);
  return body as T;
}
