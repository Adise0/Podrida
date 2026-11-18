import { randomInt } from "node:crypto";
import {
  cardKey,
  fullDeck,
  isFullDeckRound,
  isPlayable,
  playableCards,
  playRule,
  PodridaPhase,
  roundSchedule,
  roundScore,
  sameCard,
  trickWinner,
  type Card,
  type PlayedCard,
  type PodridaAction,
  type PodridaRoundRecord,
  type PodridaState,
  type Suit,
} from "@podrida/shared";
import type { BotView } from "@podrida/bots";
import {
  getCardNotPlayableError,
  getInvalidBidError,
  getNotYourTurnError,
  getWrongPhaseError,
} from "../../data/errorObjects/gameErrors";

// Picks an integer in [0, max). Swappable, so tests can deal known hands.
export type RandomInt = (max: number) => number;

// Everything that happened in a round, for the stored record (never sent to the players while the
// game is on: it has everyone's cards).
export interface RoundLog {
  trumpCard: Card | null;
  hands: { userId: string; cards: Card[] }[]; // As dealt, in seat order.
  tricks: { leaderId: string; cards: PlayedCard[]; winnerId: string }[]; // Cards in play order.
}

interface Round {
  cardsPerPlayer: number;
  trumpSuit: Suit;
  trumpCard: Card | null; // null in full-deck rounds.
  dealerIndex: number;
  hands: Map<string, Card[]>; // In the order dealt, cards leave as they're played.
  log: RoundLog;
  bids: Map<string, number>;
  tricksWon: Map<string, number>;
  bidOrder: string[];
  leaderIndex: number;
  turnIndex: number | null;
  trick: PlayedCard[];
  trickNumber: number;
  trickWinnerId: string | null;
}

const shuffle = (cards: Card[], random: RandomInt) => {
  const deck = [...cards];

  // Fisher-Yates.
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const other = random(index + 1);
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }

  return deck;
};

// One game of Podrida, from the first deal to the last trick. It only knows the rules: the timing
// between phases (how long a finished trick stays on the table...) is up to whoever drives it, see
// gameManager. Every move is checked here, and refused with a ControlledError.
//
// The players sit in `seats` order, which is clockwise: the next seat is the one to the left.
export default class PodridaMatch {
  phase = PodridaPhase.dealing;

  readonly schedule: number[];

  roundIndex = 0;

  private round!: Round;

  private readonly totals: Map<string, number>;

  readonly history: PodridaRoundRecord[] = [];

  lastAction: PodridaAction | null = null;

  phaseEndsAt: number | null = null;

  private readonly firstDealerIndex: number;

  // Seats whose cards aren't checked against the play rules (Lero bots, which don't know them):
  // the card only has to be theirs, on their turn.
  private readonly unruledSeats: Set<string>;

  constructor(
    readonly seats: string[],
    private readonly random: RandomInt = randomInt,
    unruledSeats: string[] = [],
  ) {
    this.unruledSeats = new Set(unruledSeats);
    this.schedule = roundSchedule(seats.length);
    this.totals = new Map(seats.map((userId) => [userId, 0]));
    this.firstDealerIndex = random(seats.length);
    this.deal();
  }

  get roundNumber() {
    return this.roundIndex + 1;
  }

  get cardsPerPlayer() {
    return this.round.cardsPerPlayer;
  }

  get turnId(): string | null {
    return this.round.turnIndex === null ? null : this.seats[this.round.turnIndex];
  }

  // Changes with every move and phase: a decision taken at one value is stale at the next.
  get progress() {
    const { round } = this;
    return `${this.roundIndex}:${this.phase}:${round.trickNumber}:${round.trick.length}:${this.turnId}`;
  }

  get isLastRound() {
    return this.roundIndex === this.schedule.length - 1;
  }

  private seatAfter(index: number, steps = 1) {
    return (index + steps) % this.seats.length;
  }

