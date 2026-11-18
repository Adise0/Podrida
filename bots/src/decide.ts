// The one entry point: given what the bot sees and its difficulty, a bid or a card. It never
// fails and never stalls: the search stops at the time budget with the best move so far, and if
// it fails for any reason the bot falls back to the rollout policy, then to a random legal card
// (or its quick estimate for a bid).
import { BotDifficulty, type Card } from "@podrida/shared";
import { decideBid, quickBid } from "./bidding";
import { cardName, cardsOf, toCard, toId, type CardId } from "./cards";
import { difficultyConfig, type DifficultyConfig } from "./difficulty";
import { buildKnowledge } from "./knowledge";
import { leroBid, leroCard } from "./lero";
import { makeObjective } from "./objective";
import { policyCard } from "./policy";
import { buildSim, roundContext, type RoundContext } from "./position";
import { createRng, mixSeed, type Rng } from "./rng";
import { legalInto } from "./rules";
import { sampleDeals } from "./sampler";
import { NodeLimitReached, solveEndgame } from "./search/endgame";
import { ismcts } from "./search/ismcts";
import { pimc, type MoveValues } from "./search/pimc";
import type { BotDecision, BotRequest, BotView } from "./view";

// Every decision gets its own stream of randomness, from the bot's seed and where the game is:
// the same game and seed give the same decisions.
const decisionRng = (request: BotRequest) => {
  const { view } = request;
  const played = view.tricks.length * view.seats.length + view.trick.length;
  return createRng(mixSeed(request.seed, view.roundNumber, played, request.kind === "bid" ? 1 : 2));
};

const legalCards = (view: BotView): CardId[] => {
  const hand = [0, 0, 0, 0];
  view.hand.forEach((card) => {
    const id = toId(card);
    hand[id >> 4] |= 1 << (id & 15);
  });
  const trick = view.trick.map(({ card }) => toId(card));
  const out = [0, 0, 0, 0];
  legalInto(hand, 0, trick, trick.length, toId({ suit: view.trumpSuit, rank: 2 }) >> 4, out);
  return cardsOf(out);
};

const withNoise = (bid: number, chance: number, cards: number, rng: Rng) => {
  if (chance <= 0 || rng.next() >= chance) return bid;
  const shifted = bid + (rng.next() < 0.5 ? -1 : 1);
  if (shifted < 0 || shifted > cards) return bid + (shifted < 0 ? 1 : -1);
  return shifted;
};

const totalCardsLeft = (context: RoundContext) =>
  context.knowledge.handSizes.reduce((total, size) => total + size, 0);

interface PlayChoice {
  card: CardId;
  values?: MoveValues;
  method: string;
  samples: number;
}

const searchCard = (
  context: RoundContext,
  legal: CardId[],
  config: DifficultyConfig,
  rng: Rng,
  deadline: number,
): PlayChoice => {
  const { knowledge, view } = context;
  const objective = makeObjective(view, config.spoiler);
  const bids = knowledge.bids.map((bid) => bid ?? 0);
  const deals = sampleDeals(knowledge, rng, {
    count: config.playSamples,
    bidWeight: config.bidWeight,
    cardsPerPlayer: view.cardsPerPlayer,
  });
  const base = (hands: Int32Array) => buildSim(context, hands, bids, rng);

  let values: MoveValues | null = null;
  let method: string = config.searchType;

  // Few cards left: solve each deal exactly. A deal too big for the node limit sends the whole
  // decision back to the rollouts.
  const small = view.cardsPerPlayer <= 3 || totalCardsLeft(context) <= config.endgameThreshold;
  if (config.endgameSolver && small) {
    try {
      const totals = new Float64Array(legal.length);
      let used = 0;
      for (const deal of deals) {
        if (used > 0 && performance.now() > deadline) break;
        const result = solveEndgame(base(deal.hands), legal, objective, config.endgameNodeLimit);
        result.forEach((value, index) => {
          totals[index] += value;
        });
        used++;
      }
      values = { moves: legal, values: totals.map((total) => total / used), samples: used };
      method = "endgame";
    } catch (error) {
      if (!(error instanceof NodeLimitReached)) throw error;
    }
  }

  if (!values && config.searchType === "ismcts") {
    values = ismcts(
      (deal) => base(deal.hands),
      deals,
      legal,
      config.ismctsIterations,
      objective,
      rng,
      config.rolloutRandomness,
      deadline,
      view.cardsPerPlayer,
    );
    method = "ismcts";
  }

  if (!values) {
    values = pimc(
      (deal) => base(deal.hands),
      deals,
      legal,
      config.playRollouts,
      objective,
      rng,
      config.rolloutRandomness,
      deadline,
    );
    method = "pimc";
  }

  // The best value; ties to the lower card (keeps the higher ones for later).
  let best = 0;
  values.values.forEach((value, index) => {
    if (value > values.values[best] + 1e-9) best = index;
  });
  return { card: legal[best], values, method, samples: values.samples };
};

