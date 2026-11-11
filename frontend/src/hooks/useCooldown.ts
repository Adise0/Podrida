import { useCallback, useEffect, useState } from "react";

// Seconds left before something can be done again (eg. sending another email).
export function useCooldown() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return undefined;

    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt) setEndsAt(null);
    }, 1000);

    return () => clearInterval(interval);
  }, [endsAt]);

  const start = useCallback((seconds: number) => {
    const current = Date.now();
    setNow(current);
    setEndsAt(current + seconds * 1000);
  }, []);

  const remaining = endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));

  return { remaining, start };
}
