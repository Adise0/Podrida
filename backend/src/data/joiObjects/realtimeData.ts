import { BotDifficulty, ranks, roomLimits, roomSettingsLimits, suits } from "@podrida/shared";
import Joi from "joi";
import { JoiObjectId } from "./joiTypes";

// Every message a client sends. Anything else is a protocol error that closes the connection,
// since there's no id to answer to.
export const socketRequestEnvelope = Joi.object({
  id: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER).required(),
  type: Joi.string().max(64).required(),
  payload: Joi.any(),
});

export const socketAuthData = Joi.object({
  token: Joi.string().max(4096).required(),
});

// No control characters (line breaks, zero-width tricks...): it's shown in lists to everyone.
export const createRoomData = Joi.object({
  name: Joi.string()
    .trim()
    .min(roomLimits.nameMinLength)
    .max(roomLimits.nameMaxLength)
    .pattern(/^[^\p{C}]+$/u)
    .required()
    .messages({ "string.pattern.base": "Room name can't have control characters" }),
});

// Room ids are 8 base64url characters (see newRoomId).
export const joinRoomData = Joi.object({
  roomId: Joi.string()
    .pattern(/^[\w-]{8}$/)
    .required(),
});

export const attachGameData = Joi.object({
  gameId: JoiObjectId().required(),
});

export const kickPlayerData = Joi.object({
  userId: JoiObjectId().required(),
});

// The range is checked against the round's cards when it's placed.
export const bidData = Joi.object({
  bid: Joi.number().integer().min(0).max(52).required(),
});

export const playCardData = Joi.object({
  card: Joi.object({
    suit: Joi.string()
      .valid(...suits)
      .required(),
    rank: Joi.number()
      .valid(...ranks)
      .required(),
  }).required(),
});

const botDifficulty = Joi.string().valid(...Object.values(BotDifficulty));

export const addBotData = Joi.object({
  difficulty: botDifficulty.required(),
});

// Bot ids are ObjectIds, like user ids (with no account behind them).
export const removeBotData = Joi.object({
  userId: JoiObjectId().required(),
});

export const setBotDifficultyData = Joi.object({
  userId: JoiObjectId().required(),
  difficulty: botDifficulty.required(),
});

const { botThinkingMaxMs } = roomSettingsLimits;

export const roomSettingsData = Joi.object({
  botThinkingMaxMs: Joi.number().integer().min(botThinkingMaxMs.min).max(botThinkingMaxMs.max),
}).min(1);
