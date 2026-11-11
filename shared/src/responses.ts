// What the API answers on success, endpoint by endpoint. Error answers are always a ResponseError
// (see errors.ts).
import type { MyUser } from "./user";

// Most endpoints that only do something answer with a human-readable message.
export interface MessageResponse {
  message: string;
}

// A new session: login, refresh, activation, 2FA verify, OAuth login/signup, change password.
export interface TokenResponse {
  token: string;
}

// The login (password, OTP or OAuth) of a user with 2FA on answers this instead of a session.
// POST /auth/twoFactor/verify trades the token, plus a code, for the session.
export interface TwoFactorChallengeResponse {
  twoFactorRequired: true;
  twoFactorToken: string;
}

export type LoginResponse = TokenResponse | TwoFactorChallengeResponse;

// First sign-in with a provider: the user picks a username, then POST /auth/oauth/completeSignup.
// The rest is what the provider said, to pre-fill the form.
export interface OAuthSignupRequiredResponse {
  signupRequired: true;
  signupToken: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export type OAuthLoginResponse = LoginResponse | OAuthSignupRequiredResponse;

export interface OAuthProviderInfo {
  name: string;
  supportsPkce: boolean;
}

export interface OAuthProvidersResponse {
  providers: OAuthProviderInfo[];
}

export interface OAuthAuthorizationUrlResponse {
  url: string;
}

export interface OAuthSignupData {
  token: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

export interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string; // Show it as a QR code.
}

// POST /auth/twoFactor/enable (with a message) and /backupCodes. They're only ever shown this once.
export interface BackupCodesResponse {
  backupCodes: string[];
}

// No scheduledDeletionAt when the server deletes accounts right away.
export interface DeleteAccountResponse extends MessageResponse {
  scheduledDeletionAt?: string;
}

// PATCH /users/myUser and PATCH /admin/users/:userId. Every field is optional, at least one is needed.
export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  username?: string;
}

export interface UpdateProfileResponse {
  id: string;
  information: MyUser["information"];
}

export interface ChangePasswordData {
  password: string;
  signOutOtherSessions?: boolean; // Defaults to true.
}
