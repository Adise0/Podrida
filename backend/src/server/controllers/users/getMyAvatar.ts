import { NextFunction, Request, Response } from "express";
import { getAvatarNotFoundError } from "../../../data/errorObjects/avatarErrors";
import Users from "../../../database/models/Users";
import { toDataUrl } from "../../utils/users/avatar";

// What the logged in user's avatar was cut from, and how, so it can be re-framed.
const getMyAvatar = async (_req: Request, res: Response, next: NextFunction) => {
  const { userId } = res.locals; // Grab the userId left by the tokenValidator.

  try {
    const foundUser = await Users.findById(userId).select("avatar +avatarSource");

    if (!foundUser?.avatar || !foundUser.avatarSource) {
      next(getAvatarNotFoundError(userId));
      return;
    }

    const { x, y, zoom } = foundUser.avatar.crop;

    res.json({ source: toDataUrl(foundUser.avatarSource), crop: { x, y, zoom } });
  } catch (error) {
    next(error);
  }
};

export default getMyAvatar;
