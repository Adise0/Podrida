import { NextFunction, Request, Response } from "express";
import { getAvatarNotFoundError } from "../../../data/errorObjects/avatarErrors";
import Users from "../../../database/models/Users";

// The avatar image itself, for anyone (an <img> can't send the session token). Only active
// accounts have one to show. The URL MyUser gives carries a version (?v=), so that one is cached
// for good; without it the browser checks back every time.
const getAvatar = async (req: Request, res: Response, next: NextFunction) => {
  const { requestedUserId } = res.locals; // Left by the getUserDataValidator.

  try {
    const foundUser = await Users.findOne({
      _id: requestedUserId,
      activatedAt: { $ne: null },
    }).select("+avatarImage");

    if (!foundUser?.avatarImage) {
      next(getAvatarNotFoundError(requestedUserId));
      return;
    }

    const isVersioned = typeof req.query.v === "string";

    res.set({
      "Content-Type": foundUser.avatarImage.contentType,
      "Cache-Control": isVersioned ? "public, max-age=31536000, immutable" : "no-cache",
      // Helmet only allows same-origin by default, and the frontend is on another origin.
      "Cross-Origin-Resource-Policy": "cross-origin",
    });
    res.send(foundUser.avatarImage.data);
  } catch (error) {
    next(error);
  }
};

export default getAvatar;
