import { IncomingMessage, Server } from "node:http";
import { Duplex } from "node:stream";
import { realtimePath, SocketCloseCode } from "@podrida/shared";
import { WebSocketServer } from "ws";
import {
  socketAuthTimeoutInSeconds,
  socketHeartbeatIntervalInSeconds,
  socketMaxMessageBytes,
} from "../data/serverConfig/server-config";
import { isOriginAllowed } from "../server/utils/allowedOrigins";
import { onSessionsChanged } from "../server/utils/auth/sessionEvents";
import logger from "../server/utils/logger";
import { liveCounts } from "../server/utils/metrics";
import { addClient, getClients, removeClient, revalidateUser } from "./connections";
import realtimeRouter from "./realtimeRouter";
import { detachClient } from "./games/gameManager";
import { unsubscribeFromLobby } from "./rooms/lobbyFeed";
import SocketClient from "./SocketClient";

export interface RealtimeServer {
  close: () => Promise<void>;
}

const refuseUpgrade = (socket: Duplex, status: string) => {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
};

// The realtime connection: WebSockets on the HTTP server's realtimePath. See realtime.ts in
// @podrida/shared for the protocol, and realtimeRouter.ts for what it can do.
const attachRealtime = (server: Server): RealtimeServer => {
  const wss = new WebSocketServer({ noServer: true, maxPayload: socketMaxMessageBytes });

  liveCounts.connections = () => getClients().size;

  // CORS doesn't apply to WebSockets, so the origin is checked here. The session token is what
  // actually protects it (it's never sent automatically like a cookie), this just keeps other
  // sites' pages off it.
  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");

    if (pathname !== realtimePath) {
      refuseUpgrade(socket, "404 Not Found");
      return;
    }

    if (!isOriginAllowed(req.headers.origin)) {
      refuseUpgrade(socket, "403 Forbidden");
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  };

  server.on("upgrade", onUpgrade);

  wss.on("connection", (ws) => {
    const client = new SocketClient(ws, logger);
    addClient(client);
    client.log.debug("Realtime connection opened");

    const authTimer = setTimeout(() => {
      if (!client.session) {
        client.close(SocketCloseCode.authTimeout, "No session:auth in time");
      }
    }, socketAuthTimeoutInSeconds * 1000);
    authTimer.unref();

    ws.on("pong", () => client.markAlive());

    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        client.close(SocketCloseCode.protocolError, "Messages must be text");
        return;
      }

      realtimeRouter.handle(client, data.toString());
    });

    ws.on("close", (code) => {
      clearTimeout(authTimer);
      client.dispose();
      unsubscribeFromLobby(client);
      detachClient(client);
      removeClient(client);
      client.log.debug({ code }, "Realtime connection closed");
    });

    // Eg. a message over maxPayload. ws closes the connection itself afterwards.
    ws.on("error", (error) => client.log.debug({ err: error }, "Realtime connection error"));
  });

  // Connections that went away without closing (a laptop lid, a dead network) never fire "close"
  // on their own: they're the ones that stop answering pings.
  const heartbeat = setInterval(() => {
    getClients().forEach((client) => client.heartbeat());
  }, socketHeartbeatIntervalInSeconds * 1000);
  heartbeat.unref();

  const stopListening = onSessionsChanged((userId) => {
    revalidateUser(userId).catch((error) =>
      logger.error({ err: error, userId }, "Couldn't revalidate realtime sessions"),
    );
  });

  return {
    // Tells every client to come back later (1001), then waits for the connections to close.
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(heartbeat);
        stopListening();
        server.off("upgrade", onUpgrade);
        getClients().forEach((client) =>
          client.close(SocketCloseCode.goingAway, "Server shutting down"),
        );
        // Whatever hasn't closed after a second is cut, so the shutdown isn't held up.
        const forceTimer = setTimeout(
          () => getClients().forEach((client) => client.terminate()),
          1000,
        );
        forceTimer.unref();
        wss.close(() => {
          clearTimeout(forceTimer);
          resolve();
        });
      }),
  };
};

export default attachRealtime;
