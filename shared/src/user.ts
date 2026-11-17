// SUPERUSER can only be set directly in the database, no endpoint can grant it.
export enum UserRole {
  user = "USER",
  admin = "ADMIN",
  superuser = "SUPERUSER",
}

// Which part of the original picture the avatar shows: a square centered on (x, y), which are
// fractions (0 to 1) of the original's width and height. zoom 1 is the largest square that fits,
// zoom 2 one half as wide, and so on.
export interface AvatarCrop {
  x: number;
  y: number;
  zoom: number;
}

// Avatars are cropped in the browser. Both pictures are data URLs (PNG, JPEG or WebP): image is
// the square avatar everyone sees (shown rounded), source the original it was cut from (downscaled)
// with the crop, so it can be re-framed later.
export interface AvatarUpload {
  image: string;
  source: string;
  crop: AvatarCrop;
}

// The size limits of an AvatarUpload, checked by the API (the decoded bytes, not the data URL).
export const avatarLimits = <const>{
  imageSize: 256, // Width and height of the square avatar, in pixels.
  sourceMaxSize: 1024, // Longest side of the original, in pixels.
  imageMaxBytes: 150 * 1024,
  sourceMaxBytes: 700 * 1024,
  maxZoom: 5,
};

// The type for the data you want as the user's registration data
export interface RegistrationData {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  username: string;
  avatar?: AvatarUpload;
}

export interface LoginData {
  email: string; // Can also be the username.
  password: string;
  withOtp?: boolean;
}

// What GET /users/myUser answers with.
export interface MyUser {
  id: string;
  information: {
    firstName?: string;
    lastName?: string;
    email: string;
    username: string;
  };
  // Path of the avatar on the API (eg. "/users/avatars/<id>?v=..."), missing without one. It
  // changes with every new avatar, so it can be cached forever.
  avatarUrl?: string;
  role: UserRole;
  hasPassword: boolean; // OAuth-only accounts have none.
  linkedProviders: { provider: string; email?: string; linkedAt: string }[];
  twoFactorEnabled: boolean;
}
