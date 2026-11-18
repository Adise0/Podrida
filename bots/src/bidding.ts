// Choosing a bid by simulation: for each candidate bid, how well can the bot actually hit it?
// Every candidate is played out on the same sampled deals, the bot playing toward that bid and
// the others toward theirs (their real bid, or what the quick estimate says they'll bid), and
// scored. The scoring itself (+10 for a hit, −3 per trick off) then favours bids the bot can
// control, with no special rule for it.
import { SUITS, type SuitMasks } from "./cards";
import type { DifficultyConfig } from "./difficulty";
import { estimateTricks } from "./estimator";
import { unseenCount } from "./knowledge";
import type { Objective } from "./objective";
import { rollout } from "./policy";
import { buildSim, type RoundContext } from "./position";
import type { Rng } from "./rng";
import { score } from "./rules";
import { sampleDeals } from "./sampler";
import { NodeLimitReached, solveScores } from "./search/endgame";

export interface BidResult {
  bid: number;
  values: Record<string, number>;
  method: string;
  samples: number;
}

const handOf = (hands: ArrayLike<number>, seat: number): SuitMasks => [
  hands[seat * SUITS],
  hands[seat * SUITS + 1],
  hands[seat * SUITS + 2],
  hands[seat * SUITS + 3],
];

export const quickBid = (context: RoundContext) => {
  const { knowledge, view } = context;
  return estimateTricks(knowledge.hand as SuitMasks, {
    trump: knowledge.trump,
    players: knowledge.players,
    cardsPerPlayer: view.cardsPerPlayer,
    leads: context.leader === knowledge.me,
    unseen: unseenCount(knowledge),
  });
};

export const decideBid = (
  context: RoundContext,
  config: DifficultyConfig,
  objective: Objective,
  rng: Rng,
  deadline: number,
): BidResult => {
  const { knowledge, view } = context;
  const cards = view.cardsPerPlayer;
  const estimate = quickBid(context);
  const rounded = Math.round(estimate);

  if (config.bidSamples === 0) {
    return { bid: rounded, values: { estimate }, method: "estimate", samples: 0 };
  }

  const candidates = new Set<number>([0]);
  for (let bid = Math.max(0, rounded - 2); bid <= Math.min(cards, rounded + 2); bid++) {
    candidates.add(bid);
  }
  const bids = [...candidates].sort((a, b) => a - b);

  // One card each: a single trick per deal, cheap, so more deals.
  const count = cards === 1 ? config.bidSamples * 3 : config.bidSamples;
  const deals = sampleDeals(knowledge, rng, {
    count,
    bidWeight: config.bidWeight,
    cardsPerPlayer: cards,
  });
  const totals = new Float64Array(bids.length);
  let weight = 0;
  let used = 0;
  let exact = config.endgameSolver && cards <= 3;
  const own: Objective = { ...objective, spoiler: 0 };
  const { me } = knowledge;

  for (const deal of deals) {
    if (used > 0 && performance.now() > deadline) break;

    // Who bids what in this deal: the real bids so far, the estimate for the rest.
    const targets = knowledge.bids.map((bid, seat) => {
      if (bid !== null) return bid;
      if (seat === me) return 0;
      return Math.round(
        estimateTricks(handOf(deal.hands, seat), {
          trump: knowledge.trump,
          players: knowledge.players,
          cardsPerPlayer: cards,
          leads: seat === context.leader,
          unseen: 52 - cards - (view.trumpCard ? 1 : 0),
        }),
      );
    });
    const base = buildSim(context, deal.hands, targets, rng);
    const scratch = base.clone();

    bids.forEach((bid, index) => {
      base.bids[me] = bid;
      if (exact) {
        try {
          totals[index] += deal.weight * solveScores(base, own, config.endgameNodeLimit)[me];
          return;
        } catch (error) {
          if (!(error instanceof NodeLimitReached)) throw error;
          exact = false; // Too big to solve: rollouts from here on (this deal included).
        }
      }
      for (let run = 0; run < config.bidRollouts; run++) {
        scratch.copyFrom(base);
        rollout(scratch, rng, config.rolloutRandomness);
        totals[index] += (deal.weight * score(bid, scratch.won[me])) / config.bidRollouts;
      }
    });
    weight += deal.weight;
    used++;
  }

  let best = 0;
  bids.forEach((bid, index) => {
    const value = totals[index];
    const bestValue = totals[best];
    if (
      value > bestValue + 1e-9 ||
      (Math.abs(value - bestValue) <= 1e-9 &&
        Math.abs(bid - estimate) < Math.abs(bids[best] - estimate))
    ) {
      best = index;
    }
  });

  return {
    bid: bids[best],
    values: Object.fromEntries(bids.map((bid, index) => [String(bid), totals[index] / weight])),
    method: exact ? "simulation (exact)" : "simulation",
    samples: used,
  };
};
