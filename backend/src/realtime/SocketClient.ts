import { randomUUID } from "node:crypto";
import {
  SocketCloseCode,
  type SocketEventType,
  type SocketEvents,
  type SocketServerMessage,
} from "@podrida/shared";
import type { Logger } from "pino";
import WebSocket from "ws";
import ControlledError from "../data/errorObjects/ControlledError";
import { buildResponseError } from "../data/errorObjects/responseErrors";
import { socketRateLimitBurst, socketRateLimitPerSecond } from "../data/serverConfig/server-config";
import { VerifiedSession } from "../server/utils/auth/verifySessionToken";

// The longest a timer can wait (about 24.8 days), longer ones fire right away.
const maxTimerDelay = 2 ** 31 - 1;

// One open WebSocket: what it's authenticated as, its rate limit, and how to talk to it.
export default class SocketClient {
  readonly id = randomUUID();

  readonly log: Logger;

  // Set by "session:auth", replaced by every new token for the same user.
  session: VerifiedSession | null = null;

  // Cleared on every heartbeat ping, set again by the pong. Still cleared at the next ping: gone.
  private isAlive = true;

  private tokens = socketRateLimitBurst;

  private lastRefill = Date.now();

  private sessionTimer?: NodeJS.Timeout;

  constructor(
    private readonly socket: WebSocket,
    log: Logger,
  ) {
    this.log = log.child({ socketId: this.id });
  }

  get userId(): string | null {
    return this.session?.userId ?? null;
  }

  get isOpen() {
    return this.socket.readyState === WebSocket.OPEN;
  }

  // The connection closes when the token it was authenticated with expires, unless a newer
  // token came first.
  setSession(session: VerifiedSession) {
    this.session = session;
    this.armSessionTimer();
  }

  // Timers can't wait longer than maxTimerDelay, so a far expiry is reached in several steps.
  private armSessionTimer() {
    clearTimeout(this.sessionTimer);
    const expiresAt = this.session?.expiresAt ?? 0;

    if (!Number.isFinite(expiresAt)) {
      return;
    }

    const remaining = Math.max(0, expiresAt - Date.now());
    this.sessionTimer = setTimeout(
      () => {
        if (remaining > maxTimerDelay) {
          this.armSessionTimer();
          return;
        }

        this.close(SocketCloseCode.sessionEnded, "Session expired");
      },
      Math.min(remaining, maxTimerDelay),
    );
    this.sessionTimer.unref();
  }

  // A token bucket: false when the connection is over its rate.
  takeRateToken(): boolean {
    const now = Date.now();
    const refill = ((now - this.lastRefill) / 1000) * socketRateLimitPerSecond;
    this.tokens = Math.min(socketRateLimitBurst, this.tokens + refill);
    this.lastRefill = now;

    if (this.tokens < 1) {
      return false;
    }

    this.tokens -= 1;
    return true;
  }

  private send(message: SocketServerMessage) {
    if (this.isOpen) {
      this.socket.send(JSON.stringify(message));
    }
  }

  sendEvent<T extends SocketEventType>(event: T, payload: SocketEvents[T]) {
    this.send({ kind: "event", event, payload });
  }

  reply(id: number, payload: unknown) {
    this.send({ kind: "reply", id, ok: true, payload: payload ?? null });
  }

  replyError(id: number, error: ControlledError) {
    this.send({ kind: "reply", id, ok: false, error: buildResponseError(error) });
  }

  markAlive() {
    this.isAlive = true;
  }

  // One heartbeat: pings, unless the last ping never got its pong, which ends the connection.
  heartbeat() {
    if (!this.isAlive) {
      this.socket.terminate();
      return;
    }

    this.isAlive = false;
    this.socket.ping();
  }

  // Data already sent goes out before the close frame.
  close(code: SocketCloseCode, reason: string) {
    if (
      this.socket.readyState === WebSocket.OPEN ||
      this.socket.readyState === WebSocket.CONNECTING
    ) {
      this.socket.close(code, reason);
    }
  }

  terminate() {
    this.socket.terminate();
  }

  dispose() {
    clearTimeout(this.sessionTimer);
  }
}
