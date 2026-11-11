// The admin side of the contract (everything under /admin).
import type { MyUser, UserRole } from "./user";

// What an admin gets to see of a user (dates are ISO strings).
export interface AdminUser {
  id: string;
  information: MyUser["information"];
  role: UserRole;
  isDisabled: boolean;
  activatedAt?: string; // Missing while the account is pending activation.
  resetPasswordOnLogin?: boolean; // An admin forced a password reset that hasn't happened yet.
  scheduledDeletionAt?: string; // The owner deleted it, logging in before this cancels it.
  createdAt: string;
  updatedAt: string;
}

// GET /admin/users query string. search matches the start of the email or username.
export interface AdminUserListQuery {
  page?: number;
  limit?: number; // At most 100.
  search?: string;
  role?: UserRole;
  isDisabled?: boolean;
  isActivated?: boolean;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// SUPERUSER can't be granted through the API.
export interface ChangeUserRoleData {
  role: UserRole.user | UserRole.admin;
}
