import {
  isRedSuit,
  suitSymbols,
  trickWinner,
  type Card,
  type Game,
  type PlayedCard,
  type PodridaRoundRecord,
  type Suit,
} from "@podrida/shared";
import { forwardRef, useEffect, useState, type CSSProperties } from "react";
import styled, { css, keyframes } from "styled-components";
import { CardFace, SuitOnlyCard } from "../cards/PlayingCard";
import type { Box, GameLayout } from "../layout";
import { fs, g, label, panel, uu } from "../tokens";
import { GameAvatar } from "./primitives";

const at = (box: Box): CSSProperties => ({ left: box.x, top: box.y, width: box.w, height: box.h });

const Tag = styled.span`
  ${label}
  position: absolute;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
`;

// TRUMP

const TrumpCard = styled.div`
  position: absolute;

  & > div {
    box-shadow:
      0 0 0 1px rgba(216, 188, 126, 0.25),
      0 0 22px rgba(216, 188, 126, 0.22),
      0 6px 16px rgba(0, 0, 0, 0.25);
  }
`;

export function TrumpSlot({
  card,
  suit,
  layout,
}: {
  card: Card | null;
  suit: Suit;
  layout: GameLayout;
}) {
  const { trump, tableCard, tagsTop, u } = layout;

  return (
    <>
      <TrumpCard style={at(trump)} data-box="trump">
        {card ? (
          <CardFace card={card} width={tableCard.w} height={tableCard.h} />
        ) : (
          <SuitOnlyCard suit={suit} width={tableCard.w} height={tableCard.h} />
        )}
      </TrumpCard>
      {/* Wider than a small card: it uses half the gap on each side, clear of the trick's tags. */}
      <Tag
        style={{ left: trump.x - 18 * u, top: tagsTop, width: trump.w + 36 * u, height: 16 * u }}
      >
        Trump · <b style={{ color: isRedSuit(suit) ? "#E07A65" : g.text }}>{suitSymbols[suit]}</b>
      </Tag>
    </>
  );
}

// TRICK: stacked in play order, each card on top of the one before, offset so every card's corner
// index shows. The lead is at the bottom left, the newest card fully visible on top.

const slideIn = keyframes`
  from {
    transform: translate(calc(var(--from-x) * var(--motion, 1)), calc(var(--from-y) * var(--motion, 1)));
    opacity: 0;
  }
`;

const TrickBox = styled.div`
  position: absolute;
`;

const Placeholder = styled.div<{ $drop: DropState }>`
  position: absolute;
  top: 0;
  display: grid;
  place-items: center;
  padding: ${uu(6)};
  border: 2px dashed ${({ $drop }) => ($drop === "over" ? g.gold : g.dashed)};
  border-radius: 8px;
  color: ${({ $drop }) => ($drop === "over" ? g.goldText : g.muted)};
  font-size: ${fs(13)};
  text-align: center;
  transition:
    border-color 150ms ${g.ease},
    box-shadow 150ms ${g.ease};

  ${({ $drop }) =>
    $drop === "over" &&
    css`
      box-shadow: 0 0 24px rgba(216, 188, 126, 0.35);
    `}
`;

const TrickCard = styled.div<{ $winning: boolean; $collect: boolean; $lift: number }>`
  position: absolute;
  top: 0;
  animation: ${slideIn} ${g.ms(300)} ${g.ease};
  transition:
    transform ${g.ms(300)} ${g.ease},
    opacity ${g.ms(400)} ${g.ease};
  transform: translateY(${({ $winning, $lift }) => ($winning ? -$lift : 0)}px);

  & > div {
    outline: 2px solid ${({ $winning }) => ($winning ? g.gold : "transparent")};
    outline-offset: -1px;
    transition: outline-color ${g.ms(200)} ${g.ease};
  }

  ${({ $collect }) =>
    $collect &&
    css`
      transform: translate(
          calc(var(--to-x) * var(--motion, 1)),
          calc(var(--to-y) * var(--motion, 1))
        )
        scale(0.6);
      opacity: 0;
      transition-duration: ${g.ms(400)};
    `}
`;

export type DropState = "none" | "armed" | "over";

interface TrickAreaProps {
  trick: PlayedCard[];
  trump: Suit;
  layout: GameLayout;
  emptyLabel: string; // "Your lead" or "Arthur leads".
  names: Record<string, string>;
  origins: Record<string, { x: number; y: number }>; // Each player's seat, for the slides.
  winnerId: string | null; // While the finished trick is shown.
  holdMs: number; // How long the winner shows before the cards go to them.
  drop: DropState;
}

