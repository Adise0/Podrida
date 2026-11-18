import { createStore } from "../../flux/createStore";
import { initialLobbyState, lobbyReducer } from "./reducer";

export const lobbyStore = createStore("Lobby", lobbyReducer, () => initialLobbyState);

export const useLobby = lobbyStore.useStoreState;
