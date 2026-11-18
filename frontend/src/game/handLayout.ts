import { isRedSuit, suits, type Card, type Suit } from "@podrida/shared";
import type { GameLayout } from "./layout";
import type { SortMode } from "./settings";

// SORTING. High cards on the left in every rank order: the ace first, the 2 last.

// The trump suit is always the leftmost group, then the colours alternate: the other colour, the
// trump's colour, the other colour.
export const suitOrder = (trump: Suit): Suit[] => {
  const others = suits.filter((suit) => suit !== trump);
  const opposite = others.filter((suit) => isRedSuit(suit) !== isRedSuit(trump));
  const same = others.filter((suit) => isRedSuit(suit) === isRedSuit(trump));
  return [trump, opposite[0], same[0], opposite[1]];
};

export function sortHand(hand: Card[], mode: SortMode, trump: Suit): Card[] {
  const order = suitOrder(trump);
  const bySuit = (a: Card, b: Card) => order.indexOf(a.suit) - order.indexOf(b.suit);
  const byRankHighFirst = (a: Card, b: Card) => b.rank - a.rank;

  switch (mode) {
    case "suitRank":
      return [...hand].sort((a, b) => bySuit(a, b) || byRankHighFirst(a, b));
    case "suit":
      // Grouped by suit, each group in the order its cards were dealt (sort is stable).
      return [...hand].sort(bySuit);
    case "rank":
      return [...hand].sort((a, b) => byRankHighFirst(a, b) || bySuit(a, b));
    default:
      return hand;
  }
}

// PLACING THE CARDS: centred in the hand's area. Up to 6 sit side by side with a small gap; more
// overlap, each still showing at least its corner index.
export function handPositions(count: number, layout: GameLayout) {
  const { w } = layout.handCard;
  const available = layout.hand.w;
  const step =
    count <= 6 ? w + 8 * layout.u : Math.min(w * 0.72, (available - w) / Math.max(1, count - 1));
  const rowWidth = w + step * Math.max(0, count - 1);
  const start = layout.hand.x + (available - rowWidth) / 2;

  return Array.from({ length: count }, (_, index) => start + index * step);
}
