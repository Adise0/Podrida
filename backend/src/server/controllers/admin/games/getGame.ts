import { NextFunction, Request, Response } from "express";
import { getGameRecordNotFoundError } from "../../../../data/errorObjects/roomErrors";
import Games from "../../../../database/models/Games";
import toAdminGame from "./toAdminGame";

const getGame = async (_req: Request, res: Response, next: NextFunction) => {
  const { requestedGameId } = res.locals;

  try {
    const game = await Games.findById(requestedGameId);

    if (!game) {
      next(getGameRecordNotFoundError());
      return;
    }

    res.json(toAdminGame(game));
  } catch (error) {
    next(error);
  }
};

export default getGame;
