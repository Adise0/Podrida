// What a bot is given when asked to decide: exactly what a person in its seat has seen of the
// round, and nothing else. The backend builds it from the live game (PodridaMatch.botViewFor); it
// never holds the other hands or the undealt cards. Plain JSON, so it crosses to a worker thread.
import type { BotDifficulty, Card, PlayedCard, Suit } from "@podrida/shared";

export interface BotTrick {
  leaderId: string;
  cards: PlayedCard[]; // In play order.
  winnerId: string;
}

export interface BotView {
  seats: string[]; // Clockwise, as the game seats them.
  me: string;
  // The seats played by Lero bots (public: everyone sees "(Bot)" and its level). Lero ignores the
  // rules, so nothing can be learned from what they play.
  leroSeats: string[];

  roundNumber: number; // 1-based.
  roundCount: number;
  cardsPerPlayer: number;
  dealerId: string;
  trumpSuit: Suit;
  trumpCard: Card | null; // null in full-deck rounds: every card is dealt.

  hand: Card[]; // What it holds now.
  dealtHand: Card[]; // Its own hand as dealt, in dealing order (Lero plays in this order).

  bidOrder: string[];
  bids: Record<string, number | null>;
  tricks: BotTrick[]; // The finished tricks of this round.
  leaderId: string; // Who leads the current trick (during the bidding: the first trick).
  trick: PlayedCard[]; // The current one.
  totals: Record<string, number>; // Before this round.
}

export type BotDecisionKind = "bid" | "play";

export interface BotRequest {
  kind: BotDecisionKind;
  view: BotView;
  difficulty: BotDifficulty;
  seed: number; // The bot's own: each bot has its own randomness.
  // Tournaments: no time limit, so the same request always gives the same answer. Otherwise the
  // difficulty's time budget applies (the counts are sized to finish well within it).
  ignoreTimeBudget?: boolean;
  debug?: boolean; // Return what it weighed (see BotDecision.debug).
}

export interface BotDecisionStats {
  elapsedMs: number;
  method: string; // "forced", "policy", "pimc", "ismcts", "endgame", "estimate", "lero", "fallback"...
  samples: number;
  fallback: boolean; // The search failed and the bot used its fallback.
  error?: string; // Why, when it did.
}

export type BotDecision = ({ kind: "bid"; bid: number } | { kind: "play"; card: Card }) & {
  stats: BotDecisionStats;
  debug?: { values: Record<string, number>; knowledge?: unknown };
};
