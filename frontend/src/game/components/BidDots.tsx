import type { CSSProperties } from "react";
import styled, { css, keyframes } from "styled-components";
import { darkControl, g } from "../tokens";

// Everything scales with the row's --s: 1 on the seats, 1.4 in the local player's bid strip.
const su = (units: number) => `calc(var(--u, 1) * var(--s, 1) * ${units}px)`;

// A player's bid at a glance: one dot per trick bid, filled gold as they win them, and a red dot
// for every trick past the bid. Then the number, in a badge.

const pop = keyframes`
  0% { transform: scale(calc(1 - 0.4 * var(--motion, 1))); opacity: 0.4; }
  60% { transform: scale(calc(1 + 0.2 * var(--motion, 1))); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
`;

const badgePulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
`;

const flashMet = keyframes`
  0%, 100% { filter: none; }
  30%, 70% { filter: drop-shadow(0 0 6px ${g.success}); }
`;

const flashMissed = keyframes`
  0%, 100% { filter: none; }
  30%, 70% { filter: drop-shadow(0 0 6px ${g.danger}); }
`;

const Row = styled.span<{ $flash: "met" | "missed" | null }>`
  display: inline-flex;
  align-items: center;
  gap: ${su(8)};

  ${({ $flash }) =>
    $flash &&
    css`
      animation: ${$flash === "met" ? flashMet : flashMissed} 1.2s ${g.ease};
    `}
`;

const Dots = styled.span`
  display: inline-flex;
  flex-wrap: wrap;
  gap: ${su(4)};
  max-width: calc(10 * ${su(7)} + 9 * ${su(4)}); // 10 a row, two rows at most.
`;

const Dot = styled.span<{ $kind: "empty" | "won" | "over"; $delay: number }>`
  width: ${su(7)};
  height: ${su(7)};
  border-radius: 50%;
  animation: ${pop} ${g.ms(250)} ${g.ease} both;
  animation-delay: ${({ $delay }) => $delay}ms;

  ${({ $kind }) =>
    $kind === "empty"
      ? css`
          box-shadow: inset 0 0 0 1px rgba(216, 188, 126, 0.5);
        `
      : css`
          background: ${$kind === "won" ? g.gold : g.danger};
        `}
`;

const Badge = styled.span<{ $pulsing: boolean }>`
  ${darkControl}
  display: inline-grid;
  place-items: center;
  min-width: ${su(20)};
  height: ${su(20)};
  padding: 0 ${su(4)};
  border-radius: ${su(10)};
  font-family: ${g.serif};
  font-size: max(13px, ${su(14)});
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  animation: ${pop} ${g.ms(250)} ${g.ease};

  ${({ $pulsing }) =>
    $pulsing &&
    css`
      animation: ${badgePulse} 1.2s ease-in-out infinite;
    `}
`;

const Ratio = styled.span`
  color: ${g.muted};
  font-size: max(12px, ${su(12)});
  font-variant-numeric: tabular-nums;
`;

interface BidDotsProps {
  bid: number | null;
  won: number;
  isBidding?: boolean;
  flash?: "met" | "missed" | null;
  scale?: number;
}

export function BidDots({ bid, won, isBidding = false, flash = null, scale = 1 }: BidDotsProps) {
  const style = { "--s": scale } as CSSProperties;

  if (bid === null) {
    return (
      <Row $flash={null} style={style}>
        <Badge $pulsing={isBidding} title={isBidding ? "Bidding…" : "Hasn't bid yet"}>
          –
        </Badge>
      </Row>
    );
  }

  const over = Math.max(0, won - bid);
  const total = bid + over;
  const title = `Bid ${bid} · won ${won}${over > 0 ? ` · ${over} over` : won < bid ? ` · ${bid - won} to go` : ""}`;

  // Past 20 dots, only the numbers.
  if (total > 20) {
    return (
      <Row $flash={flash} title={title} style={style}>
        <Badge $pulsing={false}>{bid}</Badge>
        <Ratio>
          {won}/{bid}
        </Ratio>
      </Row>
    );
  }

  return (
    <Row $flash={flash} title={title} style={style}>
      {total > 0 && (
        // Keyed by the bid: a new bid deals its dots out one by one.
        <Dots key={bid} aria-hidden>
          {Array.from({ length: total }, (_, index) => {
            const kind = index < bid ? (index < won ? "won" : "empty") : "over";
            // Keyed by the state too, so a dot pops when it fills.
            return (
              <Dot
                key={`${index}-${kind}`}
                $kind={kind}
                $delay={kind === "empty" ? index * 40 : 0}
              />
            );
          })}
        </Dots>
      )}
      <Badge key={bid} $pulsing={false} aria-label={title}>
        {bid}
      </Badge>
    </Row>
  );
}
