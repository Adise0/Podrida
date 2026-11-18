// The rollout policy: a fast, rule-of-thumb player for any seat of a simulation. The searches use
// it to play out the rest of a round after each candidate move; it never decides a real move on
// its own, except for the Beginner bot and as the fallback when a search fails.
//
// It only looks at what the seat itself would know: its own hand, the cards gone (played, and
// the trump card), the trick, bids, tricks won, and the voids everyone has seen.
//
// Every seat is in one of two modes, recomputed before each play:
//   WIN  - it still needs tricks for its bid (or can't make it anymore: each trick nearer the bid
//          saves 3 points).
//   DUCK - it's on its bid, or over it: every extra trick costs 3.
import {
  above,
  bitCount,
  cardId,
  FULL_SUIT,
  highestRank,
  lowestRank,
  rankOf,
  SUITS,
  suitOf,
  type CardId,
} from "./cards";
import type { Rng } from "./rng";
import { wouldWin } from "./rules";
import type { Sim } from "./sim";

const scratch = new Int32Array(SUITS);

const NONE = -1;

// A trump is worth more than any other card when deciding what's "cheap".
const cost = (card: CardId, trump: number) => rankOf(card) + (suitOf(card) === trump ? 13 : 0);

// Cards of the suit that aren't in the seat's hand and haven't gone: someone else's, or undealt.
const outstanding = (sim: Sim, seat: number, suit: number) =>
  FULL_SUIT & ~sim.gone[suit] & ~sim.hands[seat * SUITS + suit];

const isBoss = (sim: Sim, seat: number, card: CardId) =>
  (outstanding(sim, seat, suitOf(card)) & above(rankOf(card))) === 0;

// Whether someone still to play this trick may trump the suit: they're known void in it, and not
// known void in trumps.
const trumpThreat = (sim: Sim, seat: number, suit: number) => {
  if (suit === sim.trump) return false;
  if (outstanding(sim, seat, sim.trump) === 0) return false;
  const toPlay = sim.trickLength === 0 ? sim.n - 1 : sim.n - 1 - sim.trickLength;
  for (let step = 1; step <= toPlay; step++) {
    const other = (seat + step) % sim.n;
    const voids = sim.publicVoid[other];
    if ((voids & (1 << suit)) !== 0 && (voids & (1 << sim.trump)) === 0) return true;
  }
  // Few of the suit left out there: someone is probably out of it.
  return bitCount(outstanding(sim, seat, suit)) < toPlay;
};

// How likely the card is to win a trick later, against its holder's will: high, few higher ones
// left, trumps above all. The "K♦ with few diamonds left" a ducking player wants rid of.
const danger = (sim: Sim, seat: number, card: CardId) => {
  const suit = suitOf(card);
  const rank = rankOf(card);
  const out = outstanding(sim, seat, suit);
  const higher = bitCount(out & above(rank));
  const left = bitCount(out);
  let value = rank / 12 + (higher === 0 ? 0.6 : 0.3 / higher);
  if (suit === sim.trump) value += 0.6;
  else if (left <= 2) value += 0.15; // Nearly gone: others will soon be void and can't beat it.
  return value;
};

const suitLength = (sim: Sim, seat: number, suit: number) =>
  bitCount(sim.hands[seat * SUITS + suit]);

// Picks among the cards of `masks` the one with the best `score` (ties: the lower card).
const pick = (masks: Int32Array | number[], score: (card: CardId) => number): CardId => {
  let best = NONE;
  let bestScore = -Infinity;
  for (let suit = 0; suit < SUITS; suit++) {
    let mask = masks[suit];
    while (mask !== 0) {
      const rank = 31 - Math.clz32(mask & -mask);
      mask &= mask - 1;
      const card = cardId(suit, rank);
      const value = score(card);
      if (value > bestScore) {
        bestScore = value;
        best = card;
      }
    }
  }
  return best;
};

const randomOf = (masks: Int32Array | number[], count: number, rng: Rng): CardId => {
  let target = rng.int(count);
  for (let suit = 0; suit < SUITS; suit++) {
    let mask = masks[suit];
    while (mask !== 0) {
      const rank = 31 - Math.clz32(mask & -mask);
      mask &= mask - 1;
      if (target === 0) return cardId(suit, rank);
      target--;
    }
  }
  throw new Error("No legal card");
};

export const isWinMode = (sim: Sim, seat: number) => sim.bids[seat] - sim.won[seat] > 0;

