import {
  ErrorCode,
  realtimePath,
  SocketCloseCode,
  type SocketEventType,
  type SocketEvents,
  type SocketRequests,
  type SocketRequestType,
  type SocketServerMessage,
} from "@podrida/shared";
import { API_URL, ApiError, NETWORK_ERROR_STATUS } from "./client";

// The realtime connection to the API (see realtime.ts in @podrida/shared for the protocol). One per
// tab, opened while there's a session. It knows nothing about stores: wireRealtime plugs it in.
//
// Requests answer like the REST client: the reply's payload, or an ApiError, so ErrorAlert and the
// error helpers work the same. A request made while (re)connecting waits for the connection.

// "online": open and authenticated. "blocked": the server refused it for good (too many tabs).
export type RealtimeStatus = "offline" | "connecting" | "online" | "blocked";

export type AuthReply = SocketRequests["session:auth"]["reply"];

const REQUEST_TIMEOUT_MS = 15_000;
const RECONNECT_MIN_MS = 500;
const RECONNECT_MAX_MS = 30_000;

const realtimeUrl = `${API_URL.replace(/^http/, "ws")}${realtimePath}`;

const networkError = (message = "Can't reach the server") =>
  new ApiError({
    error: true,
    status: NETWORK_ERROR_STATUS,
    code: ErrorCode.INTERNAL_ERROR,
    message,
  });

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface QueuedRequest extends PendingRequest {
  type: SocketRequestType;
  payload: unknown;
}

type Listener<T> = (value: T) => void;

class RealtimeClient {
  private socket: WebSocket | null = null;

  private token: string | null = null;

  private isWanted = false; // Between start() and stop(): reconnect whenever it drops.

  private status: RealtimeStatus = "offline";

  private nextId = 1;

  private pending = new Map<number, PendingRequest>();

  private queue: QueuedRequest[] = []; // Made before the connection was online.

  private reconnectAttempt = 0;

  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  private eventListeners = new Map<SocketEventType, Set<Listener<never>>>();

  private statusListeners = new Set<Listener<RealtimeStatus>>();

  private readyListeners = new Set<Listener<AuthReply>>();

  // Called when the server ends the connection's session (expired or revoked). The app checks the
  // session (a refresh): a new token comes back through start(), or the session ends.
  onSessionEnded: () => void = () => {};

  // Opens the connection with this token, or hands a new one to the open connection.
  start(token: string) {
    const isNewToken = token !== this.token;
    this.token = token;
    this.isWanted = true;

    if (this.status === "blocked") return;

    if (!this.socket) {
      clearTimeout(this.reconnectTimer);
      this.connect();
      return;
    }

    if (isNewToken && this.status === "online") {
      this.authenticate().catch(() => {}); // A failure is handled in authenticate().
    }
  }

  stop() {
    this.isWanted = false;
    this.token = null;
    clearTimeout(this.reconnectTimer);
    this.socket?.close(SocketCloseCode.normal);
    this.socket = null;
    this.failAll(
      new ApiError({
        error: true,
        status: 401,
        code: ErrorCode.MISSING_AUTH,
        message: "Logged out",
      }),
    );
    this.setStatus("offline");
  }

  getStatus() {
    return this.status;
  }

