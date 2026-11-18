import { NextFunction, Request, Response } from "express";
import { getNoAuthHeaderError } from "../../../data/errorObjects/authErrors";
import verifySessionToken from "../../utils/auth/verifySessionToken";

const tokenValidator = async (req: Request, res: Response, next: NextFunction) => {
  const headerAuth = req.header("Authorization"); // Grab the request Authorization header

  // If no Authorization header is found, write an error and go next.
  if (!headerAuth) {
    const noAuthHeaderError = getNoAuthHeaderError();
    next(noAuthHeaderError);
    return;
  }

  // Grab the actual token from the header
  const token = headerAuth.replace("Bearer ", "");

  try {
    // Signature, purpose, and that the session is still current for the user (see the util).
    const session = await verifySessionToken(token);

    // Add what comes with the session to the res.locals object (sendToken carries it over on
    // refresh, freshAuthValidator reads the authTime, roleValidator the role).
    res.locals.userId = session.userId;
    res.locals.tokenVersion = session.tokenVersion;
    res.locals.authTime = session.authTime;
    res.locals.sessionId = session.sessionId;
    res.locals.role = session.role;

    next(); // go next.
  } catch (error) {
    next(error);
  }
};

export default tokenValidator;
