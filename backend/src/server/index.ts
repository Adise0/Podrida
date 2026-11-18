import { randomUUID } from "node:crypto";
import { IncomingMessage, ServerResponse } from "node:http";
import cors, { CorsOptions } from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import errorsHandler from "./middlewares/errors/errorsHandler";
import notFoundError from "./middlewares/errors/notFoundError";
import metrics from "./middlewares/metrics";
import normalizeBody from "./middlewares/normalizeBody";
import mainRouter from "./routers";
import { endpoints } from "../data/serverConfig/endpoints";
import { avatarRequestBodyLimit } from "../data/serverConfig/server-config";
import { isOriginAllowed } from "./utils/allowedOrigins";
import logger, { maskTokensInUrl } from "./utils/logger";

// Keeps the id a proxy may have already assigned, so a request can be followed across services.
// Anything that doesn't look like an id is replaced, it would go straight into the logs otherwise.
const getRequestId = (req: IncomingMessage, res: ServerResponse) => {
  const receivedId = req.headers["x-request-id"];
  const isValidId = typeof receivedId === "string" && /^[\w-]{1,64}$/.test(receivedId);
  const requestId = isValidId ? receivedId : randomUUID();

  res.setHeader("X-Request-Id", requestId);
  return requestId;
};

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    callback(null, isOriginAllowed(origin));
  },
};

const app = express(); // Server creation

// Main server middleware chain
app.use(cors(corsOptions));
app.use(
  pinoHttp({
    logger,
    genReqId: getRequestId,
    // Uptime monitors and scrapers hit these every few seconds, they'd drown everything else.
    autoLogging: {
      ignore: (req) => req.url === endpoints.health.path || req.url === endpoints.metrics.path,
    },
    // Only what's needed: no headers, so the Authorization header never reaches the logs.
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: maskTokensInUrl(req.url) }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);
app.use(metrics);
app.use(helmet());
// The requests that can carry an avatar get a bigger body. The second parser skips a body the
// first one already read.
app.use(
  [
    `${endpoints.auth.path}${endpoints.auth.register}`,
    `${endpoints.oauth.path}${endpoints.oauth.completeSignup}`,
    `${endpoints.users.path}${endpoints.users.myAvatar}`,
  ],
  express.json({ limit: avatarRequestBodyLimit }),
);
app.use(express.json());
app.use(normalizeBody);

app.use(mainRouter); // Main router is our root router

// Error handling middlewares
app.use(notFoundError);
app.use(errorsHandler);

export default app;
