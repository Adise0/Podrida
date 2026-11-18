import {
  endpoints,
  type AdminGame,
  type AdminGameListQuery,
  type AdminGameListResponse,
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

const gamePath = (endpoint: string, params: { gameId: string; userId?: string }) =>
  `${admin.path}${withParams(endpoint, { userId: "", ...params })}`;

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

  listGames: (query: AdminGameListQuery) =>
    request<AdminGameListResponse>(path(admin.games), { query: { ...query }, auth: true }),

  getGame: (gameId: string) => request<AdminGame>(gamePath(admin.game, { gameId }), { auth: true }),

  // Both only work on games being played, and answer the game as it is afterwards.
  endGame: (gameId: string) =>
    request<AdminGame>(gamePath(admin.endGame, { gameId }), { method: "POST", auth: true }),

  kickGamePlayer: (gameId: string, userId: string) =>
    request<AdminGame>(gamePath(admin.kickPlayer, { gameId, userId }), {
      method: "POST",
      auth: true,
    }),
};
