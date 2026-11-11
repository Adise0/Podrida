import type { MyUser } from "@podrida/shared";
import type { Reducer } from "../../flux/createStore";

// The logged in user (GET /users/myUser).
export interface UserState {
  user: MyUser | null;
  // A reload keeps the current user on screen while it runs: only the first load blocks the app.
  status: "idle" | "loading" | "loaded" | "error";
  error: unknown;
}

export type UserAction =
  | { type: "USER_LOADING" }
  | { type: "USER_LOADED"; user: MyUser }
  | { type: "USER_LOAD_FAILED"; error: unknown }
  | { type: "USER_UPDATED"; changes: Partial<MyUser> };

export const initialUserState: UserState = { user: null, status: "idle", error: null };

export const userReducer: Reducer<UserState> = (state, action) => {
  switch (action.type) {
    case "USER_LOADING":
      return { ...state, status: "loading", error: null };

    case "USER_LOADED":
      return { user: action.user, status: "loaded", error: null };

    case "USER_LOAD_FAILED":
      return { ...state, status: "error", error: action.error };

    case "USER_UPDATED":
      return state.user ? { ...state, user: { ...state.user, ...action.changes } } : state;

    // A new login may be someone else, and a logout leaves nobody.
    case "SESSION_STARTED":
    case "SESSION_ENDED":
      return initialUserState;

    default:
      return state;
  }
};
