import { realtime } from "../api/realtime";
import { dispatcher } from "../flux/dispatcher";
import { isLobbyWatched, loadLobby } from "./lobby/actions";
import { attachGame, getAttachedGameId, joinRoom } from "./play/actions";
import { refreshSession } from "./session/actions";

// Plugs the realtime connection into the stores: its status and events become actions. Called
// once, before the app renders. Opening and closing it with the session is in RealtimeEffects.
export function wireRealtime() {
  realtime.onStatus((status) => dispatcher.dispatch({ type: "REALTIME_STATUS_CHANGED", status }));

  // The server ended the connection's session: a refresh either hands it a new token (the
  // connection then comes back on its own) or finds the session is over and ends it.
  realtime.onSessionEnded = () => {
    refreshSession().catch(() => {});
  };

  // After every (re)connect: where the server says the user is, and a fresh copy of whatever was
  // on screen, since the events sent while offline are lost.
  realtime.onReady(({ roomId, gameId }) => {
    dispatcher.dispatch({
      type: "REALTIME_LOCATED",
      roomId: roomId ?? null,
      gameId: gameId ?? null,
    });

    if (roomId) joinRoom(roomId).catch(() => {});
    // Only the tab that has the game open goes back to the table.
    if (gameId && getAttachedGameId() === gameId) attachGame(gameId).catch(() => {});
    if (isLobbyWatched()) loadLobby();
  });

  realtime.on("lobby:roomUpdated", ({ room }) =>
    dispatcher.dispatch({ type: "LOBBY_ROOM_UPDATED", room }),
  );
  realtime.on("lobby:roomRemoved", ({ roomId }) =>
    dispatcher.dispatch({ type: "LOBBY_ROOM_REMOVED", roomId }),
  );
  realtime.on("room:updated", ({ room }) => dispatcher.dispatch({ type: "ROOM_UPDATED", room }));
  realtime.on("room:gameStarted", ({ gameId }) =>
    dispatcher.dispatch({ type: "GAME_STARTED", gameId }),
  );
  realtime.on("game:updated", ({ game }) => dispatcher.dispatch({ type: "GAME_UPDATED", game }));
  realtime.on("game:kicked", ({ gameId }) => dispatcher.dispatch({ type: "GAME_KICKED", gameId }));
  realtime.on("game:ended", ({ gameId, status }) =>
    dispatcher.dispatch({ type: "GAME_ENDED", gameId, status }),
  );
}
