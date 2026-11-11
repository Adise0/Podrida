import { createContext, use, useLayoutEffect, useReducer, type ReactNode } from "react";
import type { AppAction } from "./actions";
import { dispatcher } from "./dispatcher";

export type Reducer<State> = (state: State, action: AppAction) => State;

// Builds a Flux store: a reducer living in its own context, registered with the dispatcher.
// Views read it with the returned hook. They never dispatch directly: they call the store's
// action creators, which talk to the API and dispatch through the dispatcher.
export function createStore<State>(
  name: string,
  reducer: Reducer<State>,
  getInitialState: () => State,
) {
  const StateContext = createContext<State | null>(null);
  StateContext.displayName = `${name}State`;

  function StoreProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(reducer, undefined, getInitialState);

    // A layout effect on purpose: React runs every layout effect of a commit before any passive
    // effect, so all the stores in the tree are registered before the first action creator runs
    // (they're only ever called from passive effects and event handlers).
    useLayoutEffect(() => dispatcher.register(dispatch), []);

    return <StateContext value={state}>{children}</StateContext>;
  }

  function useStoreState(): State {
    const state = use(StateContext);

    if (state === null) {
      throw new Error(`The ${name} store was used outside of its provider`);
    }

    return state;
  }

  return { Provider: StoreProvider, useStoreState };
}
