// A card table: green felt around cream cards, with the red of hearts and diamonds as the accent.
export const theme = {
  colors: {
    felt: "#123f30",
    feltDeep: "#0b2a20",
    feltLine: "rgba(255, 255, 255, 0.08)",
    onFelt: "#f2eee3",
    onFeltMuted: "#a9c1b5",

    surface: "#fbf8f1",
    surfaceSunken: "#f2ede1",
    border: "#e0d9c8",
    borderStrong: "#c9c0aa",

    text: "#1e1b16",
    textMuted: "#6a6354",

    accent: "#b3261e",
    accentHover: "#931d17",
    onAccent: "#ffffff",
    gold: "#c9a227",

    focus: "#2f6fb0",

    success: "#25704a",
    successSoft: "#e3f2e8",
    danger: "#b3261e",
    dangerSoft: "#fbe8e6",
    info: "#2f5d8a",
    infoSoft: "#e6eef7",
    warning: "#7d5f00",
    warningSoft: "#fbf1d3",
  },

  fonts: {
    body: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    display: "'Fraunces', Georgia, 'Times New Roman', serif",
    mono: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace",
  },

  radii: { sm: "6px", md: "10px", lg: "16px", pill: "999px" },

  shadows: {
    card: "0 1px 2px rgba(0, 0, 0, 0.12), 0 16px 40px rgba(0, 0, 0, 0.28)",
    raised: "0 1px 2px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.12)",
  },

  // Multiples of 4px: space(4) is 16px.
  space: (steps: number) => `${steps * 4}px`,

  media: {
    small: "@media (max-width: 640px)",
  },
} as const;

export type AppTheme = typeof theme;
