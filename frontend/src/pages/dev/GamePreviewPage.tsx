import {
  GameStatus,
  PodridaPhase,
  fullDeck,
  maxCardsPerPlayer,
  roundSchedule,
  type Card,
  type Game,
  type PodridaState,
} from "@podrida/shared";
import { useSearchParams } from "react-router";
import { GameScreen } from "../../game/GameScreen";

// DEV ONLY (see router/routes.tsx): the game screen with a made-up game, to look at the layout
// without a backend. /dev/game-preview?players=2..6&phase=bidding|playing|trickEnd|scoring|dealing
// &cards=N&mine=1 (the local player's turn), and &layoutDebug to outline every area.

const names = ["Evelyn", "Nora", "Milo", "Arthur", "Beatrice", "Theodore"];

const previewStart = Date.now();

// The same cards every time, so screenshots can be compared.
const deck = (() => {
  const cards = fullDeck();
  let seed = 7;
  for (let index = cards.length - 1; index > 0; index -= 1) {
    seed = (seed * 9301 + 49297) % 233280;
    const other = Math.floor((seed / 233280) * (index + 1));
    [cards[index], cards[other]] = [cards[other], cards[index]];
  }
  return cards;
})();

export function GamePreviewPage() {
  const [params] = useSearchParams();
  const count = Math.min(6, Math.max(2, Number(params.get("players")) || 4));
  const max = maxCardsPerPlayer(count);
  const cards = Math.min(max, Math.max(1, Number(params.get("cards")) || Math.min(max, 5)));
  const phase =
    Object.values(PodridaPhase).find(
      (value) => value.replace("_", "") === (params.get("phase") ?? "playing").toUpperCase(),
    ) ?? PodridaPhase.playing;
  const mine = params.get("mine") === "1";

  const ids = names.slice(0, count).map((name) => name.toLowerCase());
  const hands = ids.map((_, seat) => deck.slice(seat * cards, seat * cards + cards));
  const trumpCard: Card = deck[count * cards] ?? deck[51];
  const isPlaying = phase === PodridaPhase.playing || phase === PodridaPhase.trickEnd;
  const trickSize =
    phase === PodridaPhase.trickEnd ? count : isPlaying ? Math.max(0, count - (mine ? 1 : 2)) : 0;
  const trick = ids
    .slice(1, 1 + trickSize)
    .map((userId, index) => ({ userId, card: hands[index + 1][0] }));
  if (phase === PodridaPhase.trickEnd) trick.push({ userId: ids[0], card: hands[0][0] });

  const schedule = roundSchedule(count);
  const roundNumber = schedule.indexOf(cards) + 1;
  const turnId =
    phase === PodridaPhase.bidding || phase === PodridaPhase.playing
      ? mine
        ? ids[0]
        : ids[1]
      : null;

  const history = Array.from({ length: roundNumber - 1 }, (_, round) => ({
    number: round + 1,
    cardsPerPlayer: schedule[round],
    trumpSuit: deck[round].suit,
    dealerId: ids[round % count],
    results: ids.map((userId, seat) => {
      const bid = (round + seat) % 2;
      const won = (round * seat) % 2;
      return {
        userId,
        bid,
        won,
        points: bid === won ? 10 + 3 * won : -3,
        total: 10 * (round + 1) - seat * 3,
      };
    }),
  }));

  const state: PodridaState = {
    phase,
    roundNumber,
    roundCount: schedule.length,
    cardsPerPlayer: cards,
    isFullDeck: count * cards === 52,
    trumpSuit: trumpCard.suit,
    trumpCard: count * cards === 52 ? null : trumpCard,
    dealerId: ids[count - 1],
    bidOrder: ids,
    turnId,
    leaderId: ids[1],
    hand: hands[0],
    handCounts: Object.fromEntries(ids.map((userId) => [userId, cards])),
    bids: Object.fromEntries(
      ids.map((userId, seat) => [
        userId,
        phase === PodridaPhase.bidding && seat < 1 + (mine ? 0 : 1) ? null : seat % 3,
      ]),
    ),
    tricksWon: Object.fromEntries(ids.map((userId, seat) => [userId, seat === 2 ? 2 : seat % 2])),
    trick,
    trickNumber: 2,
    trickWinnerId: phase === PodridaPhase.trickEnd ? ids[1] : null,
    totals: Object.fromEntries(ids.map((userId, seat) => [userId, 42 - seat * 17])),
    history:
      phase === PodridaPhase.scoring
        ? [...history, { ...history.at(-1)!, number: roundNumber, cardsPerPlayer: cards }]
        : history,
    lastAction: { kind: "play", userId: ids[1], card: hands[1][0] },
    phaseEndsAt: previewStart + 60_000,
  };

  const game: Game = {
    id: "preview",
    roomName: "Friday night at the club",
    hostId: ids[0],
    players: ids.map((userId, seat) => ({
      userId,
      username: names[seat],
      isConnected: seat !== 3,
      isKicked: false,
    })),
    status: GameStatus.inProgress,
    startedAt: new Date(previewStart).toISOString(),
    state,
  };

  return <GameScreen game={game} meId={ids[0]} forceOnline />;
}
