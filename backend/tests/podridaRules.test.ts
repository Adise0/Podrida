import {
  maxCardsPerPlayer,
  playableCards,
  playRule,
  roundSchedule,
  roundScore,
  trickWinner,
  type Card,
  type PlayedCard,
  type Rank,
  type Suit,
} from "@podrida/shared";

// "5S" is the 5 of spades, "10H" the 10 of hearts, "QD" the queen of diamonds...
const suitOf: Record<string, Suit> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };
const rankOf: Record<string, Rank> = { J: 11, Q: 12, K: 13, A: 14 };
const c = (code: string): Card => ({
  suit: suitOf[code.slice(-1)],
  rank: rankOf[code.slice(0, -1)] ?? (Number(code.slice(0, -1)) as Rank),
});
const cards = (...codes: string[]) => codes.map(c);
const trick = (...codes: string[]): PlayedCard[] =>
  codes.map((code, index) => ({ userId: `p${index}`, card: c(code) }));

describe("rounds", () => {
  test.each([
    [2, 26, 52],
    [3, 17, 35],
    [4, 13, 28],
    [5, 10, 23],
    [6, 8, 20],
  ])("%i players: up to %i cards, %i rounds", (players, max, rounds) => {
    expect(maxCardsPerPlayer(players)).toBe(max);
    expect(roundSchedule(players)).toHaveLength(rounds);
  });

  test("go up to the maximum, play it once per player, then back down", () => {
    expect(roundSchedule(6)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 8, 8, 8, 8, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(roundSchedule(4)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 13, 13, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
    ]);
  });
});

describe("scoring", () => {
  test.each([
    [0, 0, 10],
    [3, 3, 19],
    [2, 4, -6],
    [2, 1, -3],
    [0, 2, -6],
  ])("bid %i, won %i: %i points", (bid, won, points) => {
    expect(roundScore(bid, won)).toBe(points);
  });
});

describe("playable cards", () => {
  test("the leader plays anything", () => {
    const hand = cards("2S", "KH", "9C");
    expect(playableCards(hand, [], "hearts")).toEqual(hand);
    expect(playRule(hand, [], "hearts")).toEqual({ kind: "lead" });
  });

  test("with the led suit, a higher one if there is one", () => {
    expect(playableCards(cards("5S", "QS", "2S", "KD"), trick("9S"), "hearts")).toEqual(
      cards("QS"),
    );
  });

  test("only led-suit cards count for what to beat (3♠ led, J♦ discarded: beat the 3♠)", () => {
    expect(playableCards(cards("5S", "2S", "KD"), trick("3S", "JD"), "hearts")).toEqual(
      cards("5S"),
    );
  });

  test("with the led suit but nothing higher, any card of it", () => {
    const hand = cards("2S", "4S", "AH");
    expect(playableCards(hand, trick("QS"), "hearts")).toEqual(cards("2S", "4S"));
    expect(playRule(hand, trick("QS"), "hearts")).toEqual({
      kind: "follow",
      led: "spades",
      toBeat: c("QS"),
    });
  });

  test("someone already trumped: still just follow, beating the led suit, not the trump", () => {
    expect(playableCards(cards("5S", "2S", "AH"), trick("3S", "2H"), "hearts")).toEqual(
      cards("5S"),
    );
  });

  test("no led suit, no trump in the trick yet: any trump", () => {
    expect(playableCards(cards("3H", "QH", "KC"), trick("9S"), "hearts")).toEqual(
      cards("3H", "QH"),
    );
  });

  test("no led suit, a trump already played: a higher trump", () => {
    expect(playableCards(cards("9H", "3H", "KC"), trick("9S", "8H"), "hearts")).toEqual(
      cards("9H"),
    );
  });

  test("no led suit and only lower trumps: anything (the trumps can be kept)", () => {
    const hand = cards("3H", "KC");
    expect(playableCards(hand, trick("9S", "8H"), "hearts")).toEqual(hand);
    expect(playRule(hand, trick("9S", "8H"), "hearts")).toMatchObject({
      kind: "free",
      reason: "cantOvertrump",
    });
  });

  test("no led suit and no trumps: anything", () => {
    const hand = cards("3D", "KC");
    expect(playableCards(hand, trick("9S"), "hearts")).toEqual(hand);
  });

  test("trump led: it's the led suit, so the first rule applies", () => {
    expect(playableCards(cards("2H", "JH", "AS"), trick("10H"), "hearts")).toEqual(cards("JH"));
  });
});

describe("trick winner", () => {
  test("the highest trump, if any was played", () => {
    expect(trickWinner(trick("AS", "2H", "KS", "5H"), "hearts").userId).toBe("p3");
  });

  test("otherwise the highest card of the led suit, off-suit cards never win", () => {
    expect(trickWinner(trick("9S", "AD", "JS", "2C"), "hearts").userId).toBe("p2");
  });
});
