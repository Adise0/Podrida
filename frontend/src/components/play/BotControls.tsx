import {
  BotDifficulty,
  botDifficulties,
  botDifficultyDescriptions,
  botDifficultyLabels,
} from "@podrida/shared";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import styled from "styled-components";
import { EmptySeat } from "./Seat";

// The host's bot controls in a room: on each open seat, a menu to pick a level and add a bot; on
// each bot's seat, a level dropdown and a remove button.

const lastDifficultyKey = "podrida.lastBotDifficulty";

const readLastDifficulty = (): BotDifficulty => {
  try {
    const stored = localStorage.getItem(lastDifficultyKey) as BotDifficulty | null;
    return stored && botDifficulties.includes(stored) ? stored : BotDifficulty.casual;
  } catch {
    return BotDifficulty.casual;
  }
};

const rememberDifficulty = (difficulty: BotDifficulty) => {
  try {
    localStorage.setItem(lastDifficultyKey, difficulty);
  } catch {
    // Private mode or blocked storage: it just isn't remembered.
  }
};

const Popover = styled.div`
  position: absolute;
  z-index: 20;
  top: calc(100% + ${({ theme }) => theme.space(2)});
  left: 0;
  display: flex;
  text-align: left;
  flex-direction: column;
  gap: ${({ theme }) => theme.space(3)};
  width: min(420px, calc(100vw - 32px));
  padding: ${({ theme }) => theme.space(4)};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
`;

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
`;

const Segments = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  border-radius: ${({ theme }) => theme.radii.md};
  overflow: hidden;
`;

const Segment = styled.button<{ $isSelected: boolean }>`
  min-height: 34px;
  padding: 0 ${({ theme }) => theme.space(1)};
  border: 0;
  border-left: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme, $isSelected }) =>
    $isSelected ? theme.colors.text : theme.colors.surface};
  color: ${({ theme, $isSelected }) => ($isSelected ? theme.colors.surface : theme.colors.text)};
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:first-child {
    border-left: 0;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.focus};
    outline-offset: -2px;
  }
`;

const Description = styled.p`
  min-height: 20px;
  margin: 0;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 14px;
`;

const GoldButton = styled.button`
  align-self: flex-end;
  min-height: 38px;
  padding: 0 ${({ theme }) => theme.space(4)};
  border: 1px solid ${({ theme }) => theme.colors.gold};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.gold};
  color: #1e1b16;
  font: inherit;
  font-weight: 700;
  cursor: pointer;

  &:hover:not(:disabled) {
    filter: brightness(1.06);
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

interface AddBotSeatProps {
  onAdd: (difficulty: BotDifficulty) => Promise<unknown>;
}

// An open seat of the host's: clicking it opens the menu under it. The bot takes the next seat.
export function AddBotSeat({ onAdd }: AddBotSeatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [difficulty, setDifficulty] = useState(readLastDifficulty);
  const [isAdding, setIsAdding] = useState(false);
  const [shift, setShift] = useState(0);
  const popover = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Closes on a click outside (the seat's own button toggles it), or Escape.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointer = (event: PointerEvent) => {
      const seat = popover.current?.parentElement;
      if (!seat?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  // Kept on screen: seats on the right open it leftwards. Measured before it's painted.
  useLayoutEffect(() => {
    if (!isOpen || !popover.current) return;
    const seat = popover.current.parentElement?.getBoundingClientRect();
    if (!seat) return;
    const gutter = 16;
    const width = popover.current.offsetWidth;
    const overflow = seat.left + width - (document.documentElement.clientWidth - gutter);
    setShift(-Math.min(Math.max(overflow, 0), seat.left - gutter));
  }, [isOpen]);

  const add = async () => {
    setIsAdding(true);
    try {
      await onAdd(difficulty);
      rememberDifficulty(difficulty);
      setIsOpen(false);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <EmptySeat isOpen={isOpen} onClick={() => setIsOpen((open) => !open)}>
      {isOpen && (
        <Popover
          ref={popover}
          role="dialog"
          aria-labelledby={titleId}
          style={{ transform: `translateX(${shift}px)` }}
        >
          <Title id={titleId}>Add a bot</Title>
          <Segments role="radiogroup" aria-label="Difficulty">
            {botDifficulties.map((level) => (
              <Segment
                key={level}
                type="button"
                role="radio"
                aria-checked={level === difficulty}
                $isSelected={level === difficulty}
                onClick={() => setDifficulty(level)}
              >
                {botDifficultyLabels[level]}
              </Segment>
            ))}
          </Segments>
          <Description>{botDifficultyDescriptions[difficulty]}</Description>
          <GoldButton type="button" onClick={add} disabled={isAdding}>
            Add bot
          </GoldButton>
        </Popover>
      )}
    </EmptySeat>
  );
}

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space(1)};
`;

const LevelSelect = styled.select`
  min-height: 28px;
  padding: 0 ${({ theme }) => theme.space(1)};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  font: inherit;
  font-size: 13px;
`;

const RemoveButton = styled.button`
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: transparent;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 15px;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.border};
    color: ${({ theme }) => theme.colors.danger};
  }
`;

const LevelText = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 13px;
`;

interface BotSeatControlsProps {
  name: string;
  difficulty: BotDifficulty;
  isHost: boolean;
  onChange: (difficulty: BotDifficulty) => void;
  onRemove: () => void;
}

// Under a bot's seat: its level (a dropdown for the host), and the host's remove button.
export function BotSeatControls({
  name,
  difficulty,
  isHost,
  onChange,
  onRemove,
}: BotSeatControlsProps) {
  if (!isHost) return <LevelText>{botDifficultyLabels[difficulty]}</LevelText>;

  return (
    <Controls>
      <LevelSelect
        aria-label={`${name}'s difficulty`}
        value={difficulty}
        onChange={(event) => onChange(event.target.value as BotDifficulty)}
      >
        {botDifficulties.map((level) => (
          <option key={level} value={level}>
            {botDifficultyLabels[level]}
          </option>
        ))}
      </LevelSelect>
      <RemoveButton
        type="button"
        title="Remove bot"
        aria-label={`Remove ${name}`}
        onClick={onRemove}
      >
        ✕
      </RemoveButton>
    </Controls>
  );
}