  request<T extends SocketRequestType>(
    type: T,
    ...[payload]: SocketRequests[T]["payload"] extends undefined
      ? []
      : [SocketRequests[T]["payload"]]
  ): Promise<SocketRequests[T]["reply"]> {
    if (!this.isWanted || this.status === "blocked") return Promise.reject(networkError());

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.queue = this.queue.filter((queued) => queued.timer !== timer);
        reject(networkError("The server took too long to answer"));
      }, REQUEST_TIMEOUT_MS);
      const entry = { resolve: resolve as (payload: unknown) => void, reject, timer };

      if (this.status === "online") this.send(type, payload, entry);
      else this.queue.push({ ...entry, type, payload });
    });
  }

  on<T extends SocketEventType>(event: T, listener: Listener<SocketEvents[T]>) {
    const listeners = this.eventListeners.get(event) ?? new Set();
    listeners.add(listener as Listener<never>);
    this.eventListeners.set(event, listeners);
    return () => listeners.delete(listener as Listener<never>);
  }

  onStatus(listener: Listener<RealtimeStatus>) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  // After every successful authentication, the first one and each reconnect: the moment to
  // re-subscribe and re-fetch whatever may have been missed while offline.
  onReady(listener: Listener<AuthReply>) {
    this.readyListeners.add(listener);
    return () => this.readyListeners.delete(listener);
  }

  private setStatus(status: RealtimeStatus) {
    if (status === this.status) return;
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private connect() {
    this.setStatus("connecting");
    const socket = new WebSocket(realtimeUrl);
    this.socket = socket;

    socket.onopen = () => {
      this.authenticate().catch(() => {});
    };

    socket.onmessage = (event) => {
      if (typeof event.data === "string") this.handleMessage(JSON.parse(event.data));
    };

    socket.onclose = (event) => {
      if (this.socket === socket) this.handleClose(event.code);
    };
  }

  private async authenticate() {
    const token = this.token;
    if (!token) return;

    try {
      const reply = await new Promise<AuthReply>((resolve, reject) => {
        const timer = setTimeout(() => reject(networkError()), REQUEST_TIMEOUT_MS);
        this.send(
          "session:auth",
          { token },
          {
            resolve: resolve as (payload: unknown) => void,
            reject,
            timer,
          },
        );
      });

      this.reconnectAttempt = 0;
      const wasOnline = this.status === "online";
      this.setStatus("online");
      if (!wasOnline) this.flushQueue();
      this.readyListeners.forEach((listener) => listener(reply));

      // A newer token came while this one was being checked (eg. the refresh on page load): the
      // connection is up with the old one, and now gets the new one. start() only sends a new token
      // on an online connection, so without this it would never be sent.
      if (this.token && token !== this.token) this.authenticate().catch(() => {});
    } catch {
      // The server closes the connection on a failed first auth (4001), handleClose takes it from there.
    }
  }

  private send(type: SocketRequestType, payload: unknown, entry: PendingRequest) {
    const id = this.nextId;
    this.nextId += 1;
    this.pending.set(id, entry);
    this.socket?.send(JSON.stringify({ id, type, payload }));
  }

  private flushQueue() {
    const queued = this.queue;
    this.queue = [];
    queued.forEach(({ type, payload, ...entry }) => this.send(type, payload, entry));
  }

  private handleMessage(message: SocketServerMessage) {
    if (message.kind === "event") {
      this.eventListeners
        .get(message.event)
        ?.forEach((listener) => (listener as Listener<unknown>)(message.payload));
      return;
    }

    const entry = this.pending.get(message.id);
    if (!entry) return;

    this.pending.delete(message.id);
    clearTimeout(entry.timer);

    if (message.ok) entry.resolve(message.payload);
    else entry.reject(new ApiError(message.error));
  }

  private failAll(error: unknown) {
    [...this.pending.values(), ...this.queue].forEach((entry) => {
      clearTimeout(entry.timer);
      entry.reject(error);
    });
    this.pending.clear();
    this.queue = [];
  }

  private handleClose(code: number) {
    this.socket = null;

    // Requests sent on it may or may not have been handled: the caller decides whether to retry.
    // The queued ones haven't been sent yet, they wait for the next connection.
    [...this.pending.values()].forEach((entry) => {
      clearTimeout(entry.timer);
      entry.reject(networkError());
    });
    this.pending.clear();

    if (!this.isWanted) {
      this.setStatus("offline");
      return;
    }

    if (code === SocketCloseCode.tooManyConnections) {
      this.failAll(networkError("Too many tabs open"));
      this.setStatus("blocked");
      return;
    }

    if (code === SocketCloseCode.sessionEnded) this.onSessionEnded();

    this.setStatus("connecting");
    this.scheduleReconnect();
  }

  // Exponential backoff with jitter, so a server coming back isn't hit by every tab at once.
  private scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    const base = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;

    this.reconnectTimer = setTimeout(
      () => {
        if (this.isWanted && !this.socket) this.connect();
      },
      base / 2 + Math.random() * (base / 2),
    );
  }
}

export const realtime = new RealtimeClient();
