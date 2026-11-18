import { NextFunction, Request, Response } from "express";
import Users from "../../../database/models/Users";
import { getUserNotFoundForIdError } from "../../../data/errorObjects/userErrors";
import { getAvatarUrl } from "../../utils/users/avatar";

// The logged in user, with what a settings page needs: which sign-in methods are set up.
const getMyUser = async (req: Request, res: Response, next: NextFunction) => {
  const myUserId = res.locals.userId;

  try {
    const foundUser = await Users.findById(myUserId).select(
      "information avatar role credentials.password oauthAccounts twoFactor.enabledAt",
    );

    if (!foundUser) {
      const notFoundForIdError = getUserNotFoundForIdError(myUserId);
      next(notFoundForIdError);
      return;
    }

    res.json({
      id: foundUser.id,
      information: foundUser.information,
      avatarUrl: getAvatarUrl(foundUser.id, foundUser.avatar),
      role: foundUser.role,
      hasPassword: Boolean(foundUser.credentials?.password), // OAuth-only accounts have none.
      linkedProviders: foundUser.oauthAccounts.map(({ provider, email, linkedAt }) => ({
        provider,
        email,
        linkedAt,
      })),
      twoFactorEnabled: Boolean(foundUser.twoFactor?.enabledAt),
    });
  } catch (error) {
    next(error);
  }
};

export default getMyUser;
