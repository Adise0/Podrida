import {
  type BotDifficulty,
  isRedSuit,
  suitSymbols,
  type PodridaRoundRecord,
  type Suit,
} from "@podrida/shared";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styled, { css, keyframes } from "styled-components";
import { g, goldButton, panel } from "../tokens";
import { CloseIcon, CrownIcon } from "./Icons";
import { GameAvatar, PlayerName, SecondaryButton } from "./primitives";

export interface SheetPlayer {
  userId: string;
  username: string;
  avatarUrl?: string;
  seat: number;
  bot?: BotDifficulty;
}

export interface CurrentRound {
  roundNumber: number;
  trumpSuit: Suit;
  dealerId: string;
  bids: Record<string, number | null>;
  tricksWon: Record<string, number>;
}

const initials = (name: string) =>
  name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

// STANDINGS

const Standings = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const StandingChip = styled.span<{ $mine: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px 0 6px;
  border: 1px solid ${({ $mine }) => ($mine ? g.gold : g.controlBorder)};
  border-radius: 18px;
  background: ${g.control};
  font-size: 13px;

  b {
    font-family: ${g.serif};
    font-size: 18px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  b[data-negative="true"] {
    color: ${g.danger};
  }

  svg {
    color: ${g.gold};
  }
`;

export function StandingsStrip({
  players,
  totals,
  meId,
}: {
  players: SheetPlayer[];
  totals: Record<string, number>;
  meId?: string;
}) {
  const sorted = [...players].sort((a, b) => (totals[b.userId] ?? 0) - (totals[a.userId] ?? 0));
  const best = Math.max(...players.map((player) => totals[player.userId] ?? 0));

  return (
    <Standings>
      {sorted.map((player) => {
        const total = totals[player.userId] ?? 0;
        return (
          <StandingChip key={player.userId} $mine={player.userId === meId}>
            <GameAvatar
              name={player.username}
              avatarUrl={player.avatarUrl}
              seat={player.seat}
              size={24}
              bot={player.bot}
            />
            {total === best && <CrownIcon />}
            <span>
              <PlayerName name={player.username} isBot={Boolean(player.bot)} />
            </span>
            <b data-negative={total < 0}>{total}</b>
          </StandingChip>
        );
      })}
    </Standings>
  );
}

// THE TABLE: one row per player, one column per round, wrapping in blocks so every round shows.

const roundsPerBlock = 12;

const Blocks = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Grid = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: 12px;
  font-variant-numeric: tabular-nums;

  th,
  td {
    padding: 6px 4px;
    text-align: center;
    vertical-align: middle;
  }

  tbody tr + tr td,
  tbody tr + tr th {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
`;

const NameCell = styled.th`
  width: 150px;
  text-align: left !important;
  font-weight: 600;

  span {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
  }
`;

const RoundHead = styled.th<{ $current: boolean; $peak: boolean }>`
  color: ${g.muted};
  font-weight: 500;
  line-height: 1.3;

  strong {
    display: block;
    color: ${g.text};
    font-family: ${g.serif};
    font-size: 17px;
    font-weight: 700;
  }

  ${({ $current }) =>
    $current &&
    css`
      background: rgba(216, 188, 126, 0.12);
      border-radius: 6px 6px 0 0;
    `}

  ${({ $peak }) =>
    $peak &&
    css`
      box-shadow:
        inset 1px 0 0 rgba(216, 188, 126, 0.25),
        inset -1px 0 0 rgba(216, 188, 126, 0.25);
    `}
`;

const Cell = styled.td<{ $state: "met" | "missed" | "current" | "future"; $peak: boolean }>`
  position: relative;
  line-height: 1.35;

  ${({ $state }) =>
    ($state === "met" || $state === "missed") &&
    css`
      &::before {
        content: "";
        position: absolute;
        left: 3px;
        top: 6px;
        bottom: 6px;
        width: 2px;
        border-radius: 1px;
        background: ${$state === "met" ? g.success : g.danger};
      }
    `}

  ${({ $state }) =>
    $state === "current" &&
    css`
      background: rgba(216, 188, 126, 0.12);
    `}

  ${({ $state }) =>
    $state === "future" &&
    css`
      color: rgba(241, 234, 216, 0.25);
    `}

  ${({ $peak }) =>
    $peak &&
    css`
      box-shadow:
        inset 1px 0 0 rgba(216, 188, 126, 0.25),
        inset -1px 0 0 rgba(216, 188, 126, 0.25);
    `}
`;

const BidLine = styled.span`
  display: block;
  color: ${g.text};
`;

// The running total after the round, then the round's points (gold met, red missed), smaller.
const RunningLine = styled.span`
  display: block;
  color: ${g.text};
  font-weight: 600;
`;

const PointsLine = styled.span<{ $met: boolean }>`
  display: block;
  color: ${({ $met }) => ($met ? g.goldText : g.danger)};
  font-size: 11px;
  opacity: 0.75;
`;

const TotalCell = styled.td<{ $negative: boolean }>`
  width: 64px;
  color: ${({ $negative }) => ($negative ? g.danger : g.text)};
  font-family: ${g.serif};
  font-size: 20px;
  font-weight: 700;
`;

const SuitMark = styled.span<{ $suit: Suit }>`
  color: ${({ $suit }) => (isRedSuit($suit) ? "#E07A65" : g.text)};
`;

interface ScoreTableProps {
  players: SheetPlayer[]; // In the order to show them.
  schedule: number[]; // Cards per round.
  history: PodridaRoundRecord[];
  current: CurrentRound | null;
  totals: Record<string, number>;
  names: Record<string, string>; // For the dealers' initials.
  currentBlockRef?: React.Ref<HTMLTableElement>;
}

export function ScoreTable({
  players,
  schedule,
  history,
  current,
  totals,
  names,
  currentBlockRef,
}: ScoreTableProps) {
  const blockCount = Math.ceil(schedule.length / roundsPerBlock);
  const blockSize = Math.ceil(schedule.length / blockCount);
  // The rounds at the most cards (one per player), outlined.
  const max = Math.max(...schedule);
  const isPeakRound = (number: number) => schedule[number - 1] === max;
  const byNumber = new Map(history.map((record) => [record.number, record]));

  const blocks = Array.from({ length: blockCount }, (_, index) =>
    schedule
      .map((cards, round) => ({ number: round + 1, cards }))
      .slice(index * blockSize, (index + 1) * blockSize),
  );

  return (
    <Blocks>
      {blocks.map((rounds, blockIndex) => {
        const isLast = blockIndex === blocks.length - 1;
        const hasCurrent = rounds.some((round) => round.number === current?.roundNumber);

        return (
          <Grid key={rounds[0].number} ref={hasCurrent ? currentBlockRef : undefined}>
            <thead>
              <tr>
                <NameCell as="th" scope="col">
                  <span style={{ color: g.muted, fontWeight: 500 }}>
                    Rounds {rounds[0].number}–{rounds[rounds.length - 1].number}
                  </span>
                </NameCell>
                {rounds.map(({ number, cards }) => {
                  const record = byNumber.get(number);
                  const isCurrent = current?.roundNumber === number;
                  const trump = record?.trumpSuit ?? (isCurrent ? current?.trumpSuit : undefined);
                  const dealer = record?.dealerId ?? (isCurrent ? current?.dealerId : undefined);
                  return (
                    <RoundHead
                      key={number}
                      scope="col"
                      $current={isCurrent}
                      $peak={isPeakRound(number)}
                    >
                      <strong aria-label={`${cards} card${cards === 1 ? "" : "s"}`}>{cards}</strong>
                      Round {number}
                      <br />
                      {trump && <SuitMark $suit={trump}>{suitSymbols[trump]}</SuitMark>}
                      {dealer && ` · ${initials(names[dealer] ?? "")}`}
                    </RoundHead>
                  );
                })}
                {/* Keeps the columns lined up across blocks. */}
                {Array.from({ length: blockSize - rounds.length }, (_, index) => (
                  <th key={`pad-${index}`} aria-hidden />
                ))}
                {isLast && <th style={{ width: 64 }}>Total</th>}
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.userId}>
                  <NameCell scope="row">
                    <span>
                      <GameAvatar
                        name={player.username}
                        avatarUrl={player.avatarUrl}
                        seat={player.seat}
                        size={22}
                        bot={player.bot}
                      />
                      <PlayerName name={player.username} isBot={Boolean(player.bot)} />
                    </span>
                  </NameCell>
                  {rounds.map(({ number }) => {
                    const record = byNumber.get(number);
                    const result = record?.results.find((entry) => entry.userId === player.userId);
                    const isPeak = isPeakRound(number);

                    if (result) {
                      const met = result.bid === result.won;
                      return (
                        <Cell key={number} $state={met ? "met" : "missed"} $peak={isPeak}>
                          <BidLine>
                            {result.bid} / {result.won}
                          </BidLine>
                          <RunningLine>{result.total}</RunningLine>
                          <PointsLine $met={met}>
                            {result.points > 0
                              ? `+${result.points}`
                              : `−${Math.abs(result.points)}`}
                          </PointsLine>
                        </Cell>
                      );
                    }

                    if (current?.roundNumber === number) {
                      const bid = current.bids[player.userId];
                      return (
                        <Cell key={number} $state="current" $peak={isPeak}>
                          <BidLine>
                            {bid ?? "–"} / {current.tricksWon[player.userId] ?? 0}…
                          </BidLine>
                        </Cell>
                      );
                    }

                    return (
                      <Cell
                        key={number}
                        $state="future"
                        $peak={isPeak}
                        aria-label="Not played yet"
                      />
                    );
                  })}
                  {Array.from({ length: blockSize - rounds.length }, (_, index) => (
                    <td key={`pad-${index}`} aria-hidden />
                  ))}
                  {isLast && (
                    <TotalCell $negative={(totals[player.userId] ?? 0) < 0}>
                      {totals[player.userId] ?? 0}
                    </TotalCell>
                  )}
                </tr>
              ))}
            </tbody>
          </Grid>
        );
      })}
    </Blocks>
  );
}

