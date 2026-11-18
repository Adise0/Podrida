import { createStore } from "../../flux/createStore";
import { initialPlayState, playReducer } from "./reducer";

export const playStore = createStore("Play", playReducer, () => initialPlayState);

export const usePlay = playStore.useStoreState;
