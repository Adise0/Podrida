// The rules of Podrida, shared by the server (which enforces them) and the frontend (which darkens
// the cards that can't be played and explains why). Pure functions only: no state, no I/O.
//
// A standard 52-card deck, ace high, suits unranked. Round 1 deals 1 card each, then 2... up to the
// maximum, played once, then back down to 1. Everyone bids how many tricks they'll win, then plays.

export const suits = ["clubs", "diamonds", "spades", "hearts"] as const;
export type Suit = (typeof suits)[number];

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 11 J, 12 Q, 13 K, 14 A.
export const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface PlayedCard {
  userId: string;
  card: Card;
}

export const podridaLimits = <const>{
  minPlayers: 2,
  maxPlayers: 6,
};

export const suitSymbols: Record<Suit, string> = {
  clubs: "♣",
  diamonds: "♦",
  spades: "♠",
  hearts: "♥",
};

export const isRedSuit = (suit: Suit) => suit === "hearts" || suit === "diamonds";

export const rankLabel = (rank: Rank) =>
  ({ 11: "J", 12: "Q", 13: "K", 14: "A" })[rank as 11 | 12 | 13 | 14] ?? String(rank);

export const sameCard = (a: Card, b: Card) => a.suit === b.suit && a.rank === b.rank;

export const cardKey = (card: Card) => `${card.rank}-${card.suit}`;

export const fullDeck = (): Card[] =>
  suits.flatMap((suit) => ranks.map((rank) => ({ suit, rank })));

// ROUNDS

// floor(51 / N), or 52 / N when N divides the deck evenly (every card is dealt in that round).
export const maxCardsPerPlayer = (playerCount: number) =>
  52 % playerCount === 0 ? 52 / playerCount : Math.floor(51 / playerCount);

// Cards per player in each round: 1, 2... max... 2, 1.
export const roundSchedule = (playerCount: number): number[] => {
  const max = maxCardsPerPlayer(playerCount);
  const up = Array.from({ length: max }, (_, index) => index + 1);
  return [...up, ...up.slice(0, -1).reverse()];
};

// Every card is dealt: no trump card stays on the table (its suit is picked before dealing).
export const isFullDeckRound = (playerCount: number, cardsPerPlayer: number) =>
  playerCount * cardsPerPlayer === 52;

// SCORING

// Exactly the bid: 10 + 3 per trick. Otherwise -3 per trick off.
export const roundScore = (bid: number, won: number) =>
  bid === won ? 10 + 3 * won : -3 * Math.abs(bid - won);

// TRICKS

const highest = (cards: Card[]) =>
  cards.reduce<Card | null>((best, card) => (!best || card.rank > best.rank ? card : best), null);

// The card that takes the trick: the highest trump if any was played, the highest card of the led
// suit otherwise. Other cards never win.
export const trickWinner = (trick: PlayedCard[], trump: Suit): PlayedCard => {
  const led = trick[0].card.suit;
  const trumps = trick.filter(({ card }) => card.suit === trump);
  const contenders = trumps.length > 0 ? trumps : trick.filter(({ card }) => card.suit === led);

  return contenders.reduce((best, played) => (played.card.rank > best.card.rank ? played : best));
};

// Why the cards that can be played are the ones they are, in the rules' order. The frontend
// turns it into the hint line, the server into the error of a refused card.
export type PlayRule =
  | { kind: "lead" } // Anything goes.
  | { kind: "mustBeat"; led: Suit; toBeat: Card } // Follow, with a higher card of the led suit.
  | { kind: "follow"; led: Suit; toBeat: Card } // Follow: none can beat it, so any of the led suit.
  | { kind: "mustTrump"; led: Suit; trump: Suit } // None of the led suit: a trump, any of them.
  | { kind: "overtrump"; led: Suit; toBeat: Card } // A higher trump than the trick's best.
  | { kind: "free"; led: Suit; trump: Suit; reason: "noLedNoTrump" | "cantOvertrump" };

