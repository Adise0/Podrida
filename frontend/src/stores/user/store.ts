import { createStore } from "../../flux/createStore";
import { initialUserState, userReducer } from "./reducer";

export const userStore = createStore("User", userReducer, () => initialUserState);

export const useUser = userStore.useStoreState;
