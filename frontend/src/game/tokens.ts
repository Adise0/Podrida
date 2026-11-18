import { css } from "styled-components";

// The game screen's visual language (see the design notes). It's its own palette on purpose: the
// table is dark and gold, the rest of the app is cream cards on felt.
export const g = {
  gold: "#D8BC7E",
  goldText: "#E2C88E",
  danger: "#C0503C",
  success: "#8FB98A",
  text: "#F1EAD8",
  muted: "rgba(241, 234, 216, 0.6)",
  dark: "#10211b", // Text on gold.

  cardFace: "#F6F0E2",
  cardBorder: "#E3D9C3",
  cardBack: "#7A3328",
  red: "#B5402F",
  black: "#1F2623",

  control: "rgba(10, 30, 24, 0.55)",
  controlBorder: "rgba(255, 255, 255, 0.12)",
  panel: "rgba(14, 38, 30, 0.92)",
  panelBorder: "rgba(255, 255, 255, 0.10)",
  frameBorder: "rgba(255, 255, 255, 0.08)",
  dashed: "rgba(255, 255, 255, 0.18)",

  serif: "'Cormorant Garamond', 'EB Garamond', Georgia, serif",
  sans: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  ease: "cubic-bezier(0.2, 0.8, 0.2, 1)",

  // Durations scale with the "Animation speed" setting (--speed is 1 or 0.6, see GameScreen).
  ms: (milliseconds: number) => `calc(${milliseconds}ms * var(--speed, 1))`,
} as const;

// Sizes follow the window: u is set on the game's root (--u, see layout.ts), and everything is
// in units of it. Fonts never go under 11px for labels and 13px for text.
export const uu = (units: number) => `calc(var(--u, 1) * ${units}px)`;
export const fs = (units: number, min = 13) => `max(${min}px, calc(var(--u, 1) * ${units}px))`;

export const label = css`
  font-family: ${g.sans};
  font-size: ${fs(12, 11)};
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${g.muted};
`;

export const darkControl = css`
  background: ${g.control};
  border: 1px solid ${g.controlBorder};
  border-radius: 8px;
  color: ${g.text};
`;

export const panel = css`
  background: ${g.panel};
  border: 1px solid ${g.panelBorder};
  border-radius: 16px;
  backdrop-filter: blur(12px);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
  color: ${g.text};
`;

export const goldButton = css`
  border: none;
  border-radius: 8px;
  background: ${g.gold};
  color: ${g.dark};
  font-family: ${g.sans};
  font-weight: 600;
  cursor: pointer;
  transition:
    filter ${g.ms(150)} ${g.ease},
    opacity ${g.ms(150)} ${g.ease};

  &:hover:not(:disabled) {
    filter: brightness(1.06);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

// Distinct muted fills for avatars without a picture, by seat.
export const avatarFills = ["#9A5B44", "#5E6E5E", "#55647A", "#6E4F66", "#8C7442", "#4F6B6B"];
