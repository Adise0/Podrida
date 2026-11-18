// A whole game between bots, refereed with the shared rules (@podrida/shared), as the backend's
// PodridaMatch deals and plays it. For tournaments and the property tests: no thinking delay, and
// the deals come from a seed so the same deals can be replayed with the bots in other seats.
import {
  BotDifficulty,
  fullDeck,
  isFullDeckRound,
  isPlayable,
  roundSchedule,
  roundScore,
  sameCard,
  trickWinner,
  type Card,
  type PlayedCard,
  type Suit,
} from "@podrida/shared";
import { decide } from "../decide";
import { createRng, mixSeed, shuffleInPlace } from "../rng";
import type { BotDecision, BotTrick, BotView } from "../view";

export interface Seat {
  id: string;
  difficulty: BotDifficulty;
  seed: number;
}

export interface SeatStats {
  total: number;
  rounds: number;
  hits: number;
  over: number;
  under: number;
  decisions: number[]; // Milliseconds each.
  fallbacks: number;
  illegal: number; // Cards the rules didn't allow (Lero only, or it's a bug).
  // For calibrating the trick estimator: per round, the cards per player, its bid, tricks won.
  rows: { cardsPerPlayer: number; bid: number; won: number }[];
}

export interface GameResult {
  seats: Seat[];
  stats: Record<string, SeatStats>;
}

export interface GameOptions {
  dealSeed: number;
  firstDealer?: number;
  ignoreTimeBudget?: boolean;
  rounds?: number[]; // Only these rounds (1-based), for quicker tests. Default: all of them.
  onDecision?: (seat: Seat, view: BotView, decision: BotDecision) => void;
  // Check before every move that the view holds nothing it shouldn't (tests).
  checkView?: (view: BotView, hands: Map<string, Card[]>) => void;
}

// The deal of a round: the same for a given seed and round, whoever sits where.
const dealRound = (dealSeed: number, round: number, players: number, cardsPerPlayer: number) => {
  const rng = createRng(mixSeed(dealSeed, round));
  let deck = shuffleInPlace(fullDeck(), rng);
  let fullDeckTrump: Suit | null = null;
  if (isFullDeckRound(players, cardsPerPlayer)) {
    fullDeckTrump = deck[0].suit;
    deck = shuffleInPlace(deck, rng);
  }
  const hands: Card[][] = Array.from({ length: players }, () => []);
  for (let card = 0; card < cardsPerPlayer; card++) {
    for (let step = 1; step <= players; step++) hands[step - 1].push(deck.pop() as Card);
  }
  const trumpCard = fullDeckTrump ? null : (deck.pop() as Card);
  return { hands, trumpCard, trumpSuit: trumpCard ? trumpCard.suit : (fullDeckTrump as Suit) };
};

