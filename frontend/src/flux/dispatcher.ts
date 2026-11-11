import type { AppAction } from "./actions";

type Listener = (action: AppAction) => void;

// The one Flux dispatcher. Every store registers its reducer's dispatch here, and every action is
// broadcast to all of them: each reducer handles the actions it cares about and ignores the rest.
// That's how a single SESSION_ENDED clears the session, the user and the admin data without any
// store knowing about the others.
const listeners = new Set<Listener>();

export const dispatcher = {
  register(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  dispatch(action: AppAction): void {
    listeners.forEach((listener) => listener(action));
  },
};
