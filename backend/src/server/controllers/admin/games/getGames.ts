import { NextFunction, Request, Response } from "express";
import Games from "../../../../database/models/Games";
import toAdminGame from "./toAdminGame";

// Lists games, newest first.
const getGames = async (_req: Request, res: Response, next: NextFunction) => {
  const { page, limit, status, playerId } = res.locals.listQuery;

  const filter: Record<string, unknown> = {};

  if (status) {
    filter.status = status;
  }

  if (playerId) {
    filter["players.user"] = playerId;
  }

  try {
    const [games, total] = await Promise.all([
      Games.find(filter)
        .sort({ startedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Games.countDocuments(filter),
    ]);

    res.json({
      games: games.map(toAdminGame),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

export default getGames;
