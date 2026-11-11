import {
  endpoints,
  type ChangePasswordData,
  type DeleteAccountResponse,
  type LoginData,
  type MessageResponse,
  type RegistrationData,
  type TokenResponse,
} from "@podrida/shared";
import { request } from "./client";

const { auth } = endpoints;
const path = (endpoint: string) => `${auth.path}${endpoint}`;

export const authApi = {
  // The app doesn't use 2FA, so a login always answers a session (the API only asks for a 2FA
  // code from accounts that turned it on).
  login: (data: LoginData) =>
    request<TokenResponse>(path(auth.login), { method: "POST", body: data }),

  refreshToken: () => request<TokenResponse>(path(auth.refreshToken), { auth: true }),

  register: (data: RegistrationData) =>
    request<MessageResponse>(path(auth.register), { method: "POST", body: data }),

  // Answers with DUPLICATE_KEY (see "fields") when one of them is taken.
  checkKeys: (keys: { email?: string; username?: string }) =>
    request<MessageResponse>(path(auth.checkKeys), { method: "POST", body: keys }),

  activate: (token: string) =>
    request<TokenResponse>(path(auth.activate), { method: "POST", body: { token } }),

  cancelRegistration: (token: string) =>
    request<MessageResponse>(path(auth.cancelRegistration), { method: "POST", body: { token } }),

  // The three "email me something" endpoints take an email or a username, and always answer 202.
  resendActivation: (emailOrUsername: string) =>
    request<MessageResponse>(path(auth.resendActivation), {
      method: "POST",
      body: { email: emailOrUsername },
    }),

  requestOtp: (emailOrUsername: string) =>
    request<MessageResponse>(path(auth.requestOtp), {
      method: "POST",
      body: { email: emailOrUsername },
    }),

  requestPasswordReset: (emailOrUsername: string) =>
    request<MessageResponse>(path(auth.requestPasswordReset), {
      method: "POST",
      body: { email: emailOrUsername },
    }),

  revokeOtp: (token: string) =>
    request<MessageResponse>(path(auth.revokeOtp), { method: "POST", body: { token } }),

  resetPassword: (token: string, password: string) =>
    request<MessageResponse>(path(auth.resetPassword), {
      method: "POST",
      body: { token, password },
    }),

  cancelPasswordReset: (token: string) =>
    request<MessageResponse>(path(auth.cancelPasswordReset), { method: "POST", body: { token } }),

  changePassword: (data: ChangePasswordData) =>
    request<TokenResponse>(path(auth.changePassword), { method: "POST", body: data, auth: true }),

  requestEmailChange: (email: string) =>
    request<MessageResponse>(path(auth.requestEmailChange), {
      method: "POST",
      body: { email },
      auth: true,
    }),

  confirmEmailChange: (token: string) =>
    request<MessageResponse>(path(auth.confirmEmailChange), { method: "POST", body: { token } }),

  deleteAccount: () =>
    request<DeleteAccountResponse>(path(auth.deleteAccount), { method: "DELETE", auth: true }),

  // `token` signs out that session instead of the current one (used after a re-login).
  logout: (token?: string) =>
    request<MessageResponse>(path(auth.logout), {
      method: "POST",
      ...(token ? { token } : { auth: true }),
    }),

  signOutEverywhere: () =>
    request<MessageResponse>(path(auth.signOutEverywhere), { method: "POST", auth: true }),
};
