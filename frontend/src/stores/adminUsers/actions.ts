import type { AdminUser, AdminUserListQuery, UpdateProfileData, UserRole } from "@podrida/shared";
import { adminApi } from "../../api/admin";
import { dispatcher } from "../../flux/dispatcher";

export async function loadAdminUsers(query: AdminUserListQuery) {
  dispatcher.dispatch({ type: "ADMIN_USERS_LOADING", query });

  try {
    const { users, total, totalPages } = await adminApi.listUsers(query);
    dispatcher.dispatch({ type: "ADMIN_USERS_LOADED", query, users, total, totalPages });
  } catch (error) {
    dispatcher.dispatch({ type: "ADMIN_USERS_LOAD_FAILED", query, error });
  }
}

// Throws, so the page can tell "not found" from the rest.
export async function loadAdminUser(userId: string) {
  const user = await adminApi.getUser(userId);
  dispatcher.dispatch({ type: "ADMIN_USER_LOADED", user });
}

const updated = (userId: string, changes: Partial<AdminUser>) =>
  dispatcher.dispatch({ type: "ADMIN_USER_UPDATED", userId, changes });

export async function updateAdminUserProfile(userId: string, data: UpdateProfileData) {
  const { information } = await adminApi.updateUser(userId, data);
  updated(userId, { information });
}

export async function disableAdminUser(userId: string) {
  await adminApi.disableUser(userId);
  updated(userId, { isDisabled: true });
}

export async function enableAdminUser(userId: string) {
  await adminApi.enableUser(userId);
  updated(userId, { isDisabled: false });
}

export async function signOutAdminUser(userId: string) {
  await adminApi.signOutUser(userId);
}

export async function forceAdminUserPasswordReset(userId: string) {
  await adminApi.forcePasswordReset(userId);
  updated(userId, { resetPasswordOnLogin: true });
}

export async function changeAdminUserRole(userId: string, role: UserRole.user | UserRole.admin) {
  await adminApi.changeRole(userId, { role });
  updated(userId, { role });
}

export async function deleteAdminUser(userId: string) {
  await adminApi.deleteUser(userId);
  dispatcher.dispatch({ type: "ADMIN_USER_REMOVED", userId });
}
