import { cardKey, type Card } from "@podrida/shared";
import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import styled, { css, keyframes } from "styled-components";
import { CardFace } from "../cards/PlayingCard";
import { handPositions } from "../handLayout";
import type { GameLayout } from "../layout";
import { g } from "../tokens";

const dealIn = keyframes`
  from {
    transform: translate(calc(var(--deal-x) * var(--motion, 1)), calc(var(--deal-y) * var(--motion, 1))) scale(0.5);
    opacity: 0;
  }
`;

// The hand's area (headroom for lifted cards included). It never moves: nothing else pushes it.
const Area = styled.div`
  position: absolute;
  pointer-events: none;

  &:focus-visible {
    outline: none;
  }
`;

const Slot = styled.div<{ $lift: number; $isDragging: boolean; $dealing: boolean }>`
  position: absolute;
  pointer-events: auto;
  touch-action: none;
  transform: translateY(${({ $lift }) => -$lift}px);
  transition:
    left ${g.ms(300)} ${g.ease},
    transform ${g.ms(250)} ${g.ease};

  & > div {
    transition: box-shadow ${g.ms(200)} ${g.ease};
  }

  ${({ $dealing }) =>
    $dealing &&
    css`
      animation: ${dealIn} ${g.ms(360)} ${g.ease} both;
    `}

  ${({ $isDragging }) =>
    $isDragging &&
    css`
      transition: none;

      & > div {
        box-shadow: 0 22px 44px rgba(0, 0, 0, 0.5);
      }
    `}
`;

const Shade = styled.span`
  position: absolute;
  inset: 0;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.35);
  pointer-events: none;
`;

const Selected = styled.span`
  position: absolute;
  inset: -1px;
  border: 2px solid ${g.gold};
  border-radius: 9px;
  pointer-events: none;
`;

const Focus = styled.span`
  position: absolute;
  inset: -4px;
  border: 2px solid ${g.goldText};
  border-radius: 11px;
  opacity: 0.8;
  pointer-events: none;
`;

const EmptySpot = styled.div`
  position: absolute;
  border: 2px dashed ${g.dashed};
  border-radius: 8px;
`;

// The gold line under the cards on the local player's turn, fading out at both ends.
const Baseline = styled.span`
  position: absolute;
  height: 2px;
  background: linear-gradient(90deg, transparent, ${g.gold} 20%, ${g.gold} 80%, transparent);
  opacity: 0.85;
`;

interface Drag {
  key: string;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  isDragging: boolean;
}

interface HandProps {
  cards: Card[]; // In display order.
  layout: GameLayout;
  playable: Set<string> | null; // Keys of the cards that can be chosen now; null: none can.
  showUnplayable: boolean; // Darken what can't be played (the local player's turn to play).
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onPlay: (card: Card) => void;
  doubleClickToPlay: boolean;
  roundNumber: number; // Every round's cards are new ones, so each deal flies in.
  isDealing: boolean;
  isMyTurn: boolean;
  dropZone: RefObject<HTMLDivElement | null>;
  onDropHover: (state: "none" | "armed" | "over") => void;
}