// THE MODAL

const appear = keyframes`
  from {
    opacity: 0;
    transform: scale(calc(1 - 0.02 * var(--motion, 1)));
  }
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  background: rgba(4, 14, 10, 0.55);
  backdrop-filter: blur(4px);
`;

const Sheet = styled.div`
  ${panel}
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: min(880px, calc(100vw - 48px));
  max-height: 80vh;
  padding: 24px 24px 20px;
  overflow-y: auto;
  animation: ${appear} ${g.ms(200)} ${g.ease};
`;

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

  h2 {
    margin: 0;
    font-family: ${g.serif};
    font-size: 26px;
    font-weight: 600;
  }

  p {
    margin: 2px 0 0;
    color: ${g.muted};
    font-size: 13px;
  }
`;

const CloseButton = styled.button`
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid ${g.controlBorder};
  border-radius: 8px;
  background: ${g.control};
  color: ${g.text};
  cursor: pointer;
`;

const GameOver = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border: 1px solid rgba(216, 188, 126, 0.4);
  border-radius: 12px;
  background: rgba(216, 188, 126, 0.08);

  h3 {
    margin: 0;
    color: ${g.goldText};
    font-family: ${g.serif};
    font-size: 24px;
    font-weight: 600;
  }

  p {
    margin: 2px 0 0;
  }

  div:last-child {
    display: flex;
    gap: 10px;
  }
`;

