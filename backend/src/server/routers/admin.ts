import express from "express";
import { endpoints } from "../../data/serverConfig/endpoints";
import UserRole from "../../types/userTypes/UserRole";
import changeUserRole from "../controllers/admin/changeUserRole";
import deleteUser from "../controllers/admin/deleteUser";
import disableUser from "../controllers/admin/disableUser";
import enableUser from "../controllers/admin/enableUser";
import forcePasswordReset from "../controllers/admin/forcePasswordReset";
import endGame from "../controllers/admin/games/endGame";
import getGame from "../controllers/admin/games/getGame";
import getGames from "../controllers/admin/games/getGames";
import kickGamePlayer from "../controllers/admin/games/kickGamePlayer";
import getUser from "../controllers/admin/getUser";
import getUsers from "../controllers/admin/getUsers";
import resetTwoFactor from "../controllers/admin/resetTwoFactor";
import signOutUser from "../controllers/admin/signOutUser";
import updateUser from "../controllers/admin/updateUser";
import freshAuthValidator from "../middlewares/auth/freshAuthValidator";
import manageableUserValidator from "../middlewares/auth/manageableUserValidator";
import roleValidator from "../middlewares/auth/roleValidator";
import tokenValidator from "../middlewares/auth/tokenValidator";
import method, { Methods } from "../middlewares/method";
import {
  updateProfileDataValidator,
  userRoleDataValidator,
} from "../middlewares/requestPayloadValidators/bodyValidators";
import gameListDataValidator from "../middlewares/requestPayloadValidators/gameListDataValidator";
import getGameDataValidator from "../middlewares/requestPayloadValidators/getGameDataValidator";
import getUserDataValidator from "../middlewares/requestPayloadValidators/getUserDataValidator";
import userListDataValidator from "../middlewares/requestPayloadValidators/userListDataValidator";

// Router creation
const adminRouter = express.Router();

const routerEndpoints = endpoints.admin;

// Router endpoint chain

// This router is only for admins and superusers
adminRouter.use(tokenValidator, roleValidator(UserRole.admin, UserRole.superuser));

adminRouter.all(routerEndpoints.users, method(Methods.GET), userListDataValidator, getUsers);

// One path with several verbs: the guard goes on .all(), each verb then has its own chain.
adminRouter
  .route(routerEndpoints.user)
  .all(method(Methods.GET, Methods.PATCH, Methods.DELETE), getUserDataValidator)
  .get(getUser)
  .patch(manageableUserValidator, updateProfileDataValidator, updateUser)
  .delete(freshAuthValidator, manageableUserValidator, deleteUser);

adminRouter.all(
  routerEndpoints.disableUser,
  method(Methods.POST),
  getUserDataValidator,
  manageableUserValidator,
  disableUser,
);

adminRouter.all(
  routerEndpoints.enableUser,
  method(Methods.POST),
  getUserDataValidator,
  manageableUserValidator,
  enableUser,
);

adminRouter.all(
  routerEndpoints.signOutUser,
  method(Methods.POST),
  getUserDataValidator,
  manageableUserValidator,
  signOutUser,
);

adminRouter.all(
  routerEndpoints.forcePasswordReset,
  method(Methods.POST),
  getUserDataValidator,
  manageableUserValidator,
  forcePasswordReset,
);

adminRouter.all(
  routerEndpoints.resetTwoFactor,
  method(Methods.POST),
  getUserDataValidator,
  manageableUserValidator,
  resetTwoFactor,
);

adminRouter.all(
  routerEndpoints.userRole,
  method(Methods.PATCH),
  roleValidator(UserRole.superuser),
  freshAuthValidator,
  getUserDataValidator,
  manageableUserValidator,
  userRoleDataValidator,
  changeUserRole,
);

// GAMES. Ending a game and kicking only work on games being played (GAME_NOT_FOUND otherwise).

adminRouter.all(routerEndpoints.games, method(Methods.GET), gameListDataValidator, getGames);

adminRouter.all(routerEndpoints.game, method(Methods.GET), getGameDataValidator, getGame);

adminRouter.all(routerEndpoints.endGame, method(Methods.POST), getGameDataValidator, endGame);

adminRouter.all(
  routerEndpoints.kickPlayer,
  method(Methods.POST),
  getGameDataValidator,
  kickGamePlayer,
);

export default adminRouter;
