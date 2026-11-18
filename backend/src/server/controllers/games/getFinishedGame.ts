import { GameStatus } from "@podrida/shared";
import { NextFunction, Request, Response } from "express";
import { getGameRecordNotFoundError } from "../../../data/errorObjects/roomErrors";
import Games from "../../../database/models/Games";
import { getAvatarUrls, toFinishedGameDetails } from "./toFinishedGame";

// One finished game, round by round. Only for the people who played it: anyone else gets the
// same 404 as for a game that doesn't exist.
const getFinishedGame = async (_req: Request, res: Response, next: NextFunction) => {
  const { userId, requestedGameId } = res.locals;

  try {
    const game = await Games.findOne({
      _id: requestedGameId,
      status: GameStatus.finished,
      "players.user": userId,
    });

    if (!game) {
      next(getGameRecordNotFoundError());
      return;
    }

    res.json(toFinishedGameDetails(game, await getAvatarUrls([game])));
  } catch (error) {
    next(error);
  }
};

export default getFinishedGame;
