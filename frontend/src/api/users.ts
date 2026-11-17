import {
  endpoints,
  type AvatarSourceResponse,
  type AvatarUpload,
  type MessageResponse,
  type MyUser,
  type UpdateAvatarResponse,
  type UpdateProfileData,
  type UpdateProfileResponse,
} from "@podrida/shared";
import { request } from "./client";

const { users } = endpoints;
const path = (endpoint: string) => `${users.path}${endpoint}`;

export const usersApi = {
  getMyUser: () => request<MyUser>(path(users.myUser), { auth: true }),

  updateMyUser: (data: UpdateProfileData) =>
    request<UpdateProfileResponse>(path(users.myUser), { method: "PATCH", body: data, auth: true }),

  // What the avatar was cut from, to re-frame it.
  getMyAvatarSource: () => request<AvatarSourceResponse>(path(users.myAvatar), { auth: true }),

  updateMyAvatar: (data: AvatarUpload) =>
    request<UpdateAvatarResponse>(path(users.myAvatar), { method: "PUT", body: data, auth: true }),

  deleteMyAvatar: () =>
    request<MessageResponse>(path(users.myAvatar), { method: "DELETE", auth: true }),
};
