// Lero: the bot that doesn't know the rules. No knowledge, no search, no strategy.
//   Bid:  Binomial(cards in the round, 1 / players) — the average share of tricks, at random.
//   Play: the first card it still holds, in the order it was dealt, whether the rules allow it or
//         not. The game accepts it from a Lero seat (and only from one).
import { sameCard, type Card } from "@podrida/shared";
import type { Rng } from "./rng";
import type { BotView } from "./view";

export const leroBid = (view: BotView, rng: Rng) => {
  const chance = 1 / view.seats.length;
  let bid = 0;
  for (let card = 0; card < view.cardsPerPlayer; card++) if (rng.next() < chance) bid++;
  return bid;
};

export const leroCard = (view: BotView): Card => {
  const next = view.dealtHand.find((card) => view.hand.some((held) => sameCard(held, card)));
  return next ?? view.hand[0];
};