// With the given chance, a mistake: the second-best move (they look human), or for a Beginner a
// random legal card. Never on a forced move.
const withMistake = (choice: PlayChoice, legal: CardId[], config: DifficultyConfig, rng: Rng) => {
  if (legal.length < 2 || config.playMistakes <= 0 || rng.next() >= config.playMistakes) {
    return choice.card;
  }
  if (config.mistakeType === "random" || !choice.values) return legal[rng.int(legal.length)];
  const { moves, values } = choice.values;
  const order = moves.map((_, index) => index).sort((a, b) => values[b] - values[a]);
  return moves[order[1]];
};

const decideCard = (
  request: BotRequest,
  config: DifficultyConfig,
  rng: Rng,
  deadline: number,
): { card: Card; method: string; samples: number; values?: Record<string, number> } => {
  const { view } = request;
  const legal = legalCards(view);
  if (legal.length === 1) return { card: toCard(legal[0]), method: "forced", samples: 0 };

  const knowledge = buildKnowledge(view, {
    voids: config.voidInference,
    ceilings: config.ceilingInference,
  });
  const context = roundContext(view, knowledge);

  if (config.searchType === "none") {
    const sim = buildSim(
      context,
      null,
      knowledge.bids.map((bid) => bid ?? 0),
      rng,
    );
    const card = policyCard(sim, null);
    return {
      card: toCard(withMistake({ card, method: "policy", samples: 0 }, legal, config, rng)),
      method: "policy",
      samples: 0,
    };
  }

  const choice = searchCard(context, legal, config, rng, deadline);
  const values = Object.fromEntries(
    choice.values?.moves.map((move, index) => [
      cardName(move),
      choice.values?.values[index] ?? 0,
    ]) ?? [],
  );
  return {
    card: toCard(withMistake(choice, legal, config, rng)),
    method: choice.method,
    samples: choice.samples,
    values,
  };
};

const fallbackCard = (view: BotView, rng: Rng): { card: Card; method: string } => {
  try {
    const knowledge = buildKnowledge(view, { voids: false, ceilings: false });
    const context = roundContext(view, knowledge);
    const sim = buildSim(
      context,
      null,
      knowledge.bids.map((bid) => bid ?? 0),
      null,
    );
    return { card: toCard(policyCard(sim, null)), method: "fallback policy" };
  } catch {
    const legal = legalCards(view);
    return { card: toCard(legal[rng.int(legal.length)]), method: "fallback random" };
  }
};

export const decide = (request: BotRequest): BotDecision => {
  const started = performance.now();
  const { view, difficulty } = request;
  const rng = decisionRng(request);
  const stats = (method: string, samples: number, error?: unknown) => ({
    elapsedMs: Math.round((performance.now() - started) * 10) / 10,
    method,
    samples,
    fallback: error !== undefined,
    ...(error !== undefined && { error: error instanceof Error ? error.message : String(error) }),
  });

  if (difficulty === BotDifficulty.lero) {
    return request.kind === "bid"
      ? { kind: "bid", bid: leroBid(view, rng), stats: stats("lero", 0) }
      : { kind: "play", card: leroCard(view), stats: stats("lero", 0) };
  }

  const config = difficultyConfig(difficulty);
  const deadline = request.ignoreTimeBudget ? Infinity : started + config.timeBudgetMs;

  if (request.kind === "bid") {
    try {
      const knowledge = buildKnowledge(view, {
        voids: config.voidInference,
        ceilings: config.ceilingInference,
      });
      const context = roundContext(view, knowledge);
      const result = decideBid(context, config, makeObjective(view, config.spoiler), rng, deadline);
      const bid = withNoise(result.bid, config.bidNoise, view.cardsPerPlayer, rng);
      return {
        kind: "bid",
        bid,
        stats: stats(result.method, result.samples),
        ...(request.debug && { debug: { values: result.values, knowledge } }),
      };
    } catch (error) {
      const context = roundContext(view, buildKnowledge(view, { voids: false, ceilings: false }));
      const bid = Math.min(view.cardsPerPlayer, Math.max(0, Math.round(quickBid(context))));
      return { kind: "bid", bid, stats: stats("fallback estimate", 0, error) };
    }
  }

  try {
    const result = decideCard(request, config, rng, deadline);
    return {
      kind: "play",
      card: result.card,
      stats: stats(result.method, result.samples),
      ...(request.debug && result.values && { debug: { values: result.values } }),
    };
  } catch (error) {
    const result = fallbackCard(view, rng);
    return { kind: "play", card: result.card, stats: stats(result.method, 0, error) };
  }
};
