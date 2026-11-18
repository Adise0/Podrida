import { NextFunction, Request, Response } from "express";
import Games from "../../../../database/models/Games";
import { endGameEarly } from "../../../../realtime/games/gameManager";
import logAdminAction from "../../../utils/logAdminAction";
import getAdminActor from "./getAdminActor";
import toAdminGame from "./toAdminGame";

// Force-ends a game that's being played. Answers the game as it is now.
const endGame = async (req: Request, res: Response, next: NextFunction) => {
  const { requestedGameId, userId } = res.locals;

  try {
    await endGameEarly(requestedGameId, await getAdminActor(userId));

    logAdminAction(req, res, "endGame", { gameId: requestedGameId });

    const game = await Games.findById(requestedGameId);
    res.json(game ? toAdminGame(game) : null);
  } catch (error) {
    next(error);
  }
};

export default endGame;
