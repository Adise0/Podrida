import { NextFunction, Request, Response } from "express";
import { getUserNotFoundForIdError } from "../../../data/errorObjects/userErrors";
import Users from "../../../database/models/Users";
import { getAvatarFields, getAvatarUrl } from "../../utils/users/avatar";

// Sets (or replaces) the logged in user's avatar. The body went through the avatarUploadDataValidator.
const updateMyAvatar = async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = res.locals; // Grab the userId left by the tokenValidator.

  try {
    const fields = getAvatarFields(req.body);
    const updatedUser = await Users.findByIdAndUpdate(userId, { $set: fields }).select("_id");

    // If no user matches the token's id write the error and go next.
    if (!updatedUser) {
      next(getUserNotFoundForIdError(userId));
      return;
    }

    res.json({ avatarUrl: getAvatarUrl(updatedUser.id, fields.avatar) });
  } catch (error) {
    next(error);
  }
};

export default updateMyAvatar;