  // Shuffles and deals the current round, one card at a time from the dealer's left. Phase DEALING.
  private deal() {
    const cardsPerPlayer = this.schedule[this.roundIndex];
    const dealerIndex = (this.firstDealerIndex + this.roundIndex) % this.seats.length;
    const isFullDeck = isFullDeckRound(this.seats.length, cardsPerPlayer);
    let deck = shuffle(fullDeck(), this.random);
    let fullDeckTrump: Suit | null = null;

    // Every card will be dealt: turn one up for its suit, then put it back and shuffle again.
    if (isFullDeck) {
      fullDeckTrump = deck[0].suit;
      deck = shuffle(deck, this.random);
    }

    const hands = new Map<string, Card[]>(this.seats.map((userId) => [userId, []]));

    for (let card = 0; card < cardsPerPlayer; card += 1) {
      for (let step = 1; step <= this.seats.length; step += 1) {
        const userId = this.seats[this.seatAfter(dealerIndex, step)];
        hands.get(userId)?.push(deck.pop() as Card);
      }
    }

    // Otherwise the next card of the deck is turned up: its suit is trump, it stays out of play.
    const trumpCard = isFullDeck ? null : (deck.pop() as Card);
    const trumpSuit = trumpCard ? trumpCard.suit : (fullDeckTrump as Suit);

    const bidOrder = this.seats.map((_, step) => this.seats[this.seatAfter(dealerIndex, step + 1)]);

    this.round = {
      cardsPerPlayer,
      trumpSuit,
      trumpCard,
      dealerIndex,
      hands,
      bids: new Map(),
      tricksWon: new Map(this.seats.map((userId) => [userId, 0])),
      log: {
        trumpCard,
        hands: this.seats.map((userId) => ({ userId, cards: [...(hands.get(userId) ?? [])] })),
        tricks: [],
      },
      bidOrder,
      // The first trick is led by the player after the first bidder, two seats left of the dealer.
      leaderIndex: this.seatAfter(dealerIndex, 2),
      turnIndex: null,
      trick: [],
      trickNumber: 1,
      trickWinnerId: null,
    };
    this.phase = PodridaPhase.dealing;
  }

  beginBidding() {
    this.assertPhase(PodridaPhase.dealing);
    this.phase = PodridaPhase.bidding;
    this.round.turnIndex = this.seats.indexOf(this.round.bidOrder[0]);
  }

  private assertPhase(phase: PodridaPhase) {
    if (this.phase !== phase) {
      throw getWrongPhaseError();
    }
  }

  private assertTurn(userId: string) {
    if (this.turnId !== userId) {
      throw getNotYourTurnError();
    }
  }

  // Any number from 0 to the cards of the round, whatever the others bid.
  bid(userId: string, bid: number) {
    this.assertPhase(PodridaPhase.bidding);
    this.assertTurn(userId);

    if (!Number.isInteger(bid) || bid < 0 || bid > this.round.cardsPerPlayer) {
      throw getInvalidBidError(this.round.cardsPerPlayer);
    }

    this.round.bids.set(userId, bid);
    this.lastAction = { kind: "bid", userId, bid };

    const next = this.round.bidOrder[this.round.bids.size];

    if (next) {
      this.round.turnIndex = this.seats.indexOf(next);
      return;
    }

    this.phase = PodridaPhase.playing;
    this.round.turnIndex = this.round.leaderIndex;
  }

  // true when it completes the trick: the phase is TRICK_END until finishTrick().
  play(userId: string, card: Card): boolean {
    this.assertPhase(PodridaPhase.playing);
    this.assertTurn(userId);

    const hand = this.round.hands.get(userId) ?? [];
    const { trick, trumpSuit } = this.round;
    const inHand = hand.some((held) => sameCard(held, card));

    const isChecked = !this.unruledSeats.has(userId);

    if (!inHand || (isChecked && !isPlayable(card, hand, trick, trumpSuit))) {
      throw getCardNotPlayableError(inHand ? playRule(hand, trick, trumpSuit) : null);
    }

    this.round.hands.set(
      userId,
      hand.filter((held) => !sameCard(held, card)),
    );
    trick.push({ userId, card: { suit: card.suit, rank: card.rank } });
    this.lastAction = { kind: "play", userId, card };

    if (trick.length < this.seats.length) {
      this.round.turnIndex = this.seatAfter(this.seats.indexOf(userId));
      return false;
    }

    const winner = trickWinner(trick, trumpSuit).userId;
    this.round.log.tricks.push({
      leaderId: trick[0].userId,
      cards: trick.map((played) => ({ ...played, card: { ...played.card } })),
      winnerId: winner,
    });
    this.round.tricksWon.set(winner, (this.round.tricksWon.get(winner) ?? 0) + 1);
    this.round.trickWinnerId = winner;
    this.round.turnIndex = null;
    this.phase = PodridaPhase.trickEnd;
    return true;
  }

  // Clears the finished trick. Its winner leads the next one, unless the round is over: then the
  // round is scored (phase SCORING) and its record returned, with its full log for storing.
  finishTrick(): { record: PodridaRoundRecord; log: RoundLog } | null {
    this.assertPhase(PodridaPhase.trickEnd);

    const winnerId = this.round.trickWinnerId as string;
    this.lastAction = { kind: "trickWon", userId: winnerId };
    this.round.trick = [];
    this.round.trickWinnerId = null;

    if (this.round.trickNumber < this.round.cardsPerPlayer) {
      this.round.trickNumber += 1;
      this.round.leaderIndex = this.seats.indexOf(winnerId);
      this.round.turnIndex = this.round.leaderIndex;
      this.phase = PodridaPhase.playing;
      return null;
    }

    const record: PodridaRoundRecord = {
      number: this.roundNumber,
      cardsPerPlayer: this.round.cardsPerPlayer,
      trumpSuit: this.round.trumpSuit,
      dealerId: this.seats[this.round.dealerIndex],
      results: this.seats.map((userId) => {
        const bid = this.round.bids.get(userId) ?? 0;
        const won = this.round.tricksWon.get(userId) ?? 0;
        const points = roundScore(bid, won);
        const total = (this.totals.get(userId) ?? 0) + points;
        this.totals.set(userId, total);
        return { userId, bid, won, points, total };
      }),
    };

    this.history.push(record);
    this.phase = PodridaPhase.scoring;
    return { record, log: this.round.log };
  }

