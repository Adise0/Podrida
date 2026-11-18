import { HydratedDocument } from "mongoose";
import UserRole from "./UserRole";

export interface AvatarFile {
  contentType: string; // image/png, image/jpeg or image/webp.
  data: Buffer;
}

// This is a type for the expected object received from the database
interface DatabaseUserData {
  information: {
    firstName?: string;
    lastName?: string;
    email: string;
    username: string; // As the user typed it, for display only.
  };

  credentials: {
    email: string;
    password?: string;
    otpPassword?: string;
    otpExpiresAt?: Date;
    otpAttempts: number;
    otpLastSentAt?: Date;
    username: string; // Lowercased, it's what logins and uniqueness go by.
  };

  // Set together, or not at all. The two files aren't loaded unless a query asks for them.
  avatar?: {
    crop: { x: number; y: number; zoom: number };
    updatedAt: Date;
  };
  avatarImage?: AvatarFile; // The square avatar everyone sees.
  avatarSource?: AvatarFile; // What it was cut from, to re-frame it.

  role: UserRole;
  isDisabled: boolean;
  resetPasswordOnLogin: boolean;
  activatedAt?: Date;
  verificationToken?: string;
  activationLastSentAt?: Date;
  pendingExpiresAt?: Date;
  otpRevokeToken?: string;
  resetPasswordToken?: string;
  resetPasswordLastSentAt?: Date;
  pendingEmail?: string;
  emailChangeToken?: string;
  emailChangeLastSentAt?: Date;
  scheduledDeletionAt?: Date;
  oauthAccounts: { provider: string; providerId: string; email?: string; linkedAt: Date }[];
  twoFactor: {
    secret?: string; // Encrypted, see twoFactorSecret.ts.
    pendingSecret?: string; // Encrypted. Between setup and enable.
    enabledAt?: Date;
    backupCodes: string[]; // SHA-256 hashes, each one works once.
    lastUsedStep?: number; // Last TOTP time step accepted, so a code can't be replayed.
    challengeId?: string;
    challengeAttempts: number;
  };
  revokedSessions: { sessionId: string; expiresAt: Date }[];
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<DatabaseUserData>;

export default DatabaseUserData;
