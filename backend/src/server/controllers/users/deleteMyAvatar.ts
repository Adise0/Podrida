import { NextFunction, Request, Response } from "express";
import { getUserNotFoundForIdError } from "../../../data/errorObjects/userErrors";
import Users from "../../../database/models/Users";
import { avatarFieldsToUnset } from "../../utils/users/avatar";

// Removes the logged in user's avatar. Not having one isn't an error, there's just nothing to do.
const deleteMyAvatar = async (_req: Request, res: Response, next: NextFunction) => {
  const { userId } = res.locals; // Grab the userId left by the tokenValidator.

  try {
    const updatedUser = await Users.findByIdAndUpdate(userId, {
      $unset: avatarFieldsToUnset,
    }).select("_id");

    // If no user matches the token's id write the error and go next.
    if (!updatedUser) {
      next(getUserNotFoundForIdError(userId));
      return;
    }

    res.json({ message: "Avatar removed" });
  } catch (error) {
    next(error);
  }
};

export default deleteMyAvatar;
