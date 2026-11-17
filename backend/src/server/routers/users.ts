import express from "express";
import { endpoints } from "../../data/serverConfig/endpoints";
import tokenValidator from "../middlewares/auth/tokenValidator";
import deleteMyAvatar from "../controllers/users/deleteMyAvatar";
import getAvatar from "../controllers/users/getAvatar";
import getMyAvatar from "../controllers/users/getMyAvatar";
import getMyUser from "../controllers/users/getMyUser";
import updateMyAvatar from "../controllers/users/updateMyAvatar";
import updateMyUser from "../controllers/users/updateMyUser";
import {
  avatarUploadDataValidator,
  updateProfileDataValidator,
} from "../middlewares/requestPayloadValidators/bodyValidators";
import getUserDataValidator from "../middlewares/requestPayloadValidators/getUserDataValidator";
import method, { Methods } from "../middlewares/method";

// Router creation
const usersRouter = express.Router();

// "routerEndpoints" is used here for clarity, you can also directly import "userEndpoints".
const routerEndpoints = endpoints.users;

// Router endpoint chain

// The only public route, so it goes before the tokenValidator: an <img> can't send the token.
usersRouter.all(routerEndpoints.avatar, method(Methods.GET), getUserDataValidator, getAvatar);

// Everything below is protected
usersRouter.use(tokenValidator);

// One path with two verbs: the guard goes on .all(), each verb then has its own chain.
usersRouter
  .route(routerEndpoints.myUser)
  .all(method(Methods.GET, Methods.PATCH))
  .get(getMyUser)
  .patch(updateProfileDataValidator, updateMyUser);

usersRouter
  .route(routerEndpoints.myAvatar)
  .all(method(Methods.GET, Methods.PUT, Methods.DELETE))
  .get(getMyAvatar)
  .put(avatarUploadDataValidator, updateMyAvatar)
  .delete(deleteMyAvatar);

export default usersRouter;
