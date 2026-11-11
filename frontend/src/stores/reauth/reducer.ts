import type { Reducer } from "../../flux/createStore";

// Whether the "confirm it's you" modal is up. The requests waiting on it live in actions.ts.
export interface ReauthState {
  isOpen: boolean;
}

export type ReauthAction = { type: "REAUTH_REQUESTED" } | { type: "REAUTH_FINISHED" };

export const initialReauthState: ReauthState = { isOpen: false };

export const reauthReducer: Reducer<ReauthState> = (state, action) => {
  switch (action.type) {
    case "REAUTH_REQUESTED":
      return { isOpen: true };

    case "REAUTH_FINISHED":
    case "SESSION_ENDED":
      return { isOpen: false };

    default:
      return state;
  }
};
