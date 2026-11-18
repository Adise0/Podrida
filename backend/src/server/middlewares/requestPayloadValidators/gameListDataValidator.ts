import { NextFunction, Request, Response } from "express";
import { getValidationError } from "../../../data/errorObjects/dataValidationErrors";
import gameListData from "../../../data/joiObjects/gameListData";
import joiValidationOptions from "../../../data/joiObjects/joiValidationOptions";

const gameListDataValidator = (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = gameListData.validate(req.query, joiValidationOptions);

  if (error) {
    next(getValidationError(error, "game list"));
    return;
  }

  res.locals.listQuery = value;
  next();
};

export default gameListDataValidator;
