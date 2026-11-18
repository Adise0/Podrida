import Joi from "joi";
import { JoiObjectId } from "./joiTypes";

// :gameId, and :userId on the routes about one of its players.
const getGameData = Joi.object({
  gameId: JoiObjectId().message("Invalid game id").required(),
  userId: JoiObjectId().message("Invalid user id"),
});

export default getGameData;
