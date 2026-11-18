import { NextFunction, Request, Response } from "express";
import Users from "../../../database/models/Users";
import { notifySessionsChanged } from "../../utils/auth/sessionEvents";

// Signs the logged in user out of every session, the current one included, by bumping the
// tokenVersion so every previously issued auth token stops being accepted.
const signOutEverywhere = async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = res.locals; // Grab the userId left by the tokenValidator.

  try {
    await Users.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
    notifySessionsChanged(userId); // Closes its open connections.

    res.status(200).json({
      message: "Signed out of every session",
    });
  } catch (error) {
    next(error);
  }
};

export default signOutEverywhere;
