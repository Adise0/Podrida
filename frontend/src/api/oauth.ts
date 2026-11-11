import {
  endpoints,
  type MessageResponse,
  type OAuthAuthorizationUrlResponse,
  type OAuthProvidersResponse,
  type OAuthSignupRequiredResponse,
  type OAuthSignupData,
  type TokenResponse,
} from "@podrida/shared";
import { request, withParams } from "./client";

const { oauth } = endpoints;
const path = (endpoint: string, provider?: string) =>
  `${oauth.path}${provider ? withParams(endpoint, { provider }) : endpoint}`;

export interface OAuthCodeData {
  code: string;
  nonce: string;
  codeVerifier?: string;
  firstName?: string; // Apple only sends the name to the frontend, on the first sign-in.
  lastName?: string;
}

export const oauthApi = {
  providers: () => request<OAuthProvidersResponse>(path(oauth.providers)),

  authorizationUrl: (
    provider: string,
    query: { state: string; nonce: string; codeChallenge?: string },
  ) => request<OAuthAuthorizationUrlResponse>(path(oauth.authorizationUrl, provider), { query }),

  // A session, or the signup step for a first sign-in (no 2FA, see authApi.login).
  login: (provider: string, data: OAuthCodeData) =>
    request<TokenResponse | OAuthSignupRequiredResponse>(path(oauth.login, provider), {
      method: "POST",
      body: data,
    }),

  completeSignup: (data: OAuthSignupData) =>
    request<TokenResponse>(path(oauth.completeSignup), { method: "POST", body: data }),

  link: (provider: string, data: OAuthCodeData) =>
    request<MessageResponse>(path(oauth.link, provider), {
      method: "POST",
      body: data,
      auth: true,
    }),

  unlink: (provider: string) =>
    request<MessageResponse>(path(oauth.link, provider), { method: "DELETE", auth: true }),
};
