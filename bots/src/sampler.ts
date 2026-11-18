// Sampling possible deals (determinizations): every unseen card given to an opponent, or to the
// undealt stock, consistently with everything the bot knows (hand sizes, voids, ceilings). The
// searches play on many of these and average.
//
// Bids are soft evidence: with a bid weight λ > 0, deals where the opponents' hands fit their
// bids are drawn more often (from a larger pool, in proportion to
// w = Π exp(−λ · (estimated tricks − bid)²)).
import { bitCount, cardsOf, rankOf, SUITS, suitOf, type CardId, type SuitMasks } from "./cards";
import { estimateTricks } from "./estimator";
import type { Knowledge } from "./knowledge";
import { shuffleInPlace, type Rng } from "./rng";

export interface Deal {
  hands: Int32Array; // seat * 4 + suit, own hand included.
  weight: number;
}

export interface SampleStats {
  restarts: number;
  repaired: number; // Deals finished by the matching fallback.
  relaxed: number; // Deals that had to drop the ceilings (inference shouldn't allow it).
}

const MAX_RESTARTS = 20;

// Who may hold each card: a bit per holder (opponent seats, then the stock as seat n).
const holdersOf = (knowledge: Knowledge, card: CardId, constrained: boolean) => {
  const suit = suitOf(card);
  const bit = 1 << rankOf(card);
  let holders = 0;
  for (let seat = 0; seat < knowledge.players; seat++) {
    if (seat === knowledge.me) continue;
    if (!constrained || (knowledge.allowed[seat * SUITS + suit] & bit) !== 0) holders |= 1 << seat;
  }
  if (knowledge.stockSize > 0) holders |= 1 << knowledge.players;
  return holders;
};

// A card for each slot of the holders: augmenting paths (Kuhn), for when random greedy dealing
// keeps running into dead ends. Exact: it finds a deal whenever there is one.
const matchDeal = (
  cards: CardId[],
  holders: number[],
  room: number[],
  rng: Rng,
): number[] | null => {
  const holderCount = room.length;
  const owner = cards.map(() => -1);
  const assigned: number[][] = room.map(() => []);

  const tryAssign = (card: number, seen: boolean[]): boolean => {
    const order = shuffleInPlace(
      Array.from({ length: holderCount }, (_, index) => index),
      rng,
    );
    for (const holder of order) {
      if ((holders[card] & (1 << holder)) === 0 || seen[holder]) continue;
      seen[holder] = true;
      if (assigned[holder].length < room[holder]) {
        assigned[holder].push(card);
        owner[card] = holder;
        return true;
      }
      // Move one of its cards elsewhere to make room.
      for (let slot = 0; slot < assigned[holder].length; slot++) {
        const other = assigned[holder][slot];
        if (tryAssign(other, seen)) {
          assigned[holder][slot] = card;
          owner[card] = holder;
          return true;
        }
      }
    }
    return false;
  };

  for (let card = 0; card < cards.length; card++) {
    if (
      !tryAssign(
        card,
        Array.from({ length: holderCount }, () => false),
      )
    )
      return null;
  }
  return owner;
};

