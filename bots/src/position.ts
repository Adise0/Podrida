// Turns what a bot knows into simulations: the round as it stands, with a sampled deal filling in
// the hands it can't see (or empty hands, for the policy alone).
import { rankOf, SUITS, suitOf, toId, type CardId } from "./cards";
import type { Knowledge } from "./knowledge";
import { shuffleInPlace, type Rng } from "./rng";
import { Sim } from "./sim";
import type { BotView } from "./view";

export interface RoundContext {
  view: BotView;
  knowledge: Knowledge;
  leader: number; // Seat leading the current trick.
  trick: CardId[];
  tricksLeft: number; // Including the current one.
}

export const roundContext = (view: BotView, knowledge: Knowledge): RoundContext => ({
  view,
  knowledge,
  leader: view.seats.indexOf(view.leaderId),
  trick: view.trick.map(({ card }) => toId(card)),
  tricksLeft: view.cardsPerPlayer - view.tricks.length,
});

// The round as it stands. `hands`: a sampled deal (every seat), or null for the bot's own hand
// only. `bids`: what each seat plays toward.
export const buildSim = (
  context: RoundContext,
  hands: Int32Array | null,
  bids: ArrayLike<number>,
  rng: Rng | null,
): Sim => {
  const { knowledge, view } = context;
  const sim = new Sim(knowledge.players, knowledge.trump);

  if (hands) {
    sim.hands.set(hands);
  } else {
    for (let suit = 0; suit < SUITS; suit++) {
      sim.hands[knowledge.me * SUITS + suit] = knowledge.hand[suit];
    }
  }

  for (let suit = 0; suit < SUITS; suit++) sim.gone[suit] = knowledge.gone[suit];
  for (let seat = 0; seat < knowledge.players; seat++) {
    sim.bids[seat] = bids[seat];
    sim.won[seat] = knowledge.won[seat];
    let voids = 0;
    for (let suit = 0; suit < SUITS; suit++) {
      if (knowledge.void[seat * SUITS + suit]) voids |= 1 << suit;
    }
    sim.publicVoid[seat] = voids;
    sim.isLero[seat] = knowledge.isLero[seat] ? 1 : 0;
  }

  context.trick.forEach((card, index) => {
    sim.trick[index] = card;
  });
  sim.trickLength = context.trick.length;
  sim.leader = context.leader;
  sim.turn = (context.leader + context.trick.length) % knowledge.players;
  sim.tricksLeft = context.tricksLeft;

  // Lero seats play in dealt order: what they've played is the start of it, the rest of their
  // sampled hand comes in a random order (any order is as likely). The bot's own order is known.
  sim.leroOrder = knowledge.isLero.map((isLero, seat) => {
    if (!isLero) return null;
    if (seat === knowledge.me) return view.dealtHand.map(toId);
    const rest: CardId[] = [];
    if (hands) {
      for (let suit = 0; suit < SUITS; suit++) {
        let mask = hands[seat * SUITS + suit];
        while (mask !== 0) {
          const rank = 31 - Math.clz32(mask & -mask);
          mask &= mask - 1;
          rest.push((suit << 4) | rank);
        }
      }
    }
    return [...knowledge.played[seat], ...(rng ? shuffleInPlace(rest, rng) : rest)];
  });

  return sim;
};

export const holdsCard = (hands: Int32Array, seat: number, card: CardId) =>
  (hands[seat * SUITS + suitOf(card)] & (1 << rankOf(card))) !== 0;