export function Hand({
  cards,
  layout,
  playable,
  showUnplayable,
  selectedKey,
  onSelect,
  onPlay,
  doubleClickToPlay,
  roundNumber,
  isDealing,
  isMyTurn,
  dropZone,
  onDropHover,
}: HandProps) {
  const { hand: area, handCard, handCardsTop, centrePoint, u } = layout;
  const positions = handPositions(cards.length, layout);
  const [hovered, setHovered] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const top = handCardsTop - area.y; // Inside the area, under the headroom.
  const canChoose = (key: string) => playable?.has(key) ?? false;
  const stagger = Math.min(60, 1500 / Math.max(1, cards.length));

  const isOverDropZone = (clientX: number, clientY: number) => {
    const rect = dropZone.current?.getBoundingClientRect();
    return Boolean(
      rect &&
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom,
    );
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>, key: string) => {
    if (!canChoose(key) || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      key,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      dy: 0,
      isDragging: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = dragRef.current;
    if (!current) return;

    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    const isDragging = current.isDragging || Math.hypot(dx, dy) > 6;
    dragRef.current = { ...current, dx, dy, isDragging };

    if (isDragging) {
      setDrag(dragRef.current);
      onDropHover(isOverDropZone(event.clientX, event.clientY) ? "over" : "armed");
    }
  };

  const endDrag = () => {
    dragRef.current = null;
    setDrag(null);
    onDropHover("none");
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>, card: Card) => {
    const current = dragRef.current;
    endDrag();
    if (!current) return;

    if (!current.isDragging) {
      // A click: select it, or let go of it.
      onSelect(selectedKey === current.key ? null : current.key);
      return;
    }

    if (isOverDropZone(event.clientX, event.clientY)) onPlay(card);
    // Anywhere else, it just goes back to its place (the transition takes it there).
  };

  const playableInOrder = cards.filter((card) => canChoose(cardKey(card)));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (playableInOrder.length === 0) return;
    const index = playableInOrder.findIndex((card) => cardKey(card) === focused);

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 1 : -1;
      const next =
        index === -1 ? 0 : (index + step + playableInOrder.length) % playableInOrder.length;
      setFocused(cardKey(playableInOrder[next]));
    } else if ((event.key === "Enter" || event.key === " ") && index !== -1) {
      event.preventDefault();
      onPlay(playableInOrder[index]);
    }
  };

  const rowLeft = positions[0] ?? 0;
  const rowRight = (positions.at(-1) ?? 0) + handCard.w;

  return (
    <Area
      style={{ left: area.x, top: area.y, width: area.w, height: area.h }}
      tabIndex={playableInOrder.length > 0 ? 0 : -1}
      onKeyDown={onKeyDown}
      onBlur={() => setFocused(null)}
      aria-label="Your hand. Left and right arrows choose a card, Enter plays it."
      role="group"
      data-box="hand"
    >
      {isMyTurn && cards.length > 0 && (
        <Baseline
          style={{
            left: rowLeft - area.x - 20 * u,
            width: rowRight - rowLeft + 40 * u,
            top: top + handCard.h + 6 * u,
          }}
        />
      )}

      {drag?.isDragging && (
        <EmptySpot
          style={{
            left: positions[cards.findIndex((card) => cardKey(card) === drag.key)] - area.x,
            top,
            width: handCard.w,
            height: handCard.h,
          }}
          aria-hidden
        />
      )}

      {cards.map((card, index) => {
        const key = cardKey(card);
        const isDragged = drag?.isDragging && drag.key === key;
        const isSelected = selectedKey === key;
        const isHovered = hovered === key;
        const lift = (isSelected ? 24 : isHovered ? 14 : 0) * u;
        const zIndex = isDragged ? 300 : isHovered ? 200 : isSelected ? 150 : index + 1;
        const left = positions[index] - area.x;
        const style: CSSProperties & Record<string, string | number> = {
          left,
          top,
          zIndex,
          cursor: canChoose(key)
            ? isDragged
              ? "grabbing"
              : "pointer"
            : showUnplayable
              ? "not-allowed"
              : "default",
          animationDelay: `${index * stagger}ms`,
          "--deal-x": `${centrePoint.x - handCard.w / 2 - positions[index]}px`,
          "--deal-y": `${centrePoint.y - handCard.h / 2 - handCardsTop}px`,
        };

        if (isDragged && drag) {
          style.transform = `translate(${drag.dx}px, ${drag.dy - lift}px) rotate(4deg)`;
        }

        return (
          <Slot
            // The same for the whole round: the sort after the deal slides the cards into place.
            key={`${roundNumber}-${key}`}
            $lift={lift}
            $isDragging={Boolean(isDragged)}
            $dealing={isDealing}
            style={style}
            data-animating={isDragged ? "true" : undefined}
            onPointerEnter={() => setHovered(key)}
            onPointerLeave={() => setHovered((current) => (current === key ? null : current))}
            onPointerDown={(event) => onPointerDown(event, key)}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => onPointerUp(event, card)}
            onPointerCancel={endDrag}
            onDoubleClick={() => {
              if (doubleClickToPlay && canChoose(key)) onPlay(card);
            }}
          >
            <CardFace
              card={card}
              width={handCard.w}
              height={handCard.h}
              style={{
                boxShadow:
                  isHovered || isSelected
                    ? "0 2px 4px rgba(0,0,0,0.2), 0 16px 32px rgba(0,0,0,0.38)"
                    : undefined,
              }}
            />
            {showUnplayable && !canChoose(key) && <Shade />}
            {isSelected && <Selected />}
            {focused === key && <Focus />}
          </Slot>
        );
      })}
    </Area>
  );
}
