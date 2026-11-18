import type { PlayRule } from "@podrida/shared";
import { ErrorSeverity } from "../../types/errorTypes/ServerError";
import { ErrorCode } from "../../types/errorTypes/ErrorCode";
import ControlledError from "./ControlledError";

const gameError = (code: ErrorCode, messageToSend: string, details?: Record<string, unknown>) =>
  new ControlledError({
    code,
    message: messageToSend,
    statusCode: 409,
    messageToSend,
    severity: ErrorSeverity.low,
    details,
  });

export const getWrongPhaseError = () =>
  gameError(ErrorCode.WRONG_PHASE, "That can't be done right now");

export const getNotYourTurnError = () => gameError(ErrorCode.NOT_YOUR_TURN, "It's not your turn");

export const getInvalidBidError = (cardsPerPlayer: number) =>
  gameError(ErrorCode.INVALID_BID, `Bid from 0 to ${cardsPerPlayer}`, { max: cardsPerPlayer });

// rule: why it can't be played (see playRule in @podrida/shared), null when it isn't in the hand.
export const getCardNotPlayableError = (rule: PlayRule | null) =>
  gameError(
    ErrorCode.CARD_NOT_PLAYABLE,
    rule ? "That card can't be played now" : "That card isn't in your hand",
    { rule },
  );
