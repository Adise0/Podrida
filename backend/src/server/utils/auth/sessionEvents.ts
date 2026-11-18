import { EventEmitter } from "node:events";

// Tells whoever keeps sessions open (the WebSocket connections) that a user's sessions may have
// been revoked: signed out, disabled, password changed, deleted... They check theirs again and
// close the ones that aren't valid anymore. REST requests don't need it, they check every time.
const sessionEvents = new EventEmitter();

const sessionsChanged = "sessionsChanged";

export const notifySessionsChanged = (userId: string) => {
  sessionEvents.emit(sessionsChanged, userId);
};

export const onSessionsChanged = (listener: (userId: string) => void) => {
  sessionEvents.on(sessionsChanged, listener);
  return () => {
    sessionEvents.off(sessionsChanged, listener);
  };
};
