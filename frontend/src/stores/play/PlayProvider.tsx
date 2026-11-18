import { useEffect, type ReactNode } from "react";
import { realtime } from "../../api/realtime";
import { lobbyStore } from "../lobby/store";
import { useSession } from "../session/store";
import { playStore } from "./store";

// The realtime connection follows the session: open while there's one, with its latest token.
function RealtimeEffects() {
  const { status, token } = useSession();

  useEffect(() => {
    if (status === "authenticated" && token) realtime.start(token);
    else if (status === "anonymous") realtime.stop();
  }, [status, token]);

  return null;
}

export function PlayProvider({ children }: { children: ReactNode }) {
  return (
    <playStore.Provider>
      <lobbyStore.Provider>
        <RealtimeEffects />
        {children}
      </lobbyStore.Provider>
    </playStore.Provider>
  );
}
