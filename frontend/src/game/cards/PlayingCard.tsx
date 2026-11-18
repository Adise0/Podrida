import { isRedSuit, rankLabel, suitSymbols, type Card, type Suit } from "@podrida/shared";
import { forwardRef, useState, type HTMLAttributes } from "react";
import styled, { css } from "styled-components";
import { cardWords } from "../rulesText";
import { g } from "../tokens";
import { suitLetters, suitPaths } from "./suitPaths";

// The card: outline, cream face and corner indices (in em, following the card's width: 16px at
// 140px wide). Everything else is drawn inside the pip area, in card units: 100 wide, 140 high.
const Face = styled.div<{ $width: number; $height: number; $red: boolean }>`
  position: relative;
  flex-shrink: 0;
  width: ${({ $width }) => $width}px;
  height: ${({ $height }) => $height}px;
  font-size: ${({ $width }) => $width / 8.75}px;
  border: 1px solid ${g.cardBorder};
  border-radius: 8px;
  background: ${g.cardFace};
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.18),
    0 6px 16px rgba(0, 0, 0, 0.22);
  color: ${({ $red }) => ($red ? g.red : g.black)};
  user-select: none;
  overflow: hidden;
`;

const Corner = styled.span<{ $flipped?: boolean }>`
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 1.5em;
  line-height: 1;

  ${({ $flipped }) =>
    $flipped
      ? css`
          right: 0.35em;
          bottom: 0.4em;
          transform: rotate(180deg);
        `
      : css`
          left: 0.35em;
          top: 0.4em;
        `}
`;

const CornerRank = styled.span`
  font-family: ${g.serif};
  font-size: 1.55em;
  font-weight: 700;
  letter-spacing: -0.04em;
`;

const CornerSuit = styled.span`
  margin-top: 0.08em;
  font-size: 1.05em;
`;

const Art = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;

// THE PIP AREA: 20% to 80% of the width, 14% to 86% of the height.
const area = { x: 20, y: 0.14 * 140, w: 60, h: 0.72 * 140 };

const pipWidth = 18; // 18% of the card's width.
const pipScale = pipWidth / 800;
const pipHeight = 1000 * pipScale;

// Pip centres as fractions of the area (after insetting it by half a pip, so the pips' edges reach
// its edges): 0 the left column or top row, 1 the right column or bottom row.
const third = 1 / 3;
const sixth = 1 / 6;
const sides = (ys: number[]) =>
  ys.flatMap(
    (y) =>
      [
        [0, y],
        [1, y],
      ] as [number, number][],
  );
const pipLayouts: Record<number, [number, number][]> = {
  2: [
    [0.5, 0],
    [0.5, 1],
  ],
  3: [
    [0.5, 0],
    [0.5, 0.5],
    [0.5, 1],
  ],
  4: sides([0, 1]),
  5: [...sides([0, 1]), [0.5, 0.5]],
  6: sides([0, 0.5, 1]),
  7: [...sides([0, 0.5, 1]), [0.5, 0.25]],
  8: [...sides([0, 0.5, 1]), [0.5, 0.25], [0.5, 0.75]],
  9: [...sides([0, third, 2 * third, 1]), [0.5, 0.5]],
  10: [...sides([0, third, 2 * third, 1]), [0.5, sixth], [0.5, 1 - sixth]],
};

const pipCentre = ([fx, fy]: [number, number]) => ({
  x: area.x + pipWidth / 2 + fx * (area.w - pipWidth),
  y: area.y + pipHeight / 2 + fy * (area.h - pipHeight),
});

function Pips({ suit, rank }: { suit: Suit; rank: number }) {
  return (
    <>
      {pipLayouts[rank].map((position, index) => {
        const { x, y } = pipCentre(position);
        // Lower-half pips are turned over, as on classic cards.
        const turn = position[1] > 0.5 ? 180 : 0;
        return (
          <path
            key={index}
            d={suitPaths[suit]}
            transform={`translate(${x} ${y}) rotate(${turn}) scale(${pipScale})`}
          />
        );
      })}
    </>
  );
}

// The single large symbol of aces and of the suit-only trump card: 40% of the width, centred.
function BigSymbol({ suit }: { suit: Suit }) {
  return <path d={suitPaths[suit]} transform={`translate(50 70) scale(${40 / 800})`} />;
}

// COURT CARDS: a classic figure in a thin frame that fills the pip area exactly.

