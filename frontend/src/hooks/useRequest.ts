import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { isReauthCancelled } from "../api/client";

export type RequestStatus = "idle" | "pending" | "success" | "error";

export type RequestResult<Result> = { ok: true; data: Result } | { ok: false; error: unknown };

interface RequestState<Result> {
  status: RequestStatus;
  data: Result | undefined;
  error: unknown;
}

// Local state for a one-off call (a form submit, an email link). Data that other parts of the app
// need goes through a store's action creator instead, which this can still wrap.
export function useRequest<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>,
) {
  const [state, setState] = useState<RequestState<Result>>({
    status: "idle",
    data: undefined,
    error: null,
  });

  const actionRef = useRef(action);
  useLayoutEffect(() => {
    actionRef.current = action;
  });

  const run = useCallback(async (...args: Args): Promise<RequestResult<Result>> => {
    setState((current) => ({ ...current, status: "pending", error: null }));

    try {
      const data = await actionRef.current(...args);
      setState({ status: "success", data, error: null });
      return { ok: true, data };
    } catch (error) {
      // Closing the "confirm it's you" modal just puts the form back as it was.
      setState(
        isReauthCancelled(error)
          ? { status: "idle", data: undefined, error: null }
          : { status: "error", data: undefined, error },
      );
      return { ok: false, error };
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle", data: undefined, error: null }), []);

  return { ...state, isPending: state.status === "pending", run, reset };
}
