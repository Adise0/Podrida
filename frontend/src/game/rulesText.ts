import {
  PodridaPhase,
  playRule,
  rankLabel,
  suitSymbols,
  type Card,
  type Game,
  type PlayRule,
  type Suit,
} from "@podrida/shared";

// Everything the game screen says in words: the heading, the hint line, the last action.

const suitNames: Record<Suit, { plural: string; singular: string }> = {
  spades: { plural: "spades", singular: "spade" },
  hearts: { plural: "hearts", singular: "heart" },
  diamonds: { plural: "diamonds", singular: "diamond" },
  clubs: { plural: "clubs", singular: "club" },
};

export const suitName = (suit: Suit) => suitNames[suit].plural;

export const cardLabel = (card: Card) => `${rankLabel(card.rank)}${suitSymbols[card.suit]}`;

const rankWords: Record<number, string> = { 11: "jack", 12: "queen", 13: "king", 14: "ace" };
export const cardWords = (card: Card) =>
  `${rankWords[card.rank] ?? card.rank} of ${suitNames[card.suit].plural}`;

export const firstName = (username: string) => username;

// The rule the local player's next card must follow, in plain words.
export const ruleText = (rule: PlayRule): string => {
  switch (rule.kind) {
    case "lead":
      return "You lead — play any card.";
    case "mustBeat":
      return `Follow ${suitName(rule.led)} — you must beat the ${cardLabel(rule.toBeat)}.`;
    case "follow":
      return `Follow ${suitName(rule.led)} — you can't beat the ${cardLabel(rule.toBeat)}, play any ${suitNames[rule.led].singular}.`;
    case "mustTrump":
      return `No ${suitName(rule.led)} — you must play a trump (${suitSymbols[rule.trump]}).`;
    case "overtrump":
      return `No ${suitName(rule.led)} — you must beat the ${cardLabel(rule.toBeat)} with a higher trump.`;
    case "free":
      return rule.reason === "noLedNoTrump"
        ? `No ${suitName(rule.led)} and no trumps — play any card.`
        : `No ${suitName(rule.led)} and no trump that beats the trick's — play any card.`;
    default:
      return "";
  }
};

// The text after "That card can't be played — ", lowercase first letter.
export const refusedCardText = (rule: PlayRule | null) => {
  if (!rule) return "That card isn't in your hand.";
  const text = ruleText(rule);
  const reason = text.split(" — ")[1] ?? text;
  return `That card can't be played — ${reason}`;
};

export type BidTotalState = "under" | "exact" | "over";

export const bidTotalState = (total: number, tricks: number): BidTotalState =>
  total < tricks ? "under" : total === tricks ? "exact" : "over";

export const bidTotalWord = (total: number, tricks: number) => {
  const state = bidTotalState(total, tricks);
  if (state === "exact") return "Exact";
  return state === "under" ? `Under by ${tricks - total}` : `Over by ${total - tricks}`;
};

const nameOf = (game: Game, userId: string | null) =>
  game.players.find((player) => player.userId === userId)?.username ?? "Someone";

const isAway = (game: Game, userId: string | null) =>
  game.players.find((player) => player.userId === userId)?.isConnected === false;

// The big heading under the table centre, and the hint line under it.
export function statusText(
  game: Game,
  meId: string,
): { heading: string; hint: string; isMine: boolean } {
  const { state } = game;
  const turnName = nameOf(game, state.turnId);
  const isMine = state.turnId === meId;
  const bidTotal = Object.values(state.bids).reduce<number>((sum, bid) => sum + (bid ?? 0), 0);
  const myBid = state.bids[meId];
  const myWon = state.tricksWon[meId] ?? 0;

  const waitingHint = () => {
    if (myBid === null || myBid === undefined) return "";
    if (myWon > myBid) return `You've bid ${myBid} · you're over by ${myWon - myBid}`;
    if (myWon === myBid) return `You've bid ${myBid} · you have your tricks, take no more`;
    const need = myBid - myWon;
    return `You've bid ${myBid} · you need ${need} more trick${need === 1 ? "" : "s"}`;
  };

  switch (state.phase) {
    case PodridaPhase.dealing:
      return { heading: "Dealing…", hint: "", isMine: false };

    case PodridaPhase.bidding: {
      const hint = `Round of ${state.cardsPerPlayer} card${state.cardsPerPlayer === 1 ? "" : "s"} · trump is ${suitName(state.trumpSuit)} · bids so far total ${bidTotal}`;
      // Plain: no bullet and no gold during your own bid.
      if (isMine) return { heading: "Your bid", hint, isMine };
      const heading = isAway(game, state.turnId)
        ? `Waiting for ${turnName} to reconnect…`
        : `${turnName} is bidding…`;
      return { heading, hint, isMine };
    }

    case PodridaPhase.playing: {
      if (isMine) {
        return {
          heading: "• Your turn",
          hint: ruleText(playRule(state.hand, state.trick, state.trumpSuit)),
          isMine,
        };
      }
      const heading = isAway(game, state.turnId)
        ? `Waiting for ${turnName} to reconnect…`
        : `Waiting for ${turnName}…`;
      return { heading, hint: waitingHint(), isMine };
    }

    case PodridaPhase.trickEnd:
      return {
        heading:
          state.trickWinnerId === meId
            ? "You win the trick"
            : `${nameOf(game, state.trickWinnerId)} wins the trick`,
        hint: waitingHint(),
        isMine: false,
      };

    case PodridaPhase.scoring:
      return { heading: `Round ${state.roundNumber} complete`, hint: "", isMine: false };

    default:
      return { heading: "Game over", hint: "", isMine: false };
  }
}

// "Milo played 9 of spades", "Nora won the trick", "Arthur bid 2".
export function lastActionText(game: Game, meId: string): string {
  const action = game.state.lastAction;
  if (!action) return "";
  const who = action.userId === meId ? "You" : nameOf(game, action.userId);

  switch (action.kind) {
    case "bid":
      return `${who} bid ${action.bid}`;
    case "play":
      return `${who} played ${cardWords(action.card)}`;
    default:
      return `${who} won the trick`;
  }
}
