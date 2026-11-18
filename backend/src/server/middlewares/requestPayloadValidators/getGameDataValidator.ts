import { NextFunction, Request, Response } from "express";
import { getValidationError } from "../../../data/errorObjects/dataValidationErrors";
import getGameData from "../../../data/joiObjects/getGameData";
import joiValidationOptions from "../../../data/joiObjects/joiValidationOptions";

// Leaves the game id in res.locals.requestedGameId, and the player's (if the route has one) in
// res.locals.requestedUserId, which the admin audit log reads as the target.
const getGameDataValidator = (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = getGameData.validate(req.params, joiValidationOptions);

  if (error) {
    next(getValidationError(error, "get game"));
    return;
  }

  res.locals.requestedGameId = value.gameId;
  res.locals.requestedUserId = value.userId;
  next();
};

export default getGameDataValidator;