export const TrickArea = forwardRef<HTMLDivElement, TrickAreaProps>(function TrickArea(
  { trick, trump, layout, emptyLabel, names, origins, winnerId, holdMs, drop },
  ref,
) {
  const { trick: box, tableCard, trickOffset, tagsTop, u } = layout;
  const [collectedTrick, setCollectedTrick] = useState<string | null>(null);
  const winning = trick.length > 0 ? trickWinner(trick, trump).userId : null;
  const trickKey = trick.map((played) => `${played.card.rank}${played.card.suit}`).join();
  const isCollecting = Boolean(winnerId) && collectedTrick === trickKey;

  // The finished trick: the winner shows, then the cards slide together to them.
  useEffect(() => {
    if (!winnerId) return undefined;
    const timer = setTimeout(() => setCollectedTrick(trickKey), holdMs);
    return () => clearTimeout(timer);
  }, [winnerId, holdMs, trickKey]);

  // The stack is centred in the trick's space.
  const stackWidth = tableCard.w + Math.max(0, trick.length - 1) * trickOffset;
  const stackLeft = (box.w - stackWidth) / 2;
  const cardX = (index: number) => stackLeft + index * trickOffset;
  const to = winnerId ? origins[winnerId] : undefined;

  return (
    <TrickBox ref={ref} style={at(box)} data-box="trick">
      {(trick.length === 0 || drop === "over") && (
        <Placeholder
          $drop={drop}
          style={{
            left:
              trick.length === 0 ? stackLeft : Math.min(cardX(trick.length), box.w - tableCard.w),
            width: tableCard.w,
            height: tableCard.h,
            zIndex: trick.length + 1,
          }}
        >
          {drop === "over" ? "Drop to play" : emptyLabel}
        </Placeholder>
      )}
      {trick.map((played, index) => {
        const from = origins[played.userId] ?? { x: box.x, y: box.y + 400 * u };
        const x = cardX(index);
        return (
          <TrickCard
            key={`${played.card.rank}-${played.card.suit}`}
            $winning={played.userId === winning}
            $collect={isCollecting}
            $lift={6 * u}
            style={
              {
                left: x,
                // Play order, always: the winner lifts but stays where it is in the stack.
                zIndex: index + 1,
                "--from-x": `${from.x - (box.x + x + tableCard.w / 2)}px`,
                "--from-y": `${from.y - (box.y + tableCard.h / 2)}px`,
                "--to-x": `${to ? to.x - (box.x + x + tableCard.w / 2) : 0}px`,
                "--to-y": `${to ? to.y - (box.y + tableCard.h / 2) : 0}px`,
              } as CSSProperties
            }
          >
            <CardFace card={played.card} width={tableCard.w} height={tableCard.h} />
          </TrickCard>
        );
      })}
      {/* Each name under its card's visible strip, the last one under the whole card. */}
      {trick.map((played, index) => {
        const isLast = index === trick.length - 1;
        const width = isLast ? tableCard.w : trickOffset;
        const name = names[played.userId] ?? "";
        // Under a covered card there's only room for the initial: the name is on hover.
        const fits = isLast || width >= name.length * 8.5 * u + 4;
        return (
          <Tag
            key={played.userId}
            title={name}
            style={{
              left: cardX(index),
              top: tagsTop - box.y,
              width,
              height: 16 * u,
              textAlign: isLast ? "center" : "left",
              textTransform: "none",
              letterSpacing: 0,
              fontWeight: 500,
            }}
          >
            {fits ? name : name.slice(0, 1)}
          </Tag>
        );
      })}
    </TrickBox>
  );
});

// THE LINES UNDER THE CARDS: the last action, the heading, the hint.

const Line = styled.p`
  position: absolute;
  margin: 0;
  overflow: hidden;
  color: ${g.muted};
  font-size: ${fs(13)};
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export function LastAction({ text, box }: { text: string; box: Box }) {
  return (
    <Line
      style={{ ...at(box), lineHeight: `${box.h}px` }}
      title={text}
      aria-live="polite"
      aria-atomic
      data-box="last action"
    >
      {text}
    </Line>
  );
}

const Heading = styled.h2`
  position: absolute;
  margin: 0;
  overflow: hidden;
  color: ${g.text};
  font-family: ${g.serif};
  font-size: ${fs(26)};
  font-weight: 600;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;

  .bullet {
    color: ${g.goldText};
  }
