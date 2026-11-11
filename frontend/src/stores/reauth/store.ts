import { createStore } from "../../flux/createStore";
import { initialReauthState, reauthReducer } from "./reducer";

export const reauthStore = createStore("Reauth", reauthReducer, () => initialReauthState);

export const useReauth = reauthStore.useStoreState;
