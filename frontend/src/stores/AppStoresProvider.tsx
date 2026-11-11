import type { ReactNode } from "react";
import { notificationsStore } from "./notifications/store";
import { reauthStore } from "./reauth/store";
import { SessionProvider } from "./session/SessionProvider";
import { UserProvider } from "./user/UserProvider";

// The app-wide stores. UserProvider goes inside SessionProvider because it loads the user when a
// session starts. The admin store is only mounted under /admin (see router/routes.tsx).
export function AppStoresProvider({ children }: { children: ReactNode }) {
  return (
    <notificationsStore.Provider>
      <SessionProvider>
        <UserProvider>
          <reauthStore.Provider>{children}</reauthStore.Provider>
        </UserProvider>
      </SessionProvider>
    </notificationsStore.Provider>
  );
}
