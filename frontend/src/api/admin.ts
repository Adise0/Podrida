import {
  endpoints,
  type AdminUser,
  type AdminUserListQuery,
  type AdminUserListResponse,
  type ChangeUserRoleData,
  type MessageResponse,
  type UpdateProfileData,
  type UpdateProfileResponse,
} from "@podrida/shared";
import { request, withParams } from "./client";

const { admin } = endpoints;
const path = (endpoint: string, userId?: string) =>
  `${admin.path}${userId ? withParams(endpoint, { userId }) : endpoint}`;

const post = (endpoint: string, userId: string) =>
  request<MessageResponse>(path(endpoint, userId), { method: "POST", auth: true });

export const adminApi = {
  listUsers: (query: AdminUserListQuery) =>
    request<AdminUserListResponse>(path(admin.users), { query: { ...query }, auth: true }),

  getUser: (userId: string) => request<AdminUser>(path(admin.user, userId), { auth: true }),

  updateUser: (userId: string, data: UpdateProfileData) =>
    request<UpdateProfileResponse>(path(admin.user, userId), {
      method: "PATCH",
      body: data,
      auth: true,
    }),

  deleteUser: (userId: string) =>
    request<MessageResponse>(path(admin.user, userId), { method: "DELETE", auth: true }),

  disableUser: (userId: string) => post(admin.disableUser, userId),
  enableUser: (userId: string) => post(admin.enableUser, userId),
  signOutUser: (userId: string) => post(admin.signOutUser, userId),
  forcePasswordReset: (userId: string) => post(admin.forcePasswordReset, userId),

  changeRole: (userId: string, data: ChangeUserRoleData) =>
    request<MessageResponse>(path(admin.userRole, userId), {
      method: "PATCH",
      body: data,
      auth: true,
    }),
};
