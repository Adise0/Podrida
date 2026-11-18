import { suitSymbols, type GamePlayer, type Suit } from "@podrida/shared";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import styled, { css } from "styled-components";
import type { Box, GameLayout } from "../layout";
import { bidTotalWord } from "../rulesText";
import { sortModes, type SortMode } from "../settings";
import { darkControl, fs, g, goldButton, uu } from "../tokens";
import { GameAvatar, RolePills } from "./primitives";

const at = (box: Box): CSSProperties => ({ left: box.x, top: box.y, width: box.w, height: box.h });

const Column = styled.div<{ $align: "start" | "center" | "end" }>`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: ${({ $align }) =>
    $align === "start" ? "flex-start" : $align === "end" ? "flex-end" : "center"};
  gap: ${uu(14)};
  min-width: 0;
`;

const MeText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${uu(2)};
  min-width: 0;
`;

const NameLine = styled.span`
  display: flex;
  align-items: center;
  gap: ${uu(6)};
  min-width: 0;

  strong {
    overflow: hidden;
    color: ${g.text};
    font-size: ${fs(15)};
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const Points = styled.span`
  color: ${g.muted};
  font-size: ${fs(12, 11)};
  font-variant-numeric: tabular-nums;

  &[data-negative="true"] {
    color: ${g.danger};
  }
`;

export const PrimaryButton = styled.button`
  ${goldButton}
  width: min(100%, ${uu(220)});
  height: ${uu(52)};
  font-size: ${fs(16)};
`;

const Segmented = styled.div`
  ${darkControl}
  display: inline-flex;
  padding: 2px;
  height: ${uu(30)};
`;

const Segment = styled.button<{ $active: boolean }>`
  padding: 0 ${uu(10)};
  border: none;
  border-radius: 6px;
  background: ${({ $active }) => ($active ? g.gold : "transparent")};
  color: ${({ $active }) => ($active ? g.dark : g.text)};
  font-family: ${g.sans};
  font-size: ${fs(12, 11)};
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background ${g.ms(150)} ${g.ease};
`;

interface BottomBarProps {
  layout: GameLayout;
  me: GamePlayer;
  seat: number;
  points: number;
  isMyTurn: boolean;
  isDealer: boolean;
  isLeader: boolean;
  action: ReactNode; // The centre column: the Play button, the bid picker, or a waiting label.
  sortMode: SortMode;
  onSort: (mode: SortMode) => void;
}

// Three columns: the local player, the action, the hand's sort. The bid lives above the hand
// (OwnBidStrip), not here.
export function BottomBar({
  layout,
  me,
  seat,
  points,
  isMyTurn,
  isDealer,
  isLeader,
  action,
  sortMode,
  onSort,
}: BottomBarProps) {
  const { left, centre, right } = layout.bottom;

  return (
    <footer>
      <Column $align="start" style={at(left)} data-box="bottom left">
        <GameAvatar
          name={me.username}
          avatarUrl={me.avatarUrl}
          seat={seat}
          size={48 * layout.u}
          ring={isMyTurn ? "active" : "local"}
        />
        <MeText>
          <NameLine>
            <strong title={me.username}>{me.username} (you)</strong>
            <RolePills isDealer={isDealer} isLeader={isLeader} />
          </NameLine>
          <Points data-negative={points < 0}>{points} pts</Points>
        </MeText>
      </Column>

      <Column $align="center" style={at(centre)} data-box="bottom centre">
        {action}
      </Column>

      <Column $align="end" style={at(right)} data-box="bottom right">
        <Segmented role="radiogroup" aria-label="Sort your hand">
          {sortModes.map(({ mode, label }) => (
            <Segment
              key={mode}
              type="button"
              role="radio"
              aria-checked={sortMode === mode}
              $active={sortMode === mode}
              onClick={() => onSort(mode)}
            >
              {label}
            </Segment>
          ))}
        </Segmented>
      </Column>
    </footer>
  );
}

// THE BID PICKER: inside the bottom bar's centre column, in place of the Play button. It fits the
// bar's height: one row of number chips (shrinking down to 28px) or, when they can't fit, a
// −/number/+ stepper. Opening it moves nothing else.

const Picker = styled.div`
  display: flex;
  align-items: center;
  gap: ${uu(12)};
  max-width: 100%;
`;

const Chips = styled.div`
  display: flex;
  gap: ${uu(5)};
`;

const NumberChip = styled.button<{ $selected: boolean; $size: number }>`
  ${darkControl}
  flex-shrink: 0;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  padding: 0;
  font-family: ${g.serif};
  font-size: ${({ $size }) => Math.max(14, $size * 0.5)}px;
  font-weight: 700;
  cursor: pointer;
  transition:
    border-color ${g.ms(120)} ${g.ease},
    background ${g.ms(120)} ${g.ease};

  &:hover {
    border-color: rgba(255, 255, 255, 0.34);
  }

  ${({ $selected }) =>
    $selected &&
    css`
      border-color: ${g.gold};
      background: ${g.gold};
      color: ${g.dark};
    `}
`;

const Stepper = styled.div`
  display: flex;
  align-items: center;
  gap: ${uu(10)};

  output {
    min-width: ${uu(44)};
    font-family: ${g.serif};
    font-size: ${fs(30)};
    font-weight: 700;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  input {
    width: ${uu(130)};
    accent-color: ${g.gold};
  }
`;

const ConfirmButton = styled.button`
  ${goldButton}
  flex-shrink: 0;
  width: ${uu(112)};
  height: ${uu(44)};
  font-size: ${fs(15)};
`;

const Hidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
`;

interface BidPickerProps {
  cardsPerPlayer: number;
  trump: Suit;
  othersTotal: number;
  width: number; // The centre column's width.
  u: number;
  isPending: boolean;
  onBid: (bid: number) => void;
}

// The chips' size if a row of them fits (28px each at the least), null for the stepper.
const chipSizeFor = (options: number, width: number, u: number) => {
  if (options > 13) return null;
  const confirm = 112 * u + 12 * u;
  const size = Math.min(40 * u, (width - confirm) / options - 5 * u);
  return size >= 28 ? size : null;
};

export function BidPicker({
  cardsPerPlayer,
  trump,
  othersTotal,
  width,
  u,
  isPending,
  onBid,
}: BidPickerProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const typed = useRef<{ digits: string; at: number }>({ digits: "", at: 0 });
  const contextId = useId();
  const max = cardsPerPlayer;
  const chipSize = chipSizeFor(max + 1, width, u);

  // Number keys pick (two digits within 600ms make one number), arrows adjust, Enter confirms.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement && event.target.type !== "range") return;

      if (/^\d$/.test(event.key)) {
        const now = Date.now();
        const digits = now - typed.current.at < 600 ? typed.current.digits + event.key : event.key;
        typed.current = { digits, at: now };
        const value = Number(digits);
        const single = Number(event.key);
        if (value <= max) setSelected(value);
        else if (single <= max) setSelected(single);
        event.preventDefault();
      } else if (["ArrowUp", "ArrowRight"].includes(event.key)) {
        setSelected((current) => Math.min(max, (current ?? -1) + 1));
        event.preventDefault();
      } else if (["ArrowDown", "ArrowLeft"].includes(event.key)) {
        setSelected((current) => Math.max(0, (current ?? 1) - 1));
        event.preventDefault();
      } else if (event.key === "Enter" && selected !== null && !isPending) {
        onBid(selected);
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [max, selected, isPending, onBid]);

  // The context ("Others: 3 · if you bid 1 → total 4 of 3, over by 1") is in the tooltip, so the
  // bar never grows; screen readers get it too.
  const total = othersTotal + (selected ?? 0);
  const context = `Others: ${othersTotal}${
    selected === null
      ? ""
      : ` · if you bid ${selected} → total ${total} of ${cardsPerPlayer} (${bidTotalWord(total, cardsPerPlayer).toLowerCase()})`
  } · trump ${suitSymbols[trump]}`;

  return (
    <Picker role="group" aria-label="Your bid" aria-describedby={contextId} title={context}>
      <Hidden id={contextId} aria-live="polite">
        {context}
      </Hidden>
      {chipSize !== null ? (
        <Chips role="radiogroup" aria-label="Tricks you'll win">
          {Array.from({ length: max + 1 }, (_, value) => (
            <NumberChip
              key={value}
              type="button"
              role="radio"
              aria-checked={selected === value}
              $selected={selected === value}
              $size={chipSize}
              onClick={() => setSelected(value)}
            >
              {value}
            </NumberChip>
          ))}
        </Chips>
      ) : (
        <Stepper>
          <NumberChip
            type="button"
            $selected={false}
            $size={32 * u}
            aria-label="One less"
            onClick={() => setSelected((current) => Math.max(0, (current ?? 1) - 1))}
          >
            −
          </NumberChip>
          <output>{selected ?? "–"}</output>
          <NumberChip
            type="button"
            $selected={false}
            $size={32 * u}
            aria-label="One more"
            onClick={() => setSelected((current) => Math.min(max, (current ?? -1) + 1))}
          >
            +
          </NumberChip>
          <input
            type="range"
            min={0}
            max={max}
            value={selected ?? 0}
            aria-label="Tricks you'll win"
            onChange={(event) => setSelected(Number(event.target.value))}
          />
        </Stepper>
      )}
      <ConfirmButton
        type="button"
        disabled={selected === null || isPending}
        onClick={() => selected !== null && onBid(selected)}
      >
        {selected === null ? "Choose" : `Bid ${selected}`}
      </ConfirmButton>
    </Picker>
  );
}
