import { GameStatus } from "@podrida/shared";
import Joi from "joi";
import { adminUserListMaxLimit } from "../serverConfig/server-config";
import { JoiObjectId } from "./joiTypes";

const gameListData = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(adminUserListMaxLimit).default(20),
  status: Joi.string().valid(...Object.values(GameStatus)),
  playerId: JoiObjectId(), // Only the games this user sat at.
});

export default gameListData;
