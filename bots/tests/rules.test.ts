// The bots' fast rules against the real ones (@podrida/shared), which the game enforces: on every
// rule in priority order, then on many random positions.
import {
  fullDeck,
  playableCards,
  suits,
  trickWinner,
  type Card,
  type PlayedCard,
  type Suit,
} from "@podrida/shared";
import { cardsOf, masksOf, parseCard, toCard, toId } from "../src/cards";
import { createRng, shuffleInPlace } from "../src/rng";
import { legalInto, winningIndex, wouldWin } from "../src/rules";

const names = (cards: Card[]) =>
  cards
    .map(toId)
    .sort((a, b) => a - b)
    .map((id) => toCard(id))
    .map(({ suit, rank }) => `${rank}${suit[0]}`);

const fastLegal = (hand: Card[], trick: PlayedCard[], trump: Suit) => {
  const out = [0, 0, 0, 0];
  const ids = trick.map(({ card }) => toId(card));
  legalInto(masksOf(hand.map(toId)), 0, ids, ids.length, suits.indexOf(trump), out);
  return cardsOf(out).map(toCard);
};

const cards = (...list: string[]) => list.map((name) => toCard(parseCard(name)));
const trickOf = (...list: string[]) =>
  cards(...list).map((card, index) => ({ userId: `p${index}`, card }));

describe("fast rules, rule by rule", () => {
  const check = (hand: Card[], trick: PlayedCard[], trump: Suit, expected: Card[]) => {
    expect(names(fastLegal(hand, trick, trump))).toEqual(names(expected));
    expect(names(playableCards(hand, trick, trump))).toEqual(names(expected));
  };

  test("leading: anything", () => {
    check(cards("2C", "KH", "AS"), [], "hearts", cards("2C", "KH", "AS"));
  });

  test("must beat the highest card of the led suit, ignoring off-suit cards and trumps", () => {
    // Led 9♣, then a K♦ (off-suit) and a 3♥ (trump): only the 9♣ counts.
    check(cards("10C", "4C", "AD"), trickOf("9C", "KD", "3H"), "hearts", cards("10C"));
  });

  test("follows without beating when it can't beat (even when someone trumped)", () => {
    check(cards("4C", "2C", "AH"), trickOf("9C", "3H"), "hearts", cards("4C", "2C"));
  });

  test("void in the led suit, no trump in the trick: must trump, any trump", () => {
    check(cards("2H", "QH", "AS"), trickOf("9C"), "hearts", cards("2H", "QH"));
  });

  test("a trump in the trick: overtrump if possible", () => {
    check(cards("2H", "QH", "AS"), trickOf("9C", "10H"), "hearts", cards("QH"));
  });

  test("can't overtrump: anything goes", () => {
    check(cards("2H", "3H", "AS"), trickOf("9C", "10H"), "hearts", cards("2H", "3H", "AS"));
  });

  test("no led suit and no trumps: anything goes", () => {
    check(cards("2S", "AD"), trickOf("9C"), "hearts", cards("2S", "AD"));
  });

  test("trump led: it's the led suit, must beat it", () => {
    check(cards("2H", "KH", "AS"), trickOf("10H"), "hearts", cards("KH"));
    check(cards("2H", "3H", "AS"), trickOf("10H"), "hearts", cards("2H", "3H"));
  });

  test("trick winner: the highest trump, else the highest led card", () => {
    expect(winningIndex(cards("9C", "KD", "3H").map(toId), 3, suits.indexOf("hearts"))).toBe(2);
    expect(winningIndex(cards("9C", "KD", "10C").map(toId), 3, suits.indexOf("hearts"))).toBe(2);
    expect(winningIndex(cards("9C", "KD", "2C").map(toId), 3, suits.indexOf("hearts"))).toBe(0);
  });
});

describe("fast rules agree with the shared rules", () => {
  test("on 20 000 random positions", () => {
    const rng = createRng(12345);
    for (let run = 0; run < 20_000; run++) {
      const deck = shuffleInPlace(fullDeck(), rng);
      const players = 2 + rng.int(5);
      const handSize = 1 + rng.int(13);
      const trickLength = rng.int(players);
      const hand = deck.slice(0, handSize);
      const trick = deck
        .slice(handSize, handSize + trickLength)
        .map((card, index) => ({ userId: `p${index}`, card }));
      const trump = suits[rng.int(4)];

      expect(names(fastLegal(hand, trick, trump))).toEqual(
        names(playableCards(hand, trick, trump)),
      );

      if (trickLength > 0) {
        const ids = trick.map(({ card }) => toId(card));
        expect(trick[winningIndex(ids, ids.length, suits.indexOf(trump))].userId).toBe(
          trickWinner(trick, trump).userId,
        );
        const card = hand[0];
        const winsShared = trickWinner([...trick, { userId: "me", card }], trump).userId === "me";
        expect(wouldWin(ids, ids.length, suits.indexOf(trump), toId(card))).toBe(winsShared);
      }
    }
  });
});