`;

export function StatusHeading({
  heading,
  hint,
  error,
  layout,
}: {
  heading: string;
  hint: string;
  error: string | null;
  layout: GameLayout;
}) {
  // "• Your turn" keeps its gold bullet; everything else is plain.
  const bullet = heading.startsWith("• ");

  return (
    <>
      <Heading
        style={{ ...at(layout.heading), lineHeight: `${layout.heading.h}px` }}
        data-box="heading"
      >
        {bullet ? (
          <>
            <span className="bullet">•</span> {heading.slice(2)}
          </>
        ) : (
          heading
        )}
      </Heading>
      <Line
        style={{
          ...at(layout.hint),
          lineHeight: `${layout.hint.h}px`,
          color: error ? "#E07A65" : undefined,
        }}
        title={error ?? hint}
        role={error ? "alert" : undefined}
        data-box="hint"
      >
        {error ?? hint}
      </Line>
    </>
  );
}

// ROUND SUMMARY: in the trick's place, sized to fit it.

const SummaryPanel = styled.div`
  ${panel}
  position: absolute;
  display: flex;
  flex-direction: column;
  padding: ${uu(10)} ${uu(16)} ${uu(12)};
  overflow: hidden;
`;

const SummaryTitle = styled.h3`
  margin: 0;
  font-family: ${g.serif};
  font-size: ${fs(20)};
  font-weight: 600;
`;

const SummaryRows = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-evenly;
  min-height: 0;
`;

const SummaryRow = styled.div`
  display: grid;
  grid-template-columns: ${uu(22)} 1fr auto ${uu(48)} ${uu(48)};
  align-items: center;
  gap: ${uu(10)};
  font-size: ${fs(13)};

  span:nth-child(2) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span:nth-child(3) {
    color: ${g.muted};
  }
`;

const Points = styled.span<{ $positive: boolean }>`
  color: ${({ $positive }) => ($positive ? g.goldText : g.danger)};
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
`;

const Total = styled.span`
  font-family: ${g.serif};
  font-size: ${fs(16)};
  font-weight: 700;
  text-align: right;
  font-variant-numeric: tabular-nums;
`;

const LinkButton = styled.button`
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  color: ${g.goldText};
  font-size: ${fs(13)};
  font-weight: 600;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`;

const shrink = keyframes`
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
`;

// Runs out over the time left before the next deal.
const Progress = styled.span<{ $duration: number }>`
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 3px;
  background: ${g.gold};
  transform-origin: left;
  animation: ${shrink} ${({ $duration }) => $duration}ms linear forwards;
`;

// Counts from 0 up to the value over 600ms.
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / 600);
      setShown(Math.round(value * progress));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{shown > 0 ? `+${shown}` : shown < 0 ? `−${Math.abs(shown)}` : "0"}</>;
}

interface RoundSummaryProps {
  record: PodridaRoundRecord;
  game: Game;
  seats: Record<string, number>;
  endsAt: number | null;
  layout: GameLayout;
  onOpenSheet: () => void;
}

export function RoundSummary({
  record,
  game,
  seats,
  endsAt,
  layout,
  onOpenSheet,
}: RoundSummaryProps) {
  const byId = Object.fromEntries(game.players.map((player) => [player.userId, player]));
  const [remaining] = useState(() => Math.max(0, (endsAt ?? Date.now()) - Date.now()));
  const width = Math.min(layout.centre.w, 420 * layout.u);
  const box = {
    x: layout.centrePoint.x - width / 2,
    y: layout.cardsRow.y,
    w: width,
    h: layout.cardsRow.h,
  };

  return (
    <SummaryPanel style={at(box)} role="status" data-box="round summary">
      <SummaryTitle>
        Round {record.number} · {record.cardsPerPlayer} card{record.cardsPerPlayer === 1 ? "" : "s"}
      </SummaryTitle>
      <SummaryRows>
        {record.results.map((result) => {
          const player = byId[result.userId];
          return (
            <SummaryRow key={result.userId}>
              <GameAvatar
                name={player.username}
                avatarUrl={player.avatarUrl}
                seat={seats[result.userId]}
                size={22 * layout.u}
              />
              <span>{player.username}</span>
              <span>
                bid {result.bid} · won {result.won}
              </span>
              <Points $positive={result.points > 0}>
                <CountUp value={result.points} />
              </Points>
              <Total>{result.total}</Total>
            </SummaryRow>
          );
        })}
      </SummaryRows>
      <LinkButton type="button" onClick={onOpenSheet}>
        Open score sheet
      </LinkButton>
      <Progress $duration={remaining} aria-hidden />
    </SummaryPanel>
  );
}
