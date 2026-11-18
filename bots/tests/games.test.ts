// Whole games between bots, refereed with the shared rules: every card a bot plays is legal
// (Lero aside), every bid in range, cards are conserved, and the same seeds replay the same game.
import { BotDifficulty, botDifficulties, sameCard, type Card } from "@podrida/shared";
import { decide } from "../src/decide";
import { BotPool } from "../src/pool";
import { playGame, type Seat } from "../src/tournament/referee";
import type { BotView } from "../src/view";

const seatsOf = (difficulties: BotDifficulty[], seedBase = 1): Seat[] =>
  difficulties.map((difficulty, index) => ({
    id: `s${index}`,
    difficulty,
    seed: seedBase + index,
  }));

describe("bot games", () => {
  test.each([2, 3, 4, 5, 6])("%i players, every level: legal, conserved, complete", (players) => {
    const difficulties = Array.from(
      { length: players },
      (_, index) => botDifficulties[(index + players) % botDifficulties.length],
    );
    let views = 0;
    const result = playGame(seatsOf(difficulties), {
      dealSeed: players,
      // A spread of round sizes (with 2 players, up to the full deck).
      rounds: players === 2 ? [1, 2, 3, 9, 26, 40] : [1, 2, 3, 6, 9],
      checkView: (view: BotView, hands: Map<string, Card[]>) => {
        views++;
        // The bot holds what the referee says, and nothing more.
        const real = hands.get(view.me) ?? [];
        expect(view.hand).toHaveLength(real.length);
        view.hand.forEach((card) => expect(real.some((held) => sameCard(held, card))).toBe(true));
        // 52 cards: the hands, what's been played, the trump card and the stock.
        const inHands = [...hands.values()].reduce((total, hand) => total + hand.length, 0);
        const played = view.tricks.length * players + view.trick.length;
        const stock = view.trumpCard ? 52 - players * view.cardsPerPlayer - 1 : 0;
        expect(inHands + played + (view.trumpCard ? 1 : 0) + stock).toBe(52);
      },
    });
    expect(views).toBeGreaterThan(0);
    Object.entries(result.stats).forEach(([id, stats]) => {
      const seat = result.seats.find((candidate) => candidate.id === id) as Seat;
      if (seat.difficulty !== BotDifficulty.lero) expect(stats.illegal).toBe(0);
      expect(stats.fallbacks).toBe(0);
      expect(stats.hits + stats.over + stats.under).toBe(stats.rounds);
    });
    // Trick counts per round add up to the cards per player.
    const rounds = Object.values(result.stats)[0].rows.length;
    for (let round = 0; round < rounds; round++) {
      const rows = Object.values(result.stats).map((stats) => stats.rows[round]);
      expect(rows.reduce((total, row) => total + row.won, 0)).toBe(rows[0].cardsPerPlayer);
    }
  });

  test("Lero plays in dealt order, illegal or not, and its bids average the share of tricks", () => {
    let leroBids = 0;
    let leroBidTotal = 0;
    let expectedTotal = 0;
    const result = playGame(
      seatsOf([BotDifficulty.lero, BotDifficulty.lero, BotDifficulty.lero, BotDifficulty.lero]),
      {
        dealSeed: 99,
        onDecision: (_, view, decision) => {
          if (decision.kind === "bid") {
            leroBids++;
            leroBidTotal += decision.bid;
            expectedTotal += view.cardsPerPlayer / view.seats.length;
          } else {
            const next = view.dealtHand.find((card) =>
              view.hand.some((held) => sameCard(held, card)),
            );
            expect(decision.card).toEqual(next);
          }
        },
      },
    );
    expect(leroBids).toBeGreaterThan(50);
    expect(Math.abs(leroBidTotal - expectedTotal) / expectedTotal).toBeLessThan(0.2);
    // Somebody broke a rule at some point (they don't know them).
    expect(
      Object.values(result.stats).reduce((total, stats) => total + stats.illegal, 0),
    ).toBeGreaterThan(0);
  });

  test("the same seeds and deals replay the same game", () => {
    const run = () => {
      const moves: string[] = [];
      playGame(seatsOf([BotDifficulty.skilled, BotDifficulty.casual, BotDifficulty.expert]), {
        dealSeed: 5,
        ignoreTimeBudget: true,
        rounds: [2, 5, 7],
        onDecision: (seat, _, decision) =>
          moves.push(
            `${seat.id}:${decision.kind === "bid" ? decision.bid : `${decision.card.rank}${decision.card.suit}`}`,
          ),
      });
      return moves;
    };
    expect(run()).toEqual(run());
  });

  test("decisions stay within the time budget", () => {
    const times: Record<string, number[]> = {};
    playGame(
      seatsOf([
        BotDifficulty.expert,
        BotDifficulty.skilled,
        BotDifficulty.casual,
        BotDifficulty.beginner,
      ]),
      {
        dealSeed: 11,
        rounds: [3, 8, 22],
        onDecision: (seat, _, decision) => {
          (times[seat.difficulty] ??= []).push(decision.stats.elapsedMs);
        },
      },
    );
    const budgets: Record<string, number> = {
      EXPERT: 900,
      SKILLED: 400,
      CASUAL: 150,
      BEGINNER: 50,
    };
    Object.entries(times).forEach(([level, list]) => {
      // A margin for the sampling done before the first check of the clock.
      expect(Math.max(...list)).toBeLessThan(budgets[level] * 1.5 + 50);
    });
  });

  test("a broken view falls back instead of failing", () => {
    const view: BotView = {
      seats: ["me", "a"],
      me: "me",
      leroSeats: [],
      roundNumber: 3,
      roundCount: 49,
      cardsPerPlayer: 3,
      dealerId: "a",
      trumpSuit: "spades",
      trumpCard: { suit: "spades", rank: 5 },
      hand: [
        { suit: "clubs", rank: 4 },
        { suit: "hearts", rank: 9 },
        { suit: "hearts", rank: 9 }, // Twice: the counts don't add up.
      ],
      dealtHand: [],
      bidOrder: ["me", "a"],
      bids: { me: 1, a: 2 },
      tricks: [],
      leaderId: "me",
      trick: [],
      totals: {},
    };
    const decision = decide({ kind: "play", view, difficulty: BotDifficulty.expert, seed: 1 });
    expect(decision.kind).toBe("play");
    expect(decision.stats.fallback).toBe(true);
  });

  test("the pool runs decisions (on this thread when it has no workers)", async () => {
    const pool = new BotPool({ size: 0 });
    const view: BotView = {
      seats: ["me", "a"],
      me: "me",
      leroSeats: [],
      roundNumber: 1,
      roundCount: 49,
      cardsPerPlayer: 1,
      dealerId: "a",
      trumpSuit: "spades",
      trumpCard: { suit: "spades", rank: 5 },
      hand: [{ suit: "spades", rank: 14 }],
      dealtHand: [{ suit: "spades", rank: 14 }],
      bidOrder: ["me", "a"],
      bids: { me: null, a: null },
      tricks: [],
      leaderId: "a",
      trick: [],
      totals: {},
    };
    const decision = await pool.decide({
      kind: "bid",
      view,
      difficulty: BotDifficulty.skilled,
      seed: 3,
    });
    // The ace of trumps in a one-card round always wins.
    expect(decision).toMatchObject({ kind: "bid", bid: 1 });
    await pool.close();
  });
});
