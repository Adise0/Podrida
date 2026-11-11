import { isReauthCancelled } from "../../api/client";
import { getErrorMessage } from "../../api/errorMessages";
import { dispatcher } from "../../flux/dispatcher";
import type { NotificationTone } from "./reducer";

let nextId = 1;

export function notify(message: string, tone: NotificationTone = "info") {
  dispatcher.dispatch({
    type: "NOTIFICATION_ADDED",
    notification: { id: nextId++, tone, message },
  });
}

// Giving up on the "confirm it's you" modal isn't an error worth a toast.
export function notifyError(error: unknown) {
  if (isReauthCancelled(error)) return;
  notify(getErrorMessage(error), "error");
}

export function dismissNotification(id: number) {
  dispatcher.dispatch({ type: "NOTIFICATION_DISMISSED", id });
}