const CourtFrame = styled.div<{ $red: boolean }>`
  position: absolute;
  left: 20%;
  top: 14%;
  width: 60%;
  height: 72%;
  border: 1px solid ${({ $red }) => ($red ? "rgba(181, 64, 47, 0.4)" : "rgba(31, 38, 35, 0.4)")};
  border-radius: 4px;
  overflow: hidden;

  img {
    display: block;
    width: 100%;
    height: 100%;
  }
`;

// If the figure can't load: a large serif letter over a suit symbol, so a card is never blank.
const CourtFallback = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  align-content: center;
  line-height: 1;

  span:first-child {
    font-family: ${g.serif};
    font-size: 3.4em;
    font-weight: 600;
  }

  span:last-child {
    font-size: 2em;
  }
`;

function CourtFigure({ card }: { card: Card }) {
  const [failed, setFailed] = useState(false);
  const red = isRedSuit(card.suit);
  const file = `${rankLabel(card.rank)}${suitLetters[card.suit]}`;

  return (
    <CourtFrame $red={red}>
      {failed ? (
        <CourtFallback aria-hidden>
          <span>{rankLabel(card.rank)}</span>
          <span>{suitSymbols[card.suit]}</span>
        </CourtFallback>
      ) : (
        <img
          src={`/cards/court/${file}.svg`}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
        />
      )}
    </CourtFrame>
  );
}

interface CardFaceProps extends HTMLAttributes<HTMLDivElement> {
  card: Card;
  width: number;
  height: number;
}

export const CardFace = forwardRef<HTMLDivElement, CardFaceProps>(function CardFace(
  { card, width, height, ...props },
  ref,
) {
  const symbol = suitSymbols[card.suit];
  const rank = rankLabel(card.rank);
  const red = isRedSuit(card.suit);
  const corner = (flipped?: boolean) => (
    <Corner $flipped={flipped} aria-hidden>
      <CornerRank>{rank}</CornerRank>
      <CornerSuit>{symbol}</CornerSuit>
    </Corner>
  );

  return (
    <Face
      ref={ref}
      $width={width}
      $height={height}
      $red={red}
      role="img"
      aria-label={cardWords(card)}
      {...props}
    >
      {corner()}
      {card.rank >= 11 && card.rank <= 13 ? (
        <CourtFigure card={card} />
      ) : (
        <Art viewBox="0 0 100 140" preserveAspectRatio="none" fill="currentColor" aria-hidden>
          {card.rank === 14 ? (
            <BigSymbol suit={card.suit} />
          ) : (
            <Pips suit={card.suit} rank={card.rank} />
          )}
        </Art>
      )}
      {corner(true)}
    </Face>
  );
});

// Full-deck rounds have no trump card on the table: the same face, only the suit, like an ace.
export function SuitOnlyCard({
  suit,
  width,
  height,
}: {
  suit: Suit;
  width: number;
  height: number;
}) {
  return (
    <Face
      $width={width}
      $height={height}
      $red={isRedSuit(suit)}
      role="img"
      aria-label={`Trump: ${suit}`}
    >
      <Art viewBox="0 0 100 140" preserveAspectRatio="none" fill="currentColor" aria-hidden>
        <BigSymbol suit={suit} />
      </Art>
    </Face>
  );
}

const Back = styled.div<{ $width: number; $height: number }>`
  position: relative;
  flex-shrink: 0;
  width: ${({ $width }) => $width}px;
  height: ${({ $height }) => $height}px;
  border-radius: ${({ $width }) => Math.max(3, $width / 17)}px;
  background: ${g.cardBack};
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  overflow: hidden;

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
`;

// Burgundy, with a gold hairline frame, a gold diamond holding a club, and small sparkles.
export function CardBack({ width, height }: { width: number; height: number }) {
  return (
    <Back $width={width} $height={height} aria-hidden>
      <svg viewBox="0 0 60 88" preserveAspectRatio="none">
        <rect
          x="4"
          y="4"
          width="52"
          height="80"
          rx="3"
          fill="none"
          stroke={g.gold}
          strokeWidth="0.8"
          opacity="0.8"
        />
        <path d="M30 24 L46 44 L30 64 L14 44 Z" fill="none" stroke={g.gold} strokeWidth="1.2" />
        <path d={suitPaths.clubs} transform="translate(30 44) scale(0.016)" fill={g.gold} />
        {[13, 75].map((y) => (
          <path
            key={y}
            d={`M30 ${y - 3} L30.9 ${y - 0.9} L33 ${y} L30.9 ${y + 0.9} L30 ${y + 3} L29.1 ${y + 0.9} L27 ${y} L29.1 ${y - 0.9} Z`}
            fill={g.gold}
            opacity="0.85"
          />
        ))}
      </svg>
    </Back>
  );
}