const PlayAgain = styled.button`
  ${goldButton}
  height: 42px;
  padding: 0 22px;
  font-size: 14px;
`;

interface ScoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  subtitle: string;
  players: SheetPlayer[];
  meId: string;
  schedule: number[];
  history: PodridaRoundRecord[];
  current: CurrentRound | null;
  totals: Record<string, number>;
  gameOver?: {
    onPlayAgain: () => void;
    onLeave: () => void;
    isPending: boolean;
    error?: ReactNode;
  };
}

export function ScoreSheet({
  isOpen,
  onClose,
  subtitle,
  players,
  meId,
  schedule,
  history,
  current,
  totals,
  gameOver,
}: ScoreSheetProps) {
  const currentBlock = useRef<HTMLTableElement>(null);
  const names = Object.fromEntries(players.map((player) => [player.userId, player.username]));

  useEffect(() => {
    if (!isOpen) return undefined;
    currentBlock.current?.scrollIntoView({ block: "nearest" });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !gameOver) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, gameOver]);

  if (!isOpen) return null;

  const best = Math.max(...players.map((player) => totals[player.userId] ?? 0));
  const winners = players.filter((player) => (totals[player.userId] ?? 0) === best);
  const winnerNames = winners.map((player) => (player.userId === meId ? "You" : player.username));
  const winnerText =
    winnerNames.length === 1
      ? `${winnerNames[0]} win${winnerNames[0] === "You" ? "" : "s"} with ${best}`
      : `${winnerNames.slice(0, -1).join(", ")} & ${winnerNames.at(-1)} win with ${best}`;

  // The game's Tab/S shortcuts live in GameScreen; this one is only Esc.
  return createPortal(
    <Backdrop
      className="podrida-game"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !gameOver) onClose();
      }}
    >
      <Sheet role="dialog" aria-modal="true" aria-labelledby="score-sheet-title">
        <Header>
          <div>
            <h2 id="score-sheet-title">Score sheet</h2>
            <p>{subtitle}</p>
          </div>
          {!gameOver && (
            <CloseButton type="button" aria-label="Close" onClick={onClose}>
              <CloseIcon />
            </CloseButton>
          )}
        </Header>

        {gameOver && (
          <GameOver>
            <div>
              <h3>Game over</h3>
              <p>{winnerText}</p>
            </div>
            <div>
              <SecondaryButton type="button" onClick={gameOver.onLeave}>
                Leave
              </SecondaryButton>
              <PlayAgain type="button" onClick={gameOver.onPlayAgain} disabled={gameOver.isPending}>
                Play again
              </PlayAgain>
            </div>
          </GameOver>
        )}
        {gameOver?.error}

        <StandingsStrip players={players} totals={totals} meId={meId} />
        <ScoreTable
          players={players}
          schedule={schedule}
          history={history}
          current={current}
          totals={totals}
          names={names}
          currentBlockRef={currentBlock}
        />
      </Sheet>
    </Backdrop>,
    document.body,
  );
}
