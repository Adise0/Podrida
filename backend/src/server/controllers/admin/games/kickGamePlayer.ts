import { NextFunction, Request, Response } from "express";
import Games from "../../../../database/models/Games";
import { kickPlayer } from "../../../../realtime/games/gameManager";
import logAdminAction from "../../../utils/logAdminAction";
import getAdminActor from "./getAdminActor";
import toAdminGame from "./toAdminGame";

// Takes a player out of a game that's being played. Admins can kick the host too: the seat passes
// on, and the game ends if nobody is left in it. Answers the game as it is now.
const kickGamePlayer = async (req: Request, res: Response, next: NextFunction) => {
  const { requestedGameId, requestedUserId, userId } = res.locals;

  try {
    await kickPlayer(requestedGameId, requestedUserId, await getAdminActor(userId));

    logAdminAction(req, res, "kickGamePlayer", { gameId: requestedGameId });

    const game = await Games.findById(requestedGameId);
    res.json(game ? toAdminGame(game) : null);
  } catch (error) {
    next(error);
  }
};

export default kickGamePlayer;
