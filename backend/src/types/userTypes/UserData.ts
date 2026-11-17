import DatabaseUserData from "./DatabaseUserData";

// This is a type for the user you want to manage internally, independent of the database schema
interface UserData {
  id?: string;
  information: {
    firstName: string;
    lastName: string;
    email: string;
    username: string;
  };

  isDisabled: boolean;
  resetPasswordOnLogin: boolean;
  isVerified: boolean;
}

// The avatar fields are only there when the registration came with one.
export interface CreatedUserData extends Partial<
  Pick<DatabaseUserData, "avatar" | "avatarImage" | "avatarSource">
> {
  _id?: string;
  information: {
    firstName?: string;
    lastName?: string;
    email: string;
    username: string;
  };

  credentials: {
    email: string;
    password?: string;
    otpPassword?: string;
    username: string;
  };

  isDisabled: boolean;
  resetPasswordOnLogin: boolean;
}

export default UserData;
