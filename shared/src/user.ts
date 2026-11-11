// SUPERUSER can only be set directly in the database, no endpoint can grant it.
export enum UserRole {
  user = "USER",
  admin = "ADMIN",
  superuser = "SUPERUSER",
}

// The type for the data you want as the user's registration data
export interface RegistrationData {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  username: string;
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
  role: UserRole;
  hasPassword: boolean; // OAuth-only accounts have none.
  linkedProviders: { provider: string; email?: string; linkedAt: string }[];
  twoFactorEnabled: boolean;
}
