import type { ReactNode } from "react";
import { notificationsStore } from "./notifications/store";
import { PlayProvider } from "./play/PlayProvider";
import { reauthStore } from "./reauth/store";
import { SessionProvider } from "./session/SessionProvider";
import { UserProvider } from "./user/UserProvider";

// The app-wide stores. UserProvider and PlayProvider go inside SessionProvider because they follow
// the session: one loads the user, the other opens the realtime connection. The admin store is
// only mounted under /admin (see router/routes.tsx).
export function AppStoresProvider({ children }: { children: ReactNode }) {
  return (
    <notificationsStore.Provider>
      <SessionProvider>
        <UserProvider>
          <reauthStore.Provider>
            <PlayProvider>{children}</PlayProvider>
          </reauthStore.Provider>
        </UserProvider>
      </SessionProvider>
    </notificationsStore.Provider>
  );
}
