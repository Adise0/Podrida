import jwt from "jsonwebtoken";
import { getInvalidTokenError } from "../../../data/errorObjects/authErrors";
import { getUserDisabledError } from "../../../data/errorObjects/userErrors";
import { userSessionMaxAgeInHours } from "../../../data/serverConfig/server-config";
import Users from "../../../database/models/Users";
import TokenPayload, { TokenPurpose } from "../../../types/authTypes/TokenPayload";
import UserRole from "../../../types/userTypes/UserRole";
import getTokenSecret, { tokenAlgorithm } from "./getTokenSecret";

// What a valid session token stands for.
export interface VerifiedSession {
  userId: string;
  tokenVersion: number;
  sessionId: string;
  authTime: number; // Unix time (seconds) of the last real login.
  role: UserRole;
  expiresAt: number; // Milliseconds. Infinity for a token without an expiry.
}

type SessionClaims = Pick<TokenPayload, "id" | "tokenVersion" | "sessionId" | "authTime">;

// Checks the session is still current for its user: same tokenVersion, not signed out on its own,
// user still there and enabled. The signature is checked separately (see verifySessionToken), so
// this can run again later, eg. for a WebSocket that stays open after the token was checked.
// Throws the ControlledError to answer with.
export const assertSessionIsCurrent = async (claims: SessionClaims) => {
  // If there's an overall session limit, refreshing can't keep a session alive past it.
  if (userSessionMaxAgeInHours !== null) {
    const secondsSinceAuth = Math.floor(Date.now() / 1000) - claims.authTime;

    if (!claims.authTime || secondsSinceAuth > userSessionMaxAgeInHours * 60 * 60) {
      throw getInvalidTokenError();
    }
  }

  const foundUser = await Users.findById(claims.id).select(
    "tokenVersion isDisabled role revokedSessions",
  );

  // If the user no longer exists, or the token was issued before the user's sessions were
  // revoked (eg. a password reset), the token is no longer valid.
  if (!foundUser || foundUser.tokenVersion !== claims.tokenVersion) {
    throw getInvalidTokenError();
  }

  // If this session was signed out on its own (or it's from before sessions had an id), the
  // token is no longer valid either.
  const isSessionRevoked = foundUser.revokedSessions.some(
    ({ sessionId }) => sessionId === claims.sessionId,
  );

  if (!claims.sessionId || isSessionRevoked) {
    throw getInvalidTokenError();
  }

  // If the user has been disabled since the token was issued.
  if (foundUser.isDisabled) {
    throw getUserDisabledError(foundUser.id);
  }

  return foundUser;
};

// The whole check of a session token: signature, purpose, then assertSessionIsCurrent.
const verifySessionToken = async (token: string): Promise<VerifiedSession> => {
  let payload: TokenPayload & { exp?: number };

  try {
    payload = jwt.verify(token, getTokenSecret(), { algorithms: [tokenAlgorithm] }) as TokenPayload;
  } catch {
    throw getInvalidTokenError();
  }

  // Only session tokens open a session - email link tokens are signed with the same secret but
  // are never valid here.
  if (payload.purpose !== TokenPurpose.session) {
    throw getInvalidTokenError();
  }

  const foundUser = await assertSessionIsCurrent(payload);

  return {
    userId: foundUser.id,
    tokenVersion: foundUser.tokenVersion,
    sessionId: payload.sessionId,
    authTime: payload.authTime,
    role: foundUser.role,
    // Ours always expire, but a token without exp is valid for as long as it's current.
    expiresAt: payload.exp ? payload.exp * 1000 : Number.POSITIVE_INFINITY,
  };
};

export default verifySessionToken;
