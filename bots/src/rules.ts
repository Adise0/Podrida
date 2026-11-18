// The Podrida play rules on the bots' card encoding (cards.ts): the same rules as playRule,
// playableCards and trickWinner in @podrida/shared, which the real game enforces, written for
// speed. tests/rules.test.ts checks they agree with the shared ones on many random positions, so
// a bot never plays by rules of its own.
import { above, bitCount as bits, rankOf, SUITS, suitOf, type CardId } from "./cards";

// The highest rank index of a suit among the first `length` cards of a trick, -1 if none.
const bestOfSuit = (trick: ArrayLike<CardId>, length: number, suit: number) => {
  let best = -1;
  for (let index = 0; index < length; index++) {
    const card = trick[index];
    if (suitOf(card) === suit && rankOf(card) > best) best = rankOf(card);
  }
  return best;
};

// Writes the cards of `hand` (four suit masks from `offset`) that may be played on the trick into
// `out` (four masks). Returns how many there are.
export const legalInto = (
  hand: ArrayLike<number>,
  offset: number,
  trick: ArrayLike<CardId>,
  trickLength: number,
  trump: number,
  out: number[] | Int32Array,
): number => {
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;

  const all = () => {
    let count = 0;
    for (let suit = 0; suit < SUITS; suit++) {
      out[suit] = hand[offset + suit];
      count += bits(out[suit]);
    }
    return count;
  };

  if (trickLength === 0) return all();

  const led = suitOf(trick[0]);
  const ledInHand = hand[offset + led];

  if (ledInHand !== 0) {
    // Follow, beating the highest card of the led suit if possible (trumps and off-suit cards in
    // the trick don't count here).
    const toBeat = bestOfSuit(trick, trickLength, led);
    const higher = ledInHand & above(toBeat);
    out[led] = higher !== 0 ? higher : ledInHand;
    return bits(out[led]);
  }

  const trumpsInHand = hand[offset + trump];

  if (trumpsInHand === 0) return all();

  const bestTrump = bestOfSuit(trick, trickLength, trump);

  if (bestTrump === -1) {
    out[trump] = trumpsInHand; // Must trump, with any of them.
    return bits(trumpsInHand);
  }

  const overtrumps = trumpsInHand & above(bestTrump);

  if (overtrumps !== 0) {
    out[trump] = overtrumps;
    return bits(overtrumps);
  }

  return all(); // Can't overtrump: anything goes.
};

// The position in the trick of the card that takes it: the highest trump, or else the highest card
// of the led suit.
export const winningIndex = (trick: ArrayLike<CardId>, length: number, trump: number) => {
  const led = suitOf(trick[0]);
  let best = 0;
  let bestIsTrump = suitOf(trick[0]) === trump;

  for (let index = 1; index < length; index++) {
    const card = trick[index];
    const suit = suitOf(card);
    const current = trick[best];

    if (suit === trump) {
      if (!bestIsTrump || rankOf(card) > rankOf(current)) {
        best = index;
        bestIsTrump = true;
      }
    } else if (!bestIsTrump && suit === led && rankOf(card) > rankOf(current)) {
      best = index;
    }
  }

  return best;
};

// Whether `card` would currently take a trick of `length` cards if played now.
export const wouldWin = (trick: ArrayLike<CardId>, length: number, trump: number, card: CardId) => {
  if (length === 0) return true;
  const current = trick[winningIndex(trick, length, trump)];
  const suit = suitOf(card);
  const currentSuit = suitOf(current);

  if (suit === trump) return currentSuit !== trump || rankOf(card) > rankOf(current);
  if (currentSuit === trump) return false;
  return suit === suitOf(trick[0]) && rankOf(card) > rankOf(current);
};

// Scoring is used as is: the same function as the real game.
export { roundScore as score } from "@podrida/shared";