export const playGame = (seats: Seat[], options: GameOptions): GameResult => {
  const players = seats.length;
  const ids = seats.map((seat) => seat.id);
  const schedule = roundSchedule(players);
  const totals = new Map(ids.map((id) => [id, 0]));
  const leroSeats = seats
    .filter((seat) => seat.difficulty === BotDifficulty.lero)
    .map((seat) => seat.id);
  const stats: Record<string, SeatStats> = Object.fromEntries(
    ids.map((id) => [
      id,
      {
        total: 0,
        rounds: 0,
        hits: 0,
        over: 0,
        under: 0,
        decisions: [],
        fallbacks: 0,
        illegal: 0,
        rows: [],
      },
    ]),
  );
  const firstDealer = options.firstDealer ?? 0;

  schedule.forEach((cardsPerPlayer, roundIndex) => {
    if (options.rounds && !options.rounds.includes(roundIndex + 1)) return;
    const dealer = (firstDealer + roundIndex) % players;
    const deal = dealRound(options.dealSeed, roundIndex, players, cardsPerPlayer);
    // Dealt from the dealer's left: hands[k] goes to the k-th seat after the dealer.
    const order = ids.map((_, step) => ids[(dealer + step + 1) % players]);
    const dealt = new Map(order.map((id, index) => [id, deal.hands[index]]));
    const hands = new Map(order.map((id, index) => [id, [...deal.hands[index]]]));
    const bids: Record<string, number | null> = Object.fromEntries(ids.map((id) => [id, null]));
    const tricks: BotTrick[] = [];
    let trick: PlayedCard[] = [];
    let leaderId = ids[(dealer + 2) % players];

    const viewFor = (id: string): BotView => ({
      seats: ids,
      me: id,
      leroSeats,
      roundNumber: roundIndex + 1,
      roundCount: schedule.length,
      cardsPerPlayer,
      dealerId: ids[dealer],
      trumpSuit: deal.trumpSuit,
      trumpCard: deal.trumpCard,
      hand: [...(hands.get(id) ?? [])],
      dealtHand: [...(dealt.get(id) ?? [])],
      bidOrder: order,
      bids: { ...bids },
      tricks: tricks.map((done) => ({ ...done, cards: [...done.cards] })),
      leaderId,
      trick: [...trick],
      totals: Object.fromEntries(totals),
    });

    const ask = (seat: Seat, kind: "bid" | "play") => {
      const view = viewFor(seat.id);
      options.checkView?.(view, hands);
      const decision = decide({
        kind,
        view,
        difficulty: seat.difficulty,
        seed: seat.seed,
        ignoreTimeBudget: options.ignoreTimeBudget,
      });
      stats[seat.id].decisions.push(decision.stats.elapsedMs);
      if (decision.stats.fallback) stats[seat.id].fallbacks++;
      options.onDecision?.(seat, view, decision);
      return decision;
    };

    order.forEach((id) => {
      const decision = ask(seats[ids.indexOf(id)], "bid");
      if (decision.kind !== "bid") throw new Error("Expected a bid");
      if (!Number.isInteger(decision.bid) || decision.bid < 0 || decision.bid > cardsPerPlayer) {
        throw new Error(`Bad bid ${decision.bid} from ${id}`);
      }
      bids[id] = decision.bid;
    });

    for (let trickNumber = 0; trickNumber < cardsPerPlayer; trickNumber++) {
      trick = [];
      for (let step = 0; step < players; step++) {
        const id = ids[(ids.indexOf(leaderId) + step) % players];
        const seat = seats[ids.indexOf(id)];
        const decision = ask(seat, "play");
        if (decision.kind !== "play") throw new Error("Expected a card");
        const hand = hands.get(id) as Card[];
        if (!hand.some((card) => sameCard(card, decision.card))) {
          throw new Error(`${id} played a card it doesn't hold`);
        }
        if (!isPlayable(decision.card, hand, trick, deal.trumpSuit)) {
          stats[id].illegal++;
          if (seat.difficulty !== BotDifficulty.lero) {
            throw new Error(`${id} (${seat.difficulty}) played an illegal card`);
          }
        }
        hands.set(
          id,
          hand.filter((card) => !sameCard(card, decision.card)),
        );
        trick.push({ userId: id, card: decision.card });
      }
      const winnerId = trickWinner(trick, deal.trumpSuit).userId;
      tricks.push({ leaderId, cards: trick, winnerId });
      leaderId = winnerId;
    }

    ids.forEach((id) => {
      const won = tricks.filter((done) => done.winnerId === id).length;
      const bid = bids[id] as number;
      const points = roundScore(bid, won);
      totals.set(id, (totals.get(id) ?? 0) + points);
      const seatStats = stats[id];
      seatStats.rounds++;
      if (won === bid) seatStats.hits++;
      else if (won > bid) seatStats.over++;
      else seatStats.under++;
      seatStats.rows.push({ cardsPerPlayer, bid, won });
    });
  });

  ids.forEach((id) => {
    stats[id].total = totals.get(id) ?? 0;
  });
  return { seats, stats };
};
