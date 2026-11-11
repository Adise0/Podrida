import { createStore } from "../../flux/createStore";
import { initialNotificationsState, notificationsReducer } from "./reducer";

export const notificationsStore = createStore(
  "Notifications",
  notificationsReducer,
  () => initialNotificationsState,
);

export const useNotifications = notificationsStore.useStoreState;
