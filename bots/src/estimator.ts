// The quick trick estimator: roughly how many tricks a hand takes. It's the whole bidding of the
// Beginner bot, the starting point of the others' bid search, the bid other bots assume for a
// player who hasn't bid yet in a simulation, and what weighs sampled deals against the bids.
//
// The card values are the design guide's starting points; `calibration` scales the total by round
// size, fitted against tournament results (npm run tournament -- --calibrate).
import { bitCount, highestRank, SUITS, type SuitMasks } from "./cards";

const ACE = 12;
const KING = 11;
const QUEEN = 10;

// Actual tricks ≈ estimate × scale, by number of players, then by cards per player (2 to 6, the
// last covering every bigger round). The card values above count for about 4 players; fewer
// players win more with them, more players less. Fitted on Skilled-vs-Skilled games with
// `npm run tournament -- --calibrate --players N` (see the README).
export const calibration: Record<number, Record<number, number>> = {
  2: { 2: 2.78, 3: 2.0, 4: 2.66, 5: 2.23, 6: 2.42 },
  3: { 2: 2.07, 3: 1.67, 4: 1.44, 5: 1.44, 6: 1.62 },
  4: { 2: 1.35, 3: 1.08, 4: 1.14, 5: 1.05, 6: 1.24 },
  5: { 2: 1.35, 3: 0.87, 4: 0.97, 5: 0.96, 6: 0.97 },
  6: { 2: 1.09, 3: 0.78, 4: 0.86, 5: 0.77, 6: 0.82 },
};

const scaleFor = (players: number, cardsPerPlayer: number) =>
  calibration[Math.min(6, Math.max(2, players))]?.[Math.min(6, Math.max(2, cardsPerPlayer))] ?? 1;

export interface EstimateContext {
  trump: number;
  players: number;
  cardsPerPlayer: number;
  // 1-card rounds only: whether this seat leads (a side-suit card can only win if it does), and
  // how many cards nobody has seen (in other hands or undealt).
  leads?: boolean;
  unseen?: number;
}

// The chance none of `draws` unseen cards (the others' single cards) is one of `bad` cards.
const noneOf = (unseen: number, bad: number, draws: number) => {
  let chance = 1;
  for (let index = 0; index < draws; index++) {
    chance *= Math.max(0, unseen - bad - index) / Math.max(1, unseen - index);
  }
  return chance;
};

// One card each: the chance this card takes the trick.
const oneCardEstimate = (hand: SuitMasks, context: EstimateContext) => {
  const { trump, players } = context;
  const unseen = context.unseen ?? 51;
  const others = players - 1;
  const suit = hand.findIndex((mask) => mask !== 0);
  const rank = highestRank(hand[suit]);
  const higher = 12 - rank; // Higher cards of its suit (roughly all unseen).

  if (suit === trump) return noneOf(unseen, higher, others);

  // A side card: nobody may hold a trump or a higher card of its suit, and it has to be led.
  const beaten = noneOf(unseen, higher + 12, others);
  return context.leads ? beaten : beaten * 0.15;
};

export const estimateTricks = (hand: SuitMasks, context: EstimateContext): number => {
  const { trump, players, cardsPerPlayer } = context;
  const size = hand.reduce((total, mask) => total + bitCount(mask), 0);
  if (size === 0) return 0;
  if (cardsPerPlayer === 1) return oneCardEstimate(hand, context);

  const trumps = hand[trump];
  const trumpCount = bitCount(trumps);
  const crowd = Math.max(0.6, 1 - 0.07 * (players - 3)); // More players: more ways to lose a card.
  let tricks = 0;
  let lowTrumps = 0;

  // Trumps: the high ones nearly always win; low ones win more the more of them there are (they
  // outlast the others' trumps).
  let mask = trumps;
  while (mask !== 0) {
    const rank = 31 - Math.clz32(mask & -mask);
    mask &= mask - 1;
    if (rank === ACE) tricks += 0.95;
    else if (rank === KING) tricks += 0.8;
    else if (rank === QUEEN) tricks += 0.6;
    else {
      tricks += 0.25 + 0.05 * Math.min(4, trumpCount);
      lowTrumps++;
    }
  }

  let shortSuits = 0;
  for (let suit = 0; suit < SUITS; suit++) {
    if (suit === trump) continue;
    const cards = hand[suit];
    const length = bitCount(cards);
    if (length <= 1 && cardsPerPlayer >= 3) shortSuits++;
    if ((cards & (1 << ACE)) !== 0) tricks += 0.8 * crowd * (length === 1 ? 0.85 : 1);
    if ((cards & (1 << KING)) !== 0) tricks += (length === 1 ? 0.25 : 0.5) * crowd;
  }

  // A short side suit with trumps to spare: expected ruffs.
  tricks += 0.3 * Math.min(lowTrumps, shortSuits);

  return Math.min(cardsPerPlayer, Math.max(0, tricks * scaleFor(players, cardsPerPlayer)));
};
