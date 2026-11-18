// What a bot knows about the round (its belief state), built only from what it has seen: its own
// hand, the trump card, the bids, and every card played and by whom.
//
// Hard constraints per opponent and suit, from the rules: a player who didn't follow is void in
// the led suit; one who played under the trick's best led card holds nothing higher in it (they'd
// have had to beat it); and the same two ideas for trumps. They only get stricter during a round,
// and start over with each one. Lero seats teach nothing (they ignore the rules).
import {
  above,
  emptyMasks,
  FULL_SUIT,
  rankOf,
  suitIndex,
  SUITS,
  suitOf,
  toId,
  type CardId,
} from "./cards";
import type { BotView } from "./view";

export interface InferenceOptions {
  voids: boolean;
  ceilings: boolean;
}

export interface Knowledge {
  players: number;
  me: number; // Seat index.
  trump: number;
  isLero: boolean[];
  hand: number[]; // Own hand, four masks.
  gone: number[]; // Played this round, and the trump card: out of everyone's hand. Four masks.
  unseen: number[]; // Neither in own hand nor gone: in an opponent's hand or the undealt stock.
  // Per seat and suit: the ranks that seat may still hold (void = 0, a ceiling clears the ranks
  // above it). Index seat * 4 + suit. Own seat: all.
  allowed: number[];
  void: boolean[]; // Per seat * 4 + suit: known void.
  handSizes: number[]; // Cards each seat holds now.
  stockSize: number; // Undealt cards (normal rounds), unseen and out of play.
  bids: (number | null)[]; // Per seat.
  won: number[]; // Tricks won this round, per seat.
  played: CardId[][]; // Per seat, the cards they played this round, in order.
}

const seatIndex = (view: BotView, userId: string) => view.seats.indexOf(userId);

// The constraints one play teaches, given the trick before it (see the design guide, 4.2).
export const learnFromPlay = (
  knowledge: Knowledge,
  seat: number,
  trickBefore: CardId[],
  card: CardId,
  options: InferenceOptions,
) => {
  if (trickBefore.length === 0 || knowledge.isLero[seat]) return;

  const { trump } = knowledge;
  const led = suitOf(trickBefore[0]);
  const suit = suitOf(card);
  let bestLed = -1;
  let bestTrump = -1;

  for (const played of trickBefore) {
    if (suitOf(played) === led && rankOf(played) > bestLed) bestLed = rankOf(played);
    if (suitOf(played) === trump && rankOf(played) > bestTrump) bestTrump = rankOf(played);
  }

  const index = seat * SUITS;
  const setVoid = (voidSuit: number) => {
    if (!options.voids) return;
    knowledge.void[index + voidSuit] = true;
    knowledge.allowed[index + voidSuit] = 0;
  };
  const setCeiling = (ceilingSuit: number, rank: number) => {
    if (!options.ceilings) return;
    knowledge.allowed[index + ceilingSuit] &= ~above(rank);
  };

  if (suit === led) {
    // Under the best led card: they'd have had to beat it with anything higher.
    if (rankOf(card) < bestLed) setCeiling(led, bestLed);
    return;
  }

  setVoid(led);

  if (bestTrump === -1) {
    // Nobody had trumped: holding a trump, they'd have had to play one.
    if (suit !== trump) setVoid(trump);
    return;
  }

  // Someone had trumped: a lower trump, or no trump at all, means none higher than the best one.
  if (suit !== trump || rankOf(card) < bestTrump) setCeiling(trump, bestTrump);
};

export const buildKnowledge = (view: BotView, options: InferenceOptions): Knowledge => {
  const players = view.seats.length;
  const me = seatIndex(view, view.me);
  const trump = suitIndex(view.trumpSuit);
  const hand = emptyMasks();
  view.hand.forEach((card) => {
    const id = toId(card);
    hand[suitOf(id)] |= 1 << rankOf(id);
  });

  const gone = emptyMasks();
  if (view.trumpCard) {
    const id = toId(view.trumpCard);
    gone[suitOf(id)] |= 1 << rankOf(id);
  }

  const knowledge: Knowledge = {
    players,
    me,
    trump,
    isLero: view.seats.map((userId) => view.leroSeats.includes(userId)),
    hand,
    gone,
    unseen: emptyMasks(),
    allowed: Array.from({ length: players * SUITS }, () => FULL_SUIT),
    void: Array.from({ length: players * SUITS }, () => false),
    handSizes: view.seats.map(() => view.cardsPerPlayer),
    stockSize: view.trumpCard ? 52 - players * view.cardsPerPlayer - 1 : 0,
    bids: view.seats.map((userId) => view.bids[userId] ?? null),
    won: view.seats.map(() => 0),
    played: view.seats.map(() => []),
  };

  const observe = (trickBefore: CardId[], userId: string, card: CardId) => {
    const seat = seatIndex(view, userId);
    learnFromPlay(knowledge, seat, trickBefore, card, options);
    knowledge.gone[suitOf(card)] |= 1 << rankOf(card);
    knowledge.handSizes[seat] -= 1;
    knowledge.played[seat].push(card);
  };

  const replay = (cards: BotView["trick"]) => {
    const before: CardId[] = [];
    cards.forEach(({ userId, card }) => {
      const id = toId(card);
      observe([...before], userId, id);
      before.push(id);
    });
  };

  view.tricks.forEach((trick) => {
    replay(trick.cards);
    knowledge.won[seatIndex(view, trick.winnerId)] += 1;
  });
  replay(view.trick);

  for (let suit = 0; suit < SUITS; suit++) {
    knowledge.unseen[suit] = FULL_SUIT & ~knowledge.gone[suit] & ~knowledge.hand[suit];
  }

  // Own seat: no constraint to speak of (its hand is known).
  for (let suit = 0; suit < SUITS; suit++) knowledge.allowed[me * SUITS + suit] = FULL_SUIT;

  return knowledge;
};

// The constraints a true deal must satisfy, for the tests: whether `cards` could be that seat's
// hand given what was learned.
export const isConsistent = (knowledge: Knowledge, seat: number, cards: CardId[]) =>
  cards.every(
    (card) => (knowledge.allowed[seat * SUITS + suitOf(card)] & (1 << rankOf(card))) !== 0,
  );

export const unseenCount = (knowledge: Knowledge) => {
  let count = 0;
  for (let suit = 0; suit < SUITS; suit++) {
    let mask = knowledge.unseen[suit];
    while (mask !== 0) {
      mask &= mask - 1;
      count++;
    }
  }
  return count;
};
