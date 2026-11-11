// Every action of the app. Each store declares its own, this is just the union the dispatcher
// carries, so every reducer can also react to the actions of other stores (eg. SESSION_ENDED).
import type { AdminUsersAction } from "../stores/adminUsers/reducer";
import type { NotificationsAction } from "../stores/notifications/reducer";
import type { ReauthAction } from "../stores/reauth/reducer";
import type { SessionAction } from "../stores/session/reducer";
import type { UserAction } from "../stores/user/reducer";

export type AppAction =
  SessionAction | UserAction | ReauthAction | NotificationsAction | AdminUsersAction;
