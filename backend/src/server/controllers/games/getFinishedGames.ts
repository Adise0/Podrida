import { GameStatus } from "@podrida/shared";
import { NextFunction, Request, Response } from "express";
import Games from "../../../database/models/Games";
import { getAvatarUrls, toFinishedGameSummary } from "./toFinishedGame";

// The logged in user's games that were played to the end, newest first, with the final scores.
const getFinishedGames = async (_req: Request, res: Response, next: NextFunction) => {
  const { userId } = res.locals;
  const { page, limit } = res.locals.listQuery;
  const filter = { status: GameStatus.finished, "players.user": userId };

  try {
    const [games, total] = await Promise.all([
      Games.find(filter)
        .select("-rounds") // Not needed for the list, and it's the bulk of a record.
        .sort({ startedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Games.countDocuments(filter),
    ]);

    const avatarUrls = await getAvatarUrls(games);

    res.json({
      games: games.map((game) => toFinishedGameSummary(game, avatarUrls)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

export default getFinishedGames;
