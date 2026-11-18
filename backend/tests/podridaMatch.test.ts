import { randomInt } from "node:crypto";
import { PodridaPhase, isPlayable, playableCards, roundSchedule } from "@podrida/shared";
import PodridaMatch from "../src/realtime/games/PodridaMatch";

// Plays the match with every seat bidding 0 and playing its first playable card, checking each
// card against the rules. Answers the number of plays.
const playOut = (match: PodridaMatch) => {
  let plays = 0;

  while (match.phase !== PodridaPhase.finished) {
    switch (match.phase) {
      case PodridaPhase.dealing:
        match.beginBidding();
        break;
      case PodridaPhase.bidding:
        match.bid(match.turnId as string, 0);
        break;
      case PodridaPhase.playing: {
        const userId = match.turnId as string;
        const { hand, trick, trumpSuit } = match.viewFor(userId);
        const [card] = playableCards(hand, trick, trumpSuit);
        expect(isPlayable(card, hand, trick, trumpSuit)).toBe(true);
        match.play(userId, card);
        plays += 1;
        break;
      }
      case PodridaPhase.trickEnd:
        match.finishTrick();
        break;
      case PodridaPhase.scoring:
        match.nextRound();
        break;
      default:
        throw new Error(`Unexpected phase ${match.phase}`);
    }
  }

  return plays;
};

// Plays the current round to its end, everyone bidding 0, and deals the next one.
function playOut1Round(match: PodridaMatch) {
  const round = match.roundNumber;

  while (match.roundNumber === round && match.phase !== PodridaPhase.finished) {
    if (match.phase === PodridaPhase.dealing) match.beginBidding();
    else if (match.phase === PodridaPhase.bidding) match.bid(match.turnId as string, 0);
    else if (match.phase === PodridaPhase.playing) {
      const userId = match.turnId as string;
      const { hand, trick, trumpSuit } = match.viewFor(userId);
      match.play(userId, playableCards(hand, trick, trumpSuit)[0]);
    } else if (match.phase === PodridaPhase.trickEnd) match.finishTrick();
    else match.nextRound();
  }
}

describe("a match", () => {
  test.each([2, 3, 4, 5, 6])("with %i players plays every round to the end", (count) => {
    const seats = Array.from({ length: count }, (_, index) => `p${index}`);
    const match = new PodridaMatch(seats);
    const schedule = roundSchedule(count);

    // Every card dealt is played once.
    expect(playOut(match)).toBe(schedule.reduce((sum, cards) => sum + cards * count, 0));
    expect(match.history).toHaveLength(schedule.length);
    expect(match.history.map((round) => round.cardsPerPlayer)).toEqual(schedule);

    // The totals add up round after round.
    seats.forEach((userId, seat) => {
      const points = match.history.reduce((sum, round) => sum + round.results[seat].points, 0);
      expect(match.getTotal(userId)).toBe(points);
      expect(match.history.at(-1)?.results[seat].total).toBe(points);
    });
  });

  test("deals the round's cards, turns up a trump, and the dealer rotates clockwise", () => {
    const match = new PodridaMatch(["a", "b", "c"], () => 0); // First dealer: seat 0.
    const view = match.viewFor("a");

    expect(view).toMatchObject({
      phase: PodridaPhase.dealing,
      roundNumber: 1,
      roundCount: 33,
      cardsPerPlayer: 1,
      isFullDeck: false,
      dealerId: "a",
      bidOrder: ["b", "c", "a"], // Left of the dealer first, the dealer last.
      leaderId: "c", // The player after the first bidder leads the first trick.
      handCounts: { a: 1, b: 1, c: 1 },
    });
    expect(view.hand).toHaveLength(1);
    expect(view.trumpCard?.suit).toBe(view.trumpSuit);

    // Nobody sees anyone else's cards.
    expect(match.viewFor("b").hand).toEqual(match.peekHand("b"));
    expect(JSON.stringify(match.viewFor("a"))).not.toContain(
      JSON.stringify(match.peekHand("b")[0]),
    );

    playOut1Round(match);
    expect(match.viewFor("a").dealerId).toBe("b");
  });

  test("a full-deck round shows no trump card", () => {
    const match = new PodridaMatch(["a", "b", "c", "d"]);

    while (match.cardsPerPlayer < 13) playOut1Round(match);

    const view = match.viewFor("a");
    expect(view).toMatchObject({ cardsPerPlayer: 13, isFullDeck: true, trumpCard: null });
    expect(Object.values(view.handCounts)).toEqual([13, 13, 13, 13]);
  });

  test("refuses moves out of turn, out of phase, out of range or against the rules", () => {
    const match = new PodridaMatch(["a", "b"], (max) => randomInt(max));
    expect(() => match.bid("a", 0)).toThrow("can't be done right now");

    match.beginBidding();
    const [first, second] = match.viewFor("a").bidOrder;
    expect(() => match.bid(second, 0)).toThrow("not your turn");
    expect(() => match.bid(first, 2)).toThrow("Bid from 0 to 1");
    match.bid(first, 1);
    match.bid(second, 0);

    expect(match.phase).toBe(PodridaPhase.playing);
    const leader = match.turnId as string;
    const other = leader === "a" ? "b" : "a";
    expect(() => match.play(leader, match.peekHand(other)[0])).toThrow("isn't in your hand");
  });

  test("scores each round: exact bids earn 10 + 3 per trick, misses lose 3 per trick off", () => {
    const match = new PodridaMatch(["a", "b"]);
    match.beginBidding();
    match.bid(match.turnId as string, 1);
    match.bid(match.turnId as string, 1);

    while (match.phase === PodridaPhase.playing) {
      const userId = match.turnId as string;
      const { hand, trick, trumpSuit } = match.viewFor(userId);
      match.play(userId, playableCards(hand, trick, trumpSuit)[0]);
    }

    const finished = match.finishTrick();
    const points = finished?.record.results.map((result) => result.points).sort((x, y) => x - y);
    expect(points).toEqual([-3, 13]); // One took the trick, the other missed by one.

    // The round's full log, for the stored record: the hands as dealt and every trick.
    const { log } = finished!;
    expect(log.hands.map(({ userId }) => userId)).toEqual(["a", "b"]);
    expect(log.tricks).toHaveLength(1);
    const played = log.tricks[0].cards.map(({ userId, card }) => ({ userId, card }));
    expect(played.map(({ userId }) => userId)).toContain("a");
    log.hands.forEach(({ userId, cards }) => {
      expect(played.find((entry) => entry.userId === userId)?.card).toEqual(cards[0]);
    });
    expect(log.trumpCard?.suit).toBe(finished!.record.trumpSuit);
  });

  test("a seat that plays itself bids 0 and plays its lowest playable card", () => {
    const match = new PodridaMatch(["a", "b", "c"]);
    while (match.cardsPerPlayer < 5) playOut1Round(match);
    match.beginBidding();

    expect(match.automaticMove()).toEqual({ bid: 0 });
    ["a", "b", "c"].forEach(() => match.bid(match.turnId as string, 0));

    const userId = match.turnId as string;
    const { hand, trick, trumpSuit } = match.viewFor(userId);
    const lowest = Math.min(...playableCards(hand, trick, trumpSuit).map((card) => card.rank));
    expect(match.automaticMove()).toMatchObject({ card: { rank: lowest } });
  });
});
