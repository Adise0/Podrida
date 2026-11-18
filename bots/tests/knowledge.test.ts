// The belief state and the sampler, checked on real games: after every move, the true deal must
// satisfy everything the bot inferred, and every sampled deal must respect hand sizes, voids,
// ceilings and the size of the undealt stock.
import { BotDifficulty, sameCard, type Card } from "@podrida/shared";
import { bitCount, rankOf, SUITS, suitOf, toId } from "../src/cards";
import { buildKnowledge, isConsistent } from "../src/knowledge";
import { createRng } from "../src/rng";
import { sampleDeals } from "../src/sampler";
import { playGame, type Seat } from "../src/tournament/referee";
import type { BotView } from "../src/view";

const seatsOf = (difficulties: BotDifficulty[]): Seat[] =>
  difficulties.map((difficulty, index) => ({ id: `s${index}`, difficulty, seed: 100 + index }));

const checkPosition = (view: BotView, hands: Map<string, Card[]>) => {
  const knowledge = buildKnowledge(view, { voids: true, ceilings: true });

  // The truth fits what was learned.
  view.seats.forEach((userId, seat) => {
    if (seat === knowledge.me) return;
    const truth = (hands.get(userId) ?? []).map(toId);
    expect(isConsistent(knowledge, seat, truth)).toBe(true);
    expect(knowledge.handSizes[seat]).toBe(truth.length);
  });

  // Unseen = the others' hands plus the stock.
  const othersCards = view.seats
    .filter((userId) => userId !== view.me)
    .reduce((total, userId) => total + (hands.get(userId)?.length ?? 0), 0);
  const unseen = knowledge.unseen.reduce((total, mask) => total + bitCount(mask), 0);
  expect(unseen).toBe(othersCards + knowledge.stockSize);

  // Samples.
  const deals = sampleDeals(knowledge, createRng(view.roundNumber * 31 + view.trick.length), {
    count: 3,
    bidWeight: 0.5,
    cardsPerPlayer: view.cardsPerPlayer,
  });
  deals.forEach(({ hands: dealt }) => {
    let inHands = 0;
    for (let seat = 0; seat < knowledge.players; seat++) {
      const masks = Array.from({ length: SUITS }, (_, suit) => dealt[seat * SUITS + suit]);
      const size = masks.reduce((total, mask) => total + bitCount(mask), 0);
      expect(size).toBe(seat === knowledge.me ? view.hand.length : knowledge.handSizes[seat]);
      masks.forEach((mask, suit) => {
        if (seat === knowledge.me) expect(mask).toBe(knowledge.hand[suit]);
        else {
          expect(mask & ~knowledge.allowed[seat * SUITS + suit]).toBe(0);
          expect(mask & ~knowledge.unseen[suit]).toBe(0);
        }
        // No card twice.
        for (let other = 0; other < seat; other++)
          expect(mask & dealt[other * SUITS + suit]).toBe(0);
      });
      if (seat !== knowledge.me) inHands += size;
    }
    expect(unseen - inHands).toBe(knowledge.stockSize);
  });
};

describe("belief state", () => {
  test.each([
    [[BotDifficulty.casual, BotDifficulty.beginner, BotDifficulty.skilled, BotDifficulty.casual]],
    [[BotDifficulty.beginner, BotDifficulty.casual, BotDifficulty.beginner]],
    [[BotDifficulty.casual, BotDifficulty.casual]],
    [
      [
        BotDifficulty.beginner,
        BotDifficulty.casual,
        BotDifficulty.beginner,
        BotDifficulty.casual,
        BotDifficulty.beginner,
        BotDifficulty.casual,
      ],
    ],
  ])("the true deal fits every inference, samples fit the constraints (%j)", (difficulties) => {
    let checks = 0;
    playGame(seatsOf(difficulties), {
      dealSeed: difficulties.length * 7,
      rounds: [1, 2, 3, 5, 8, 13], // Small to the biggest some counts get.
      checkView: (view, hands) => {
        checkPosition(view, hands);
        checks++;
      },
    });
    expect(checks).toBeGreaterThan(50);
  });

  test("a Lero seat teaches nothing but the cards it played", () => {
    playGame(seatsOf([BotDifficulty.lero, BotDifficulty.casual, BotDifficulty.lero]), {
      dealSeed: 3,
      rounds: [4, 9, 16],
      checkView: (view) => {
        const knowledge = buildKnowledge(view, { voids: true, ceilings: true });
        view.seats.forEach((userId, seat) => {
          if (!view.leroSeats.includes(userId)) return;
          for (let suit = 0; suit < SUITS; suit++) {
            expect(knowledge.void[seat * SUITS + suit]).toBe(false);
            // Only what's gone is excluded (nothing is ever cleared from `allowed` for them).
            expect(knowledge.allowed[seat * SUITS + suit]).toBe(8191);
          }
        });
      },
    });
  });

  test("voids and ceilings are learned", () => {
    // Clubs led with the 9, then a 5♣ (under it: no club above the 9), then a spade (void in
    // clubs, and in trumps since nobody had trumped).
    const view: BotView = {
      seats: ["me", "a", "b", "c"],
      me: "me",
      leroSeats: [],
      roundNumber: 5,
      roundCount: 25,
      cardsPerPlayer: 5,
      dealerId: "c",
      trumpSuit: "hearts",
      trumpCard: { suit: "hearts", rank: 2 },
      hand: [
        { suit: "clubs", rank: 2 },
        { suit: "diamonds", rank: 14 },
        { suit: "spades", rank: 3 },
        { suit: "spades", rank: 4 },
        { suit: "hearts", rank: 9 },
      ],
      dealtHand: [],
      bidOrder: ["me", "a", "b", "c"],
      bids: { me: 1, a: 1, b: 1, c: 1 },
      tricks: [],
      leaderId: "a",
      trick: [
        { userId: "a", card: { suit: "clubs", rank: 9 } },
        { userId: "b", card: { suit: "clubs", rank: 5 } },
        { userId: "c", card: { suit: "spades", rank: 13 } },
      ],
      totals: {},
    };
    const knowledge = buildKnowledge(view, { voids: true, ceilings: true });
    const clubs = suitOf(toId({ suit: "clubs", rank: 2 }));
    const hearts = suitOf(toId({ suit: "hearts", rank: 2 }));
    // b: no club above the 9.
    expect(knowledge.allowed[2 * SUITS + clubs] >> rankOf(toId({ suit: "clubs", rank: 10 }))).toBe(
      0,
    );
    // c: void in clubs and in hearts.
    expect(knowledge.void[3 * SUITS + clubs]).toBe(true);
    expect(knowledge.void[3 * SUITS + hearts]).toBe(true);
    // Without ceiling inference, b stays unconstrained.
    const casual = buildKnowledge(view, { voids: true, ceilings: false });
    expect(casual.allowed[2 * SUITS + clubs]).toBe(8191);
    expect(view.hand.some((card) => sameCard(card, { suit: "clubs", rank: 2 }))).toBe(true);
  });
});
