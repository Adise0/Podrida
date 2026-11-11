import { createStore } from "../../flux/createStore";
import { adminUsersReducer, initialAdminUsersState } from "./reducer";

// Only mounted under /admin: leaving the admin pages drops the data.
export const adminUsersStore = createStore(
  "AdminUsers",
  adminUsersReducer,
  () => initialAdminUsersState,
);

export const AdminUsersProvider = adminUsersStore.Provider;
export const useAdminUsers = adminUsersStore.useStoreState;
