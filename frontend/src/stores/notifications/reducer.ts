import type { Reducer } from "../../flux/createStore";

export type NotificationTone = "info" | "success" | "error";

export interface Notification {
  id: number;
  tone: NotificationTone;
  message: string;
}

// Toasts: feedback that has to outlive the component that triggered it (a redirect, a closing
// modal, a table row). Form errors stay inline.
export interface NotificationsState {
  items: Notification[];
}

export type NotificationsAction =
  | { type: "NOTIFICATION_ADDED"; notification: Notification }
  | { type: "NOTIFICATION_DISMISSED"; id: number };

const maxVisible = 4;

export const initialNotificationsState: NotificationsState = { items: [] };

export const notificationsReducer: Reducer<NotificationsState> = (state, action) => {
  switch (action.type) {
    case "NOTIFICATION_ADDED":
      return { items: [...state.items, action.notification].slice(-maxVisible) };

    case "NOTIFICATION_DISMISSED":
      return { items: state.items.filter(({ id }) => id !== action.id) };

    default:
      return state;
  }
};
