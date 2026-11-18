import express from "express";
import { endpoints } from "../../data/serverConfig/endpoints";
import getFinishedGame from "../controllers/games/getFinishedGame";
import getFinishedGames from "../controllers/games/getFinishedGames";
import tokenValidator from "../middlewares/auth/tokenValidator";
import method, { Methods } from "../middlewares/method";
import gameListDataValidator from "../middlewares/requestPayloadValidators/gameListDataValidator";
import getGameDataValidator from "../middlewares/requestPayloadValidators/getGameDataValidator";

// A user's own finished games. Games being played go through the realtime connection instead.
const gamesRouter = express.Router();

const routerEndpoints = endpoints.games;

gamesRouter.use(tokenValidator);

// Shares the admin list's validator for page and limit. Its admin-only filters (status, player)
// are ignored here: it's always the user's own finished games.
gamesRouter.all(
  routerEndpoints.finished,
  method(Methods.GET),
  gameListDataValidator,
  getFinishedGames,
);

gamesRouter.all(
  routerEndpoints.finishedGame,
  method(Methods.GET),
  getGameDataValidator,
  getFinishedGame,
);

export default gamesRouter;
