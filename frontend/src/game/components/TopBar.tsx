import {
  isRedSuit,
  maxCardsPerPlayer,
  PodridaPhase,
  suitSymbols,
  type Game,
} from "@podrida/shared";
import { Fragment, type ReactNode } from "react";
import styled, { css } from "styled-components";
import type { Box } from "../layout";
import { bidTotalState, type BidTotalState } from "../rulesText";
import { darkControl, fs, g, label, uu } from "../tokens";
import { Tooltip } from "./primitives";

// The strip can't be centred on narrow windows without touching the sides: there the sides get
// what's left, the room name shrinks first.
const Bar = styled.header`
  position: absolute;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(max-content, 1fr);
  align-items: center;
  gap: ${uu(16)};
  padding: 0 ${uu(24)};
`;

const Left = styled.div`
  display: flex;
  align-items: center;
  gap: ${uu(16)};
  min-width: 0;
`;

const Logo = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: ${uu(8)};
  font-family: ${g.serif};
  font-size: ${fs(30)};
  font-weight: 600;
  color: ${g.text};

  span:first-child {
    color: ${g.gold};
    font-size: ${fs(24)};
  }
`;

const Divider = styled.span`
  flex-shrink: 0;
  width: 1px;
  height: ${uu(32)};
  background: rgba(255, 255, 255, 0.12);
`;

const Room = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;

  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: ${g.text};
    font-size: ${fs(14)};
    font-weight: 600;
  }

  span {
    color: ${g.muted};
    font-size: ${fs(12, 11)};
  }
`;

const Strip = styled.div`
  ${darkControl}
  display: flex;
  align-items: center;
  gap: ${uu(4)};
  height: ${uu(32)};
  padding: 0 ${uu(14)};
  border-radius: ${uu(16)};
  font-size: ${fs(13)};
  white-space: nowrap;
`;

const Stage = styled.span<{ $state: "past" | "current" | "future" }>`
  position: relative;
  padding: ${uu(4)} 2px;
  font-weight: 600;
  color: ${({ $state }) =>
    $state === "current" ? g.goldText : $state === "past" ? g.text : g.muted};

  ${({ $state }) =>
    $state === "current" &&
    css`
      &::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        bottom: -1px;
        height: 2px;
        border-radius: 1px;
        background: ${g.gold};
      }
    `}
`;

const Chevron = styled.span`
  color: ${g.muted};
  padding: 0 ${uu(3)};
`;

const StripDivider = styled.span`
  width: 1px;
  height: ${uu(16)};
  margin: 0 ${uu(8)};
  background: rgba(255, 255, 255, 0.14);
`;

const Suit = styled.span<{ $red: boolean }>`
  color: ${({ $red }) => ($red ? "#E07A65" : g.text)};
  font-size: ${fs(15)};
`;

const totalColors: Record<BidTotalState, string> = {
  under: g.muted,
  exact: g.success,
  over: g.goldText,
};

const Count = styled.span<{ $color?: string }>`
  color: ${({ $color }) => $color ?? g.text};
  font-variant-numeric: tabular-nums;
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${uu(12)};
`;

const RoundInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-right: ${uu(4)};
  white-space: nowrap;

  strong {
    ${label}
    font-variant-numeric: tabular-nums;
  }

  span {
    color: ${g.muted};
    font-size: ${fs(11, 11)};
  }
`;

const stages = [
  { phase: PodridaPhase.dealing, label: "Dealing" },
  { phase: PodridaPhase.bidding, label: "Bidding" },
  { phase: PodridaPhase.playing, label: "Playing" },
  { phase: PodridaPhase.scoring, label: "Scoring" },
];

// A finished trick is still part of the playing; the game's end is past every stage.
const stageIndex = (phase: PodridaPhase) =>
  phase === PodridaPhase.trickEnd
    ? 2
    : phase === PodridaPhase.finished
      ? stages.length
      : stages.findIndex((stage) => stage.phase === phase);

const pad = (value: number) => String(value).padStart(2, "0");

interface TopBarProps {
  game: Game;
  box: Box;
  subtitle: string;
  actions: ReactNode; // The icon buttons.
}

export function TopBar({ game, box, subtitle, actions }: TopBarProps) {
  const { state } = game;
  const current = stageIndex(state.phase);
  const bidTotal = Object.values(state.bids).reduce<number>((sum, bid) => sum + (bid ?? 0), 0);
  // Up to the max, one round at the max per player, then down.
  const max = maxCardsPerPlayer(game.players.length);
  const peakIndex = state.roundNumber - (max - 1);
  const direction =
    state.cardsPerPlayer === max
      ? `longest round ${peakIndex} of ${game.players.length}`
      : state.roundNumber < max
        ? "ascending"
        : "descending";
  const cards = `${state.cardsPerPlayer} card${state.cardsPerPlayer === 1 ? "" : "s"}`;
  const showCount =
    state.phase === PodridaPhase.bidding ||
    state.phase === PodridaPhase.playing ||
    state.phase === PodridaPhase.trickEnd;

  return (
    <Bar style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
      <Left data-box="top left">
        <Logo>
          <span aria-hidden>♣</span>
          <span>Podrida</span>
        </Logo>
        <Divider aria-hidden />
        <Room>
          <strong title={game.roomName}>{game.roomName}</strong>
          <span>{subtitle}</span>
        </Room>
      </Left>

      <Strip aria-label="Round progress" data-box="phase strip">
        {stages.map((stage, index) => (
          <Fragment key={stage.phase}>
            {index > 0 && <Chevron aria-hidden>›</Chevron>}
            <Stage
              $state={index < current ? "past" : index === current ? "current" : "future"}
              aria-current={index === current ? "step" : undefined}
            >
              {stage.label}
            </Stage>
          </Fragment>
        ))}
        <StripDivider aria-hidden />
        <span>
          Trump{" "}
          <Suit $red={isRedSuit(state.trumpSuit)} aria-label={state.trumpSuit}>
            {suitSymbols[state.trumpSuit]}
          </Suit>
        </span>
        {showCount && (
          <>
            <StripDivider aria-hidden />
            {state.phase === PodridaPhase.bidding ? (
              <Count $color={totalColors[bidTotalState(bidTotal, state.cardsPerPlayer)]}>
                Bids {bidTotal} / {state.cardsPerPlayer}
              </Count>
            ) : (
              <Count>
                Trick {state.trickNumber} / {state.cardsPerPlayer}
              </Count>
            )}
          </>
        )}
      </Strip>

      <Right data-box="top right">
        <Tooltip
          text={`Round ${state.roundNumber} of ${state.roundCount} · ${cards} each · ${direction}`}
        >
          <RoundInfo tabIndex={0}>
            <strong>
              Round {pad(state.roundNumber)} / {pad(state.roundCount)}
            </strong>
            <span>{cards}</span>
          </RoundInfo>
        </Tooltip>
        {actions}
      </Right>
    </Bar>
  );
}
