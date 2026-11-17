import type { AvatarUpload, MyUser, UpdateProfileData } from "@podrida/shared";
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

// null removes it.
export async function updateMyAvatar(upload: AvatarUpload | null) {
  if (upload) {
    const { avatarUrl } = await usersApi.updateMyAvatar(upload);
    dispatcher.dispatch({ type: "USER_UPDATED", changes: { avatarUrl } });
    return;
  }

  await usersApi.deleteMyAvatar();
  dispatcher.dispatch({ type: "USER_UPDATED", changes: { avatarUrl: undefined } });
}

// For changes made through other endpoints (eg. setting a password) that don't answer the user.
export function patchMyUser(changes: Partial<MyUser>) {
  dispatcher.dispatch({ type: "USER_UPDATED", changes });
}
