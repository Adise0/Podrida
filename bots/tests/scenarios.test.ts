// Positions with a known good move (tests/scenarios/scenarios.json): each level listed for one has
// to pick the expected move in at least 80% of runs, over several seeds. A failing family of
// positions points at what to fix: the rollout policy, the inference, or the search.
import { BotDifficulty, roundSchedule, trickWinner } from "@podrida/shared";
import { cardName, parseCard, toCard, toId } from "../src/cards";
import { decide } from "../src/decide";
import type { BotView } from "../src/view";
import scenarios from "./scenarios/scenarios.json";

interface Scenario {
  name: string;
  seats: string[];
  dealer: string;
  trump: string;
  trumpCard: string | null;
  cardsPerPlayer: number;
  hand: string[];
  dealt?: string[];
  bids: Record<string, number | null>;
  history: { leader: string; cards: string[] }[];
  current: { leader: string; cards: string[] };
  lero?: string[];
  totals?: Record<string, number>;
  expect: { play?: string; notPlay?: string[]; bid?: number; bidIn?: number[] };
  difficulty: string[];
}

const suitNames: Record<string, "clubs" | "diamonds" | "spades" | "hearts"> = {
  C: "clubs",
  D: "diamonds",
  S: "spades",
  H: "hearts",
};

const card = (name: string) => toCard(parseCard(name));

const viewOf = (scenario: Scenario): BotView => {
  const { seats } = scenario;
  const played = (leader: string, cards: string[]) =>
    cards.map((name, index) => ({
      userId: seats[(seats.indexOf(leader) + index) % seats.length],
      card: card(name),
    }));
  const trumpSuit = suitNames[scenario.trump];
  const tricks = scenario.history.map(({ leader, cards }) => {
    const trick = played(leader, cards);
    return { leaderId: leader, cards: trick, winnerId: trickWinner(trick, trumpSuit).userId };
  });
  const trick = played(scenario.current.leader, scenario.current.cards);
  const dealer = seats.indexOf(scenario.dealer);

  // The hand has the right number of cards.
  const myPlays = [...tricks.flatMap((done) => done.cards), ...trick].filter(
    ({ userId }) => userId === "me",
  ).length;
  if (scenario.hand.length + myPlays !== scenario.cardsPerPlayer) {
    throw new Error(`${scenario.name}: the hand doesn't match the cards per player`);
  }
  const expectedLeader = tricks.at(-1)?.winnerId ?? seats[(dealer + 2) % seats.length];
  if (scenario.current.leader !== expectedLeader) {
    throw new Error(`${scenario.name}: ${expectedLeader} leads the current trick`);
  }

  return {
    seats,
    me: "me",
    leroSeats: scenario.lero ?? [],
    roundNumber: roundSchedule(seats.length).indexOf(scenario.cardsPerPlayer) + 1,
    roundCount: roundSchedule(seats.length).length,
    cardsPerPlayer: scenario.cardsPerPlayer,
    dealerId: scenario.dealer,
    trumpSuit,
    trumpCard: scenario.trumpCard ? card(scenario.trumpCard) : null,
    hand: scenario.hand.map(card),
    dealtHand: (scenario.dealt ?? scenario.hand).map(card),
    bidOrder: seats.map((_, step) => seats[(dealer + step + 1) % seats.length]),
    bids: scenario.bids,
    tricks,
    leaderId: scenario.current.leader,
    trick,
    totals: scenario.totals ?? {},
  };
};

const levels: Record<string, BotDifficulty> = {
  beginner: BotDifficulty.beginner,
  casual: BotDifficulty.casual,
  skilled: BotDifficulty.skilled,
  expert: BotDifficulty.expert,
};

const SEEDS = 10;

describe.each(scenarios as Scenario[])("$name", (scenario) => {
  test.each(scenario.difficulty)("%s", (level) => {
    const view = viewOf(scenario);
    const kind = scenario.expect.bid !== undefined || scenario.expect.bidIn ? "bid" : "play";
    let good = 0;
    const picks: string[] = [];

    for (let seed = 1; seed <= SEEDS; seed++) {
      const decision = decide({
        kind,
        view,
        difficulty: levels[level],
        seed,
        ignoreTimeBudget: true,
      });
      if (decision.kind === "bid") {
        picks.push(String(decision.bid));
        const { bid, bidIn } = scenario.expect;
        if (bid === decision.bid || bidIn?.includes(decision.bid)) good++;
      } else {
        const name = cardName(toId(decision.card));
        picks.push(name);
        const { play, notPlay } = scenario.expect;
        if ((play && name === play) || (notPlay && !notPlay.includes(name))) good++;
      }
    }

    if (good / SEEDS < 0.8) {
      throw new Error(`${level}: ${good}/${SEEDS} good (picked ${picks.join(", ")})`);
    }
  });
});
