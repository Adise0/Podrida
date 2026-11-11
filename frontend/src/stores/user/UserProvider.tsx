import { useEffect, type ReactNode } from "react";
import { useSession } from "../session/store";
import { loadMyUser } from "./actions";
import { userStore, useUser } from "./store";

// Loads the user as soon as there's a session for one (and again after each new login, which resets it).
function UserEffects() {
  const { status: sessionStatus } = useSession();
  const { status } = useUser();

  useEffect(() => {
    if (sessionStatus === "authenticated" && status === "idle") loadMyUser();
  }, [sessionStatus, status]);

  return null;
}

export function UserProvider({ children }: { children: ReactNode }) {
  return (
    <userStore.Provider>
      <UserEffects />
      {children}
    </userStore.Provider>
  );
}
