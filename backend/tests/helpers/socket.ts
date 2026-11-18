import {
  realtimePath,
  type ResponseError,
  type SocketEvent,
  type SocketEventType,
  type SocketEvents,
  type SocketRequests,
  type SocketRequestType,
  type SocketServerMessage,
} from "@podrida/shared";
import WebSocket from "ws";
import { getBaseUrl } from "./api";

export type Reply<T extends SocketRequestType> =
  { ok: true; payload: SocketRequests[T]["reply"] } | { ok: false; error: ResponseError };

const wait = (milliseconds: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

// A realtime connection for tests: requests answer their reply, and every event is kept so a test
// can wait for one (or check one never came).
export const openSocket = async (options: { origin?: string; path?: string } = {}) => {
  const url = getBaseUrl().replace("http", "ws") + (options.path ?? realtimePath);
  const ws = new WebSocket(url, { headers: options.origin ? { origin: options.origin } : {} });

  const events: SocketEvent[] = [];
  const pending = new Map<number, (reply: Reply<SocketRequestType>) => void>();
  let nextId = 1;

  // The server answers every request before it closes: one still waiting then never will be.
  const closed = new Promise<{ code: number; reason: string }>((resolve) => {
    ws.on("close", (code, reason) => {
      pending.forEach((resolveReply) =>
        resolveReply({
          ok: false,
          error: { error: true, status: 0, code: "CLOSED_UNANSWERED", message: "" },
        } as unknown as Reply<SocketRequestType>),
      );
      pending.clear();
      resolve({ code, reason: reason.toString() });
    });
  });

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString()) as SocketServerMessage;

    if (message.kind === "event") {
      events.push(message);
      return;
    }

    // Typed by whoever sent the request, see request().
    const reply = (
      message.ok ? message : { ok: false, error: message.error }
    ) as Reply<SocketRequestType>;
    pending.get(message.id)?.(reply);
    pending.delete(message.id);
  });

  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });

  const request = <T extends SocketRequestType>(
    type: T,
    payload?: SocketRequests[T]["payload"],
  ): Promise<Reply<T>> => {
    const id = nextId;
    nextId += 1;

    return new Promise((resolve) => {
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, type, payload }));
    });
  };

  // The first event of that type matching the check, whether it already came or comes within 2s.
  const nextEvent = async <T extends SocketEventType>(
    event: T,
    matches: (payload: SocketEvents[T]) => boolean = () => true,
  ): Promise<SocketEvents[T]> => {
    for (let tries = 0; tries < 100; tries += 1) {
      const index = events.findIndex(
        (received) => received.event === event && matches(received.payload as SocketEvents[T]),
      );

      if (index !== -1) {
        const [found] = events.splice(index, 1);
        return found.payload as SocketEvents[T];
      }

      await wait(20);
    }

    throw new Error(`No "${event}" event came`);
  };

  return {
    ws,
    events,
    closed,
    request,
    nextEvent,
    send: (raw: string) => ws.send(raw),
    close: () => {
      ws.close();
      return closed;
    },
  };
};

export type TestSocket = Awaited<ReturnType<typeof openSocket>>;

// A connection already authenticated with the session token.
export const connectAs = async (token: string) => {
  const socket = await openSocket();
  const reply = await socket.request("session:auth", { token });

  if (!reply.ok) {
    throw new Error(`session:auth failed: ${reply.error.code}`);
  }

  return socket;
};

// What a successful request answered. Fails the test with the error code otherwise.
export const expectOk = <T extends SocketRequestType>(reply: Reply<T>) => {
  if (!reply.ok) {
    throw new Error(`Expected ok, got ${reply.error.code}: ${reply.error.message}`);
  }

  return reply.payload;
};

export const expectError = <T extends SocketRequestType>(reply: Reply<T>) => {
  if (reply.ok) {
    throw new Error("Expected an error, got ok");
  }

  return reply.error;
};
