import type { AdminUser, AdminUserListQuery } from "@podrida/shared";
import type { Reducer } from "../../flux/createStore";

// Users the admin pages have seen, by id, so the list and the detail page always show the same
// data: an action on the detail page updates the list row too.
export interface AdminUsersState {
  byId: Record<string, AdminUser>;
  list: {
    ids: string[];
    query: AdminUserListQuery | null; // What `ids` is the result of.
    total: number;
    totalPages: number;
    status: "idle" | "loading" | "loaded" | "error";
    error: unknown;
  };
}

export type AdminUsersAction =
  | { type: "ADMIN_USERS_LOADING"; query: AdminUserListQuery }
  | {
      type: "ADMIN_USERS_LOADED";
      query: AdminUserListQuery;
      users: AdminUser[];
      total: number;
      totalPages: number;
    }
  | { type: "ADMIN_USERS_LOAD_FAILED"; query: AdminUserListQuery; error: unknown }
  | { type: "ADMIN_USER_LOADED"; user: AdminUser }
  | { type: "ADMIN_USER_UPDATED"; userId: string; changes: Partial<AdminUser> }
  | { type: "ADMIN_USER_REMOVED"; userId: string };

export const initialAdminUsersState: AdminUsersState = {
  byId: {},
  list: { ids: [], query: null, total: 0, totalPages: 0, status: "idle", error: null },
};

const isSameQuery = (a: AdminUserListQuery | null, b: AdminUserListQuery) =>
  JSON.stringify(a) === JSON.stringify(b);

export const adminUsersReducer: Reducer<AdminUsersState> = (state, action) => {
  switch (action.type) {
    case "ADMIN_USERS_LOADING":
      return {
        ...state,
        list: { ...state.list, query: action.query, status: "loading", error: null },
      };

    case "ADMIN_USERS_LOADED": {
      // An answer to an older query that arrived late.
      if (!isSameQuery(state.list.query, action.query)) return state;

      const byId = { ...state.byId };
      action.users.forEach((user) => {
        byId[user.id] = user;
      });

      return {
        byId,
        list: {
          ids: action.users.map(({ id }) => id),
          query: action.query,
          total: action.total,
          totalPages: action.totalPages,
          status: "loaded",
          error: null,
        },
      };
    }

    case "ADMIN_USERS_LOAD_FAILED":
      if (!isSameQuery(state.list.query, action.query)) return state;
      return { ...state, list: { ...state.list, status: "error", error: action.error } };

    case "ADMIN_USER_LOADED":
      return { ...state, byId: { ...state.byId, [action.user.id]: action.user } };

    case "ADMIN_USER_UPDATED": {
      const user = state.byId[action.userId];
      if (!user) return state;
      return { ...state, byId: { ...state.byId, [action.userId]: { ...user, ...action.changes } } };
    }

    case "ADMIN_USER_REMOVED": {
      const { [action.userId]: _removed, ...byId } = state.byId;
      return {
        byId,
        list: {
          ...state.list,
          ids: state.list.ids.filter((id) => id !== action.userId),
          total: Math.max(0, state.list.total - 1),
        },
      };
    }

    case "SESSION_STARTED":
    case "SESSION_ENDED":
      return initialAdminUsersState;

    default:
      return state;
  }
};
