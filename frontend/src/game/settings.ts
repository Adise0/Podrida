import { useCallback, useEffect, useState } from "react";

// The player's preferences for the game screen. Local to this browser.
export interface GameSettings {
  sound: boolean; // The speaker button: off silences everything.
  effects: boolean; // Card sounds.
  turnChime: boolean;
  doubleClickToPlay: boolean;
  fastAnimations: boolean;
  ruleHints: boolean;
  sortMode: SortMode;
}

export type SortMode = "suitRank" | "suit" | "rank" | "dealt";

export const sortModes: { mode: SortMode; label: string }[] = [
  { mode: "suitRank", label: "Suit-rank" },
  { mode: "suit", label: "Suit" },
  { mode: "rank", label: "Rank" },
  { mode: "dealt", label: "Dealt" },
];

const defaults: GameSettings = {
  sound: true,
  effects: true,
  turnChime: true,
  doubleClickToPlay: true,
  fastAnimations: false,
  ruleHints: true,
  sortMode: "suitRank",
};

const storageKey = "podrida.gameSettings";

const read = (): GameSettings => {
  try {
    const stored = { ...defaults, ...JSON.parse(localStorage.getItem(storageKey) ?? "{}") };
    // A sort from an older version that doesn't exist anymore goes back to the default.
    if (!sortModes.some(({ mode }) => mode === stored.sortMode))
      stored.sortMode = defaults.sortMode;
    return stored;
  } catch {
    return defaults;
  }
};

const listeners = new Set<(settings: GameSettings) => void>();

export function useGameSettings() {
  const [settings, setSettings] = useState(read);

  useEffect(() => {
    listeners.add(setSettings);
    return () => {
      listeners.delete(setSettings);
    };
  }, []);

  const update = useCallback((changes: Partial<GameSettings>) => {
    const next = { ...read(), ...changes };
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Private mode or full storage: it still applies for this visit.
    }
    listeners.forEach((listener) => listener(next));
  }, []);

  return [settings, update] as const;
}
