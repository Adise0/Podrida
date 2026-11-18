/* eslint-disable n/no-process-exit */

import { Server } from "node:http";
import mongoose from "mongoose";
import { shutdownTimeoutInSeconds } from "../data/serverConfig/server-config";
import { RealtimeServer } from "../realtime/socketServer";
import logger from "./utils/logger";

// On a stop signal, stops taking new requests, lets the running ones finish and closes the database
// connection before exiting. If that takes too long the process exits anyway.
const setupGracefulShutdown = (server: Server, realtime: RealtimeServer) => {
  let isShuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info(`${signal} received, shutting down`);

    const forcedExit = setTimeout(() => {
      logger.error("Shutdown took too long, forcing exit");
      process.exit(1);
    }, shutdownTimeoutInSeconds * 1000);
    forcedExit.unref();

    try {
      // WebSockets first: they'd keep the HTTP server from closing. Clients are told to reconnect.
      await realtime.close();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        // Keep-alive connections with no request running (an open browser tab) would otherwise hold
        // the close until the forced exit. The ones mid-request finish first, and close after.
        server.closeIdleConnections();
      });
      await mongoose.disconnect();
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "Error while shutting down");
      process.exit(1);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
};

export default setupGracefulShutdown;