export const playRule = (hand: Card[], trick: PlayedCard[], trump: Suit): PlayRule => {
  if (trick.length === 0) return { kind: "lead" };

  const led = trick[0].card.suit;
  const ledInHand = hand.filter((card) => card.suit === led);

  if (ledInHand.length > 0) {
    // Only the led suit counts here: off-suit cards and trumps in the trick are ignored.
    const toBeat = highest(
      trick.map(({ card }) => card).filter((card) => card.suit === led),
    ) as Card;
    const canBeat = ledInHand.some((card) => card.rank > toBeat.rank);
    return { kind: canBeat ? "mustBeat" : "follow", led, toBeat };
  }

  const trumpsInHand = hand.filter((card) => card.suit === trump);

  if (trumpsInHand.length === 0) return { kind: "free", led, trump, reason: "noLedNoTrump" };

  const bestTrump = highest(trick.map(({ card }) => card).filter((card) => card.suit === trump));

  if (!bestTrump) return { kind: "mustTrump", led, trump };

  return trumpsInHand.some((card) => card.rank > bestTrump.rank)
    ? { kind: "overtrump", led, toBeat: bestTrump }
    : { kind: "free", led, trump, reason: "cantOvertrump" };
};

// The cards of the hand that may be played on this trick (all of them when leading).
export const playableCards = (hand: Card[], trick: PlayedCard[], trump: Suit): Card[] => {
  const rule = playRule(hand, trick, trump);

  switch (rule.kind) {
    case "mustBeat":
      return hand.filter((card) => card.suit === rule.led && card.rank > rule.toBeat.rank);
    case "follow":
      return hand.filter((card) => card.suit === rule.led);
    case "mustTrump":
      return hand.filter((card) => card.suit === trump);
    case "overtrump":
      return hand.filter((card) => card.suit === trump && card.rank > rule.toBeat.rank);
    default:
      return hand;
  }
};

export const isPlayable = (card: Card, hand: Card[], trick: PlayedCard[], trump: Suit) =>
  playableCards(hand, trick, trump).some((playable) => sameCard(playable, card));

// THE GAME AS A PLAYER SEES IT

export enum PodridaPhase {
  dealing = "DEALING",
  bidding = "BIDDING",
  playing = "PLAYING",
  trickEnd = "TRICK_END", // The trick is complete: its winner is shown for a moment.
  scoring = "SCORING", // The round is over: its summary is shown for a moment.
  finished = "FINISHED",
}

export interface PodridaRoundResult {
  userId: string;
  bid: number;
  won: number;
  points: number;
  total: number; // After this round.
}

export interface PodridaRoundRecord {
  number: number; // 1-based.
  cardsPerPlayer: number;
  trumpSuit: Suit;
  dealerId: string;
  results: PodridaRoundResult[]; // In seat order.
}

// What just happened, for the "last action" line and the sounds.
export type PodridaAction =
  | { kind: "bid"; userId: string; bid: number }
  | { kind: "play"; userId: string; card: Card }
  | { kind: "trickWon"; userId: string };

// Personal: everyone gets their own hand, and only the number of cards of the others.
export interface PodridaState {
  phase: PodridaPhase;
  roundNumber: number; // 1-based.
  roundCount: number;
  cardsPerPlayer: number;
  isFullDeck: boolean;
  trumpSuit: Suit;
  trumpCard: Card | null; // null in full-deck rounds.
  dealerId: string;
  bidOrder: string[]; // Left of the dealer first, the dealer last.
  turnId: string | null; // Who must bid or play now.
  leaderId: string | null; // Who leads the current trick.
  hand: Card[]; // In the order dealt.
  handCounts: Record<string, number>;
  bids: Record<string, number | null>;
  tricksWon: Record<string, number>; // This round.
  trick: PlayedCard[]; // The current trick, in play order.
  trickNumber: number; // 1-based.
  trickWinnerId: string | null; // While the phase is TRICK_END.
  totals: Record<string, number>;
  history: PodridaRoundRecord[]; // The finished rounds.
  lastAction: PodridaAction | null;
  phaseEndsAt: number | null; // Epoch ms, for the timed phases (dealing, trick end, scoring).
}
