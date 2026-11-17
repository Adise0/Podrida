/* eslint-disable import-x/prefer-default-export */

import { ErrorSeverity } from "../../types/errorTypes/ServerError";
import { ErrorCode } from "../../types/errorTypes/ErrorCode";
import ControlledError from "./ControlledError";

export const getAvatarNotFoundError = (userId: string): ControlledError =>
  new ControlledError({
    code: ErrorCode.AVATAR_NOT_FOUND,
    message: "No avatar for this user",
    statusCode: 404,
    messageToSend: "This user has no avatar",
    severity: ErrorSeverity.low,
    extraData: {
      userId,
    },
  });
