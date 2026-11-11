import {
  endpoints,
  type MyUser,
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
};
