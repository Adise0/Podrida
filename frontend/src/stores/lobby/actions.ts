import { realtime } from "../../api/realtime";
import { dispatcher } from "../../flux/dispatcher";

// How many views watch the lobby. Subscribed while there's one, and again after every reconnect
// (see wireRealtime), since events sent while offline are lost.
let watchers = 0;

export const isLobbyWatched = () => watchers > 0;

export async function loadLobby() {
  dispatcher.dispatch({ type: "LOBBY_LOADING" });

  try {
    const { rooms } = await realtime.request("lobby:subscribe");
    dispatcher.dispatch({ type: "LOBBY_LOADED", rooms });
  } catch (error) {
    dispatcher.dispatch({ type: "LOBBY_LOAD_FAILED", error });
  }
}

// Returns the cleanup, for an effect.
export function watchLobby() {
  watchers += 1;
  if (watchers === 1) loadLobby();

  return () => {
    watchers -= 1;
    if (watchers > 0) return;

    dispatcher.dispatch({ type: "LOBBY_CLOSED" });
    realtime.request("lobby:unsubscribe").catch(() => {}); // Offline: it's unsubscribed anyway.
  };
}
