import type { MyUser, UpdateProfileData } from "@podrida/shared";
import { usersApi } from "../../api/users";
import { dispatcher } from "../../flux/dispatcher";

export async function loadMyUser() {
  dispatcher.dispatch({ type: "USER_LOADING" });

  try {
    const user = await usersApi.getMyUser();
    dispatcher.dispatch({ type: "USER_LOADED", user });
  } catch (error) {
    dispatcher.dispatch({ type: "USER_LOAD_FAILED", error });
  }
}

export async function updateMyProfile(data: UpdateProfileData) {
  const { information } = await usersApi.updateMyUser(data);
  dispatcher.dispatch({ type: "USER_UPDATED", changes: { information } });
}

// For changes made through other endpoints (eg. setting a password) that don't answer the user.
export function patchMyUser(changes: Partial<MyUser>) {
  dispatcher.dispatch({ type: "USER_UPDATED", changes });
}
