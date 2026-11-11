import { createStore } from "../../flux/createStore";
import { getInitialSessionState, sessionReducer } from "./reducer";

export const sessionStore = createStore("Session", sessionReducer, getInitialSessionState);

export const useSession = sessionStore.useStoreState;