const dealOnce = (knowledge: Knowledge, rng: Rng, stats: SampleStats): Int32Array => {
  const { players, me } = knowledge;
  const unseen = shuffleInPlace(cardsOf(knowledge.unseen), rng);
  const room = Array.from({ length: players + 1 }, (_, seat) =>
    seat === players ? knowledge.stockSize : seat === me ? 0 : knowledge.handSizes[seat],
  );
  const expected = room.reduce((total, value) => total + value, 0);
  if (expected !== unseen.length) {
    throw new Error(`Unseen cards (${unseen.length}) don't match the hands (${expected})`);
  }

  const hands = new Int32Array(players * SUITS);
  for (let suit = 0; suit < SUITS; suit++) hands[me * SUITS + suit] = knowledge.hand[suit];

  const attempt = (constrained: boolean): number[] | null => {
    const holders = unseen.map((card) => holdersOf(knowledge, card, constrained));
    // Most constrained first.
    const order = unseen
      .map((_, index) => index)
      .sort((a, b) => bitCount(holders[a]) - bitCount(holders[b]));

    for (let tries = 0; tries <= MAX_RESTARTS; tries++) {
      const left = [...room];
      const owner = unseen.map(() => -1);
      let ok = true;

      for (const index of order) {
        let total = 0;
        for (let holder = 0; holder <= players; holder++) {
          if ((holders[index] & (1 << holder)) !== 0) total += left[holder];
        }
        if (total === 0) {
          ok = false;
          break;
        }
        // A holder at random, weighted by the room it has left.
        let target = rng.int(total);
        for (let holder = 0; holder <= players; holder++) {
          if ((holders[index] & (1 << holder)) === 0) continue;
          if (target < left[holder]) {
            owner[index] = holder;
            left[holder] -= 1;
            break;
          }
          target -= left[holder];
        }
      }

      if (ok) return owner;
      stats.restarts++;
      if (tries < MAX_RESTARTS)
        shuffleInPlace(order, rng).sort((a, b) => bitCount(holders[a]) - bitCount(holders[b]));
    }

    const matched = matchDeal(unseen, holders, room, rng);
    if (matched) stats.repaired++;
    return matched;
  };

  let owner = attempt(true);
  if (!owner) {
    // The constraints allow no deal at all: a bug in the inference. Play on without them.
    stats.relaxed++;
    owner = attempt(false);
  }
  if (!owner) throw new Error("No deal fits the hand sizes");

  owner.forEach((holder, index) => {
    if (holder === players) return; // The stock: out of play.
    const card = unseen[index];
    hands[holder * SUITS + suitOf(card)] |= 1 << rankOf(card);
  });
  return hands;
};

// How well a deal fits the opponents' bids.
const bidWeight = (
  knowledge: Knowledge,
  hands: Int32Array,
  lambda: number,
  cardsPerPlayer: number,
) => {
  if (lambda <= 0) return 1;
  let exponent = 0;
  for (let seat = 0; seat < knowledge.players; seat++) {
    const bid = knowledge.bids[seat];
    if (seat === knowledge.me || bid === null || knowledge.isLero[seat]) continue;
    // Their hand when they bid: what they hold in this deal, and what they've played since.
    const hand: SuitMasks = [0, 0, 0, 0];
    for (let suit = 0; suit < SUITS; suit++) hand[suit] = hands[seat * SUITS + suit];
    knowledge.played[seat].forEach((card) => {
      hand[suitOf(card)] |= 1 << rankOf(card);
    });
    const estimate = estimateTricks(hand, {
      trump: knowledge.trump,
      players: knowledge.players,
      cardsPerPlayer,
    });
    exponent += (estimate - bid) ** 2;
  }
  return Math.exp(-lambda * exponent);
};

export interface SampleOptions {
  count: number;
  bidWeight: number; // λ
  cardsPerPlayer: number;
  poolFactor?: number; // Candidates per kept deal when weighing by bids. Default 3.
}

export const sampleDeals = (
  knowledge: Knowledge,
  rng: Rng,
  options: SampleOptions,
  stats: SampleStats = { restarts: 0, repaired: 0, relaxed: 0 },
): Deal[] => {
  const { count, cardsPerPlayer } = options;
  const lambda = options.bidWeight;
  const weighed =
    lambda > 0 && knowledge.bids.some((bid, seat) => seat !== knowledge.me && bid !== null);

  if (!weighed) {
    return Array.from({ length: count }, () => ({
      hands: dealOnce(knowledge, rng, stats),
      weight: 1,
    }));
  }

  // Resample: a pool of candidates, drawn in proportion to how well they fit the bids.
  const pool = Array.from({ length: count * (options.poolFactor ?? 3) }, () => {
    const hands = dealOnce(knowledge, rng, stats);
    return { hands, weight: bidWeight(knowledge, hands, lambda, cardsPerPlayer) };
  });
  const total = pool.reduce((sum, deal) => sum + deal.weight, 0);
  if (!(total > 0)) return pool.slice(0, count).map((deal) => ({ ...deal, weight: 1 }));

  // Systematic resampling: even spread, low variance.
  const step = total / count;
  let position = rng.next() * step;
  let cumulative = 0;
  let index = -1;
  const chosen: Deal[] = [];
  while (chosen.length < count) {
    while (cumulative <= position && index < pool.length - 1) {
      index++;
      cumulative += pool[index].weight;
    }
    chosen.push({ hands: pool[index].hands, weight: 1 });
    position += step;
  }
  return chosen;
};
