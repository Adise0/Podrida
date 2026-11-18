import { SocketCloseCode, type SocketRequests, type SocketRequestType } from "@podrida/shared";
import { ObjectSchema } from "joi";
import ControlledError from "../data/errorObjects/ControlledError";
import { getValidationError } from "../data/errorObjects/dataValidationErrors";
import {
  getSocketNotAuthenticatedError,
  getSocketRateLimitError,
  getUnknownRequestError,
} from "../data/errorObjects/realtimeErrors";
import joiValidationOptions from "../data/joiObjects/joiValidationOptions";
import { socketRequestEnvelope } from "../data/joiObjects/realtimeData";
import { ErrorSeverity } from "../types/errorTypes/ServerError";
import { ErrorCode } from "../types/errorTypes/ErrorCode";
import { realtimeRequestDuration } from "../server/utils/metrics";
import SocketClient from "./SocketClient";

export interface SocketContext<T extends SocketRequestType> {
  client: SocketClient;
  userId: string; // "" for the routes that don't need a session (only session:auth).
  payload: SocketRequests[T]["payload"];
}

type SocketHandler<T extends SocketRequestType> = (
  context: SocketContext<T>,
) => SocketRequests[T]["reply"] | Promise<SocketRequests[T]["reply"]>;

interface RouteOptions {
  schema?: ObjectSchema; // Validates the payload, like the REST body validators.
  isPublic?: boolean; // Doesn't need "session:auth" first.
}

interface Route {
  options: RouteOptions;
  handler: SocketHandler<SocketRequestType>;
}

const logLevelBySeverity = {
  [ErrorSeverity.high]: "error",
  [ErrorSeverity.medium]: "warn",
  [ErrorSeverity.low]: "debug",
} as const;

const internalError = (error: unknown) =>
  new ControlledError({
    code: ErrorCode.INTERNAL_ERROR,
    message: (error as Error)?.message ?? "Unknown error",
    statusCode: 500,
    messageToSend: "Internal server error",
    severity: ErrorSeverity.high,
  });

// The REST routers' counterpart for the realtime connection: maps a request type to its payload
// validation and handler, and answers every request with a reply, whatever happens. Handlers
// throw ControlledErrors, like controllers pass them to next().
export default class SocketRouter {
  private routes = new Map<string, Route>();

  on<T extends SocketRequestType>(type: T, options: RouteOptions, handler: SocketHandler<T>) {
    // Stored without its type parameter: the map holds every request type.
    this.routes.set(type, {
      options,
      handler: handler as unknown as SocketHandler<SocketRequestType>,
    });
    return this;
  }

  async handle(client: SocketClient, rawMessage: string) {
    let message: unknown;

    try {
      message = JSON.parse(rawMessage);
    } catch {
      client.close(SocketCloseCode.protocolError, "Messages must be JSON");
      return;
    }

    const { error: envelopeError, value: request } = socketRequestEnvelope.validate(message);

    // Without a valid id there's nothing to answer to.
    if (envelopeError) {
      client.close(SocketCloseCode.protocolError, "Messages must be { id, type, payload }");
      return;
    }

    const startedAt = process.hrtime.bigint();
    const route = this.routes.get(request.type);
    const routeLabel = route ? request.type : "unknown";

    try {
      if (!client.takeRateToken()) {
        throw getSocketRateLimitError();
      }

      if (!route) {
        throw getUnknownRequestError(request.type);
      }

      if (!route.options.isPublic && !client.session) {
        throw getSocketNotAuthenticatedError();
      }

      let { payload } = request;

      if (route.options.schema) {
        const { error, value } = route.options.schema.validate(payload ?? {}, joiValidationOptions);

        if (error) {
          throw getValidationError(error, request.type);
        }

        payload = value;
      }

      const result = await route.handler({ client, userId: client.userId ?? "", payload });
      client.reply(request.id, result);
      realtimeRequestDuration.observe(
        { type: routeLabel, result: "ok" },
        Number(process.hrtime.bigint() - startedAt) / 1e9,
      );
    } catch (thrown) {
      const error = thrown instanceof ControlledError ? thrown : internalError(thrown);

      client.log[logLevelBySeverity[error.severity]](
        { err: thrown, type: request.type, code: error.code, extraData: error.extraData },
        error.message,
      );
      client.replyError(request.id, error);
      realtimeRequestDuration.observe(
        { type: routeLabel, result: error.code },
        Number(process.hrtime.bigint() - startedAt) / 1e9,
      );
    }
  }
}
