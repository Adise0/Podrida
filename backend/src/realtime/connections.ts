import { SocketCloseCode, type SocketEventType, type SocketEvents } from "@podrida/shared";
import ControlledError from "../data/errorObjects/ControlledError";
import { socketMaxConnectionsPerUser } from "../data/serverConfig/server-config";
import { assertSessionIsCurrent, VerifiedSession } from "../server/utils/auth/verifySessionToken";
import SocketClient from "./SocketClient";

// Every open connection, and the authenticated ones by user. A user counts as connected while at
// least one of their connections is open (several tabs are fine).
const clients = new Set<SocketClient>();
const clientsByUser = new Map<string, Set<SocketClient>>();

type PresenceListener = (userId: string) => void;
const connectedListeners: PresenceListener[] = [];
const disconnectedListeners: PresenceListener[] = [];

// Rooms and games follow presence through these: a user's first connection, and their last one
// going away.
export const onUserConnected = (listener: PresenceListener) => connectedListeners.push(listener);
export const onUserDisconnected = (listener: PresenceListener) =>
  disconnectedListeners.push(listener);

export const getClients = (): ReadonlySet<SocketClient> => clients;

export const isUserConnected = (userId: string) => (clientsByUser.get(userId)?.size ?? 0) > 0;

export const addClient = (client: SocketClient) => {
  clients.add(client);
};

// The first "session:auth" of a connection, or a new token on it. false when the user already has
// too many connections: the caller answers and closes it.
export const authenticateClient = (client: SocketClient, session: VerifiedSession): boolean => {
  const isFirstAuth = client.session === null;
  const userClients = clientsByUser.get(session.userId) ?? new Set<SocketClient>();

  if (isFirstAuth && userClients.size >= socketMaxConnectionsPerUser) {
    return false;
  }

  client.setSession(session);

  if (isFirstAuth) {
    userClients.add(client);
    clientsByUser.set(session.userId, userClients);

    if (userClients.size === 1) {
      connectedListeners.forEach((listener) => listener(session.userId));
    }
  }

  return true;
};

export const removeClient = (client: SocketClient) => {
  clients.delete(client);
  const { userId } = client;

  if (!userId) {
    return;
  }

  const userClients = clientsByUser.get(userId);
  userClients?.delete(client);

  if (userClients && userClients.size === 0) {
    clientsByUser.delete(userId);
    disconnectedListeners.forEach((listener) => listener(userId));
  }
};

export const sendToUser = <T extends SocketEventType>(
  userId: string,
  event: T,
  payload: SocketEvents[T],
) => {
  clientsByUser.get(userId)?.forEach((client) => client.sendEvent(event, payload));
};

export const sendToUsers = <T extends SocketEventType>(
  userIds: Iterable<string>,
  event: T,
  payload: SocketEvents[T],
) => {
  [...userIds].forEach((userId) => sendToUser(userId, event, payload));
};

// The user's sessions may have been revoked (see sessionEvents): every connection checks its own
// again, the ones that aren't valid anymore are closed.
export const revalidateUser = async (userId: string) => {
  const userClients = [...(clientsByUser.get(userId) ?? [])];

  await Promise.all(
    userClients.map(async (client) => {
      const { session } = client;

      if (!session) {
        return;
      }

      try {
        await assertSessionIsCurrent({ id: session.userId, ...session });
      } catch (error) {
        if (!(error instanceof ControlledError)) {
          client.log.error({ err: error }, "Couldn't revalidate a realtime session");
          return;
        }

        client.close(SocketCloseCode.sessionEnded, "Session ended");
      }
    }),
  );
};