const lead = (sim: Sim, seat: number, legal: Int32Array): CardId => {
  const { trump } = sim;
  const hand = seat * SUITS;
  const trumps = sim.hands[hand + trump];
  const size = sim.handSize(seat);
  const nonTrump = [0, 1, 2, 3].filter((suit) => suit !== trump && sim.hands[hand + suit] !== 0);

  if (isWinMode(sim, seat)) {
    // 1. A sure winner: the top card of a side suit nobody will trump.
    let boss = NONE;
    let bossLength = -1;
    nonTrump.forEach((suit) => {
      const top = cardId(suit, highestRank(sim.hands[hand + suit]));
      const left = bitCount(outstanding(sim, seat, suit));
      if (isBoss(sim, seat, top) && !trumpThreat(sim, seat, suit) && left > bossLength) {
        boss = top;
        bossLength = left;
      }
    });
    if (boss !== NONE) return boss;

    // 2. Plenty of trumps: draw the others' trumps.
    const trumpCount = bitCount(trumps);
    if (
      trumpCount > 0 &&
      (trumpCount * 2 >= size || trumpCount >= 3) &&
      outstanding(sim, seat, trump) !== 0
    ) {
      return cardId(trump, highestRank(trumps));
    }

    // 3. The top of the longest side suit, to set up winners in it.
    if (nonTrump.length > 0) {
      let longest = nonTrump[0];
      nonTrump.forEach((suit) => {
        if (suitLength(sim, seat, suit) > suitLength(sim, seat, longest)) longest = suit;
      });
      return cardId(longest, highestRank(sim.hands[hand + longest]));
    }
    return cardId(trump, highestRank(trumps));
  }

  // DUCK: a low card of a side suit where others still hold plenty of higher ones. Never a trump,
  // unless that's all there is (then the lowest).
  if (nonTrump.length === 0) return cardId(trump, lowestRank(trumps));

  let best = NONE;
  let bestScore = -Infinity;
  nonTrump.forEach((suit) => {
    const low = lowestRank(sim.hands[hand + suit]);
    const out = outstanding(sim, seat, suit);
    const higher = bitCount(out & above(low));
    let value = higher * 2 - low * 0.2;
    // Holding the suit's boss with few others left: leading it may end in winning.
    if (higher === 0) value -= 20;
    else if (bitCount(out) <= 2) value -= 3;
    if (value > bestScore) {
      bestScore = value;
      best = cardId(suit, low);
    }
  });
  return best === NONE ? pick(legal, (card) => -cost(card, trump)) : best;
};

const follow = (sim: Sim, seat: number, legal: Int32Array): CardId => {
  const { trump, trick, trickLength } = sim;
  const isLast = trickLength === sim.n - 1;
  const led = suitOf(trick[0]);
  const isFree = sim.hands[seat * SUITS + led] === 0 && legalIsWholeHand(sim, seat, legal);
  const winMode = isWinMode(sim, seat);
  const wins = (card: CardId) => wouldWin(trick, trickLength, trump, card);

  // Cheapest card, from the shortest side suit (to make a void for later ruffs).
  const cheapDiscard = (card: CardId) => {
    const suit = suitOf(card);
    const shortness = suit === trump ? 0 : 14 - suitLength(sim, seat, suit);
    return shortness * 30 - cost(card, trump);
  };

  if (isFree) {
    // Nothing here can take the trick (see the rules): a free discard.
    return winMode
      ? pick(legal, cheapDiscard)
      : pick(legal, (card) => danger(sim, seat, card) * 100 - rankOf(card) * 0.01);
  }

  let winnerCount = 0;
  let loserCount = 0;
  pick(legal, (card) => {
    if (wins(card)) winnerCount++;
    else loserCount++;
    return 0;
  });

  if (winMode) {
    if (winnerCount === 0) return pick(legal, (card) => -cost(card, trump));
    if (isLast) return pick(legal, (card) => (wins(card) ? 100 - cost(card, trump) : -100));

    // Still others to play: a winner nobody can beat, the cheapest of them.
    const secure = (card: CardId) =>
      wins(card) &&
      isBoss(sim, seat, card) &&
      (suitOf(card) === trump || !trumpThreat(sim, seat, suitOf(card)));
    const sure = pick(legal, (card) => (secure(card) ? 100 - cost(card, trump) : -100));
    if (secure(sure)) return sure;

    // Otherwise the highest winner if it's likely to hold, or save it and play cheap.
    const top = pick(legal, (card) => (wins(card) ? cost(card, trump) : -100));
    const higherOut = bitCount(outstanding(sim, seat, suitOf(top)) & above(rankOf(top)));
    const likely =
      higherOut <= 1 && (suitOf(top) === trump || !trumpThreat(sim, seat, suitOf(top)));
    return likely ? top : pick(legal, (card) => -cost(card, trump));
  }

  // DUCK: the highest card that loses (rid of something that could win later). If every card
  // wins: last to play, the trick is taken anyway, so take it with the most dangerous card; with
  // others still to play, the lowest, which they may still beat.
  if (loserCount > 0) return pick(legal, (card) => (wins(card) ? -100 : cost(card, trump)));
  return pick(legal, (card) => (isLast ? cost(card, trump) : -cost(card, trump)));
};

const legalIsWholeHand = (sim: Sim, seat: number, legal: Int32Array) => {
  for (let suit = 0; suit < SUITS; suit++) {
    if (legal[suit] !== sim.hands[seat * SUITS + suit]) return false;
  }
  return true;
};

// The policy's card for the seat whose turn it is. `randomness`: the chance of a random legal card
// instead (so a search doesn't trust a rigid opponent model too much).
export const policyCard = (sim: Sim, rng: Rng | null, randomness = 0): CardId => {
  const seat = sim.turn;
  if (sim.isLero[seat]) return sim.leroCard(seat);

  const legal = scratch;
  const count = sim.legal(legal);
  if (count === 0) throw new Error("No legal card");

  if (count === 1 || (rng && randomness > 0 && rng.next() < randomness)) {
    return count === 1 ? pick(legal, () => 0) : randomOf(legal, count, rng as Rng);
  }

  // `legal` is the shared scratch buffer: keep a copy while the helpers run.
  const copy = Int32Array.from(legal);
  return sim.trickLength === 0 ? lead(sim, seat, copy) : follow(sim, seat, copy);
};

// Plays the round to its end with the policy for every seat.
export const rollout = (sim: Sim, rng: Rng, randomness: number) => {
  while (!sim.isOver) sim.play(policyCard(sim, rng, randomness));
};

export { randomOf };