  // After the summary: deals the next round (phase DEALING), or ends the game (FINISHED, false).
  nextRound(): boolean {
    this.assertPhase(PodridaPhase.scoring);

    if (this.isLastRound) {
      this.phase = PodridaPhase.finished;
      return false;
    }

    this.roundIndex += 1;
    this.deal();
    return true;
  }

  getTotal(userId: string) {
    return this.totals.get(userId) ?? 0;
  }

  // The simplest legal move, for a bot seat whose bot failed to answer: bids 0, and plays the
  // lowest card it may.
  automaticMove(): { bid: number } | { card: Card } {
    const userId = this.turnId as string;

    if (this.phase === PodridaPhase.bidding) {
      return { bid: 0 };
    }

    const hand = this.round.hands.get(userId) ?? [];
    const [lowest] = [...playableCards(hand, this.round.trick, this.round.trumpSuit)].sort(
      (a, b) => a.rank - b.rank,
    );
    return { card: lowest };
  }

  // The game as one player sees it: their own hand, only the size of the others'.
  viewFor(userId: string): PodridaState {
    const { round } = this;
    const isTrickEnd = this.phase === PodridaPhase.trickEnd;

    return {
      phase: this.phase,
      roundNumber: this.roundNumber,
      roundCount: this.schedule.length,
      cardsPerPlayer: round.cardsPerPlayer,
      isFullDeck: round.trumpCard === null,
      trumpSuit: round.trumpSuit,
      trumpCard: round.trumpCard,
      dealerId: this.seats[round.dealerIndex],
      bidOrder: round.bidOrder,
      turnId: this.turnId,
      leaderId: this.seats[round.leaderIndex],
      hand: [...(round.hands.get(userId) ?? [])],
      handCounts: Object.fromEntries(
        this.seats.map((seat) => [seat, round.hands.get(seat)?.length ?? 0]),
      ),
      bids: Object.fromEntries(this.seats.map((seat) => [seat, round.bids.get(seat) ?? null])),
      tricksWon: Object.fromEntries(
        this.seats.map((seat) => [seat, round.tricksWon.get(seat) ?? 0]),
      ),
      trick: round.trick.map((played) => ({ ...played, card: { ...played.card } })),
      trickNumber: round.trickNumber,
      trickWinnerId: isTrickEnd ? round.trickWinnerId : null,
      totals: Object.fromEntries(this.totals),
      history: this.history,
      lastAction: this.lastAction,
      phaseEndsAt: this.phaseEndsAt,
    };
  }

  // What a bot in this seat knows: its own hand (now and as dealt), and everything public about
  // the round. Never the other hands, or the undealt cards. See @podrida/bots.
  botViewFor(userId: string): BotView {
    const { round } = this;
    const ownDeal = round.log.hands.find((hand) => hand.userId === userId);
    const copy = (played: PlayedCard) => ({ ...played, card: { ...played.card } });

    return {
      seats: [...this.seats],
      me: userId,
      leroSeats: [...this.unruledSeats],
      roundNumber: this.roundNumber,
      roundCount: this.schedule.length,
      cardsPerPlayer: round.cardsPerPlayer,
      dealerId: this.seats[round.dealerIndex],
      trumpSuit: round.trumpSuit,
      trumpCard: round.trumpCard && { ...round.trumpCard },
      hand: [...(round.hands.get(userId) ?? [])].map((card) => ({ ...card })),
      dealtHand: (ownDeal?.cards ?? []).map((card) => ({ ...card })),
      bidOrder: [...round.bidOrder],
      bids: Object.fromEntries(this.seats.map((seat) => [seat, round.bids.get(seat) ?? null])),
      tricks: round.log.tricks.map((trick) => ({
        leaderId: trick.leaderId,
        cards: trick.cards.map(copy),
        winnerId: trick.winnerId,
      })),
      leaderId: this.seats[round.leaderIndex],
      trick: round.trick.map(copy),
      totals: Object.fromEntries(this.totals),
    };
  }

  // Tests only: the full hands.
  peekHand(userId: string) {
    return [...(this.round.hands.get(userId) ?? [])].sort((a, b) =>
      cardKey(a).localeCompare(cardKey(b)),
    );
  }

  peekRound() {
    return this.round;
  }
}
