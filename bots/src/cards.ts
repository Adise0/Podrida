// The bots' own card encoding, for speed: a search plays hundreds of thousands of simulated cards
// per decision. A card is one small integer, a hand is four 13-bit masks (one per suit).
//
//   card = suit * 16 + rank index      rank index: 0 for a 2 ... 12 for an ace
//
// Suits are numbered as in @podrida/shared's `suits`. Only the encoding is here: the rules are in
// rules.ts, checked against the shared rules by the tests.
import { suits, type Card, type Rank, type Suit } from "@podrida/shared";

export type CardId = number;

export const SUITS = 4;
export const RANKS = 13;
export const FULL_SUIT = (1 << RANKS) - 1;

export const suitOf = (card: CardId) => card >> 4;
export const rankOf = (card: CardId) => card & 15; // 0..12
export const cardId = (suit: number, rank: number): CardId => (suit << 4) | rank;

export const suitIndex = (suit: Suit) => suits.indexOf(suit);

export const toId = (card: Card): CardId => cardId(suitIndex(card.suit), card.rank - 2);

export const toCard = (card: CardId): Card => ({
  suit: suits[suitOf(card)],
  rank: (rankOf(card) + 2) as Rank,
});

export const bitCount = (mask: number) => {
  let value = mask - ((mask >> 1) & 0x55555555);
  value = (value & 0x33333333) + ((value >> 2) & 0x33333333);
  return (((value + (value >> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};

// The highest and lowest rank index in a mask (-1 when empty).
export const highestRank = (mask: number) => (mask === 0 ? -1 : 31 - Math.clz32(mask));
export const lowestRank = (mask: number) => (mask === 0 ? -1 : 31 - Math.clz32(mask & -mask));

// The ranks strictly above / below a rank index.
export const above = (rank: number) => FULL_SUIT & ~((2 << rank) - 1);
export const below = (rank: number) => (1 << rank) - 1;

// A hand as four masks.
export type SuitMasks = [number, number, number, number];

export const emptyMasks = (): SuitMasks => [0, 0, 0, 0];

export const masksOf = (cards: Iterable<CardId>): SuitMasks => {
  const masks = emptyMasks();
  for (const card of cards) masks[suitOf(card)] |= 1 << rankOf(card);
  return masks;
};

export const cardsOf = (masks: ArrayLike<number>, offset = 0): CardId[] => {
  const cards: CardId[] = [];
  for (let suit = 0; suit < SUITS; suit++) {
    let mask = masks[offset + suit];
    while (mask !== 0) {
      const rank = 31 - Math.clz32(mask & -mask);
      cards.push(cardId(suit, rank));
      mask &= mask - 1;
    }
  }
  return cards;
};

const rankNames = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const suitLetters = ["C", "D", "S", "H"];

// "KD", "10C": for logs and the scenario files.
export const cardName = (card: CardId) => `${rankNames[rankOf(card)]}${suitLetters[suitOf(card)]}`;

export const parseCard = (name: string): CardId => {
  const match = /^(10|[2-9JQKA])([CDSH])$/i.exec(name.trim());
  if (!match) throw new Error(`Not a card: ${name}`);
  return cardId(
    suitLetters.indexOf(match[2].toUpperCase()),
    rankNames.indexOf(match[1].toUpperCase()),
  );
};

export const parseSuit = (letter: string) => {
  const index = suitLetters.indexOf(letter.trim().toUpperCase());
  if (index === -1) throw new Error(`Not a suit: ${letter}`);
  return index;
};
