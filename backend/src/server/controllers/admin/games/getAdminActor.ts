import { getUserNotFoundForIdError } from "../../../../data/errorObjects/userErrors";
import Users from "../../../../database/models/Users";
import { GameActor } from "../../../../realtime/games/gameManager";

// The logged in admin, the way a game record names who ended it or kicked someone.
const getAdminActor = async (userId: string): Promise<GameActor> => {
  const admin = await Users.findById(userId).select("information.username");

  if (!admin) {
    throw getUserNotFoundForIdError(userId);
  }

  return { userId, username: admin.information.username };
};

export default getAdminActor;
