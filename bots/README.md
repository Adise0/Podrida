# @podrida/bots

The computer players of Podrida. Pure computation: given what a bot's seat can see, a bid or a card.
The backend runs it in worker threads (see "Bots" in [backend/README.md](../backend/README.md)), the
tournament runner and the tests call it directly.

```ts
import { decide, BotPool } from "@podrida/bots";

decide({ kind: "play", view, difficulty: BotDifficulty.skilled, seed }); // → { kind: "play", card, stats }
```

`view` (a `BotView`) is everything a person in that seat would know, and nothing else: its own hand
(now, and as dealt), the trump, the bids, every card played this round and by whom, the scores.
The backend builds it with `PodridaMatch.botViewFor()`; it never holds the other hands or the
undealt cards. Bots never share anything with each other, even at the same table: each has its own
seed and knows only its own view.

## The levels

| Level    | Plays by                                                                 | Bids by                      |
| -------- | ------------------------------------------------------------------------ | ---------------------------- |
| Lero     | The next card in the order it was dealt, legal or not                    | Binomial(cards, 1 / players) |
| Beginner | The rollout policy alone, 15% random mistakes                            | The quick estimate, noisy    |
| Casual   | PIMC, 12 sampled deals, voids inferred                                   | Simulation, 20 deals         |
| Skilled  | PIMC, 40 deals, voids and ceilings, deals weighed by bids, exact endgame | Simulation, 60 deals         |
| Expert   | ISMCTS (or PIMC), 100 deals, stronger bid weighing, spoiler term         | Simulation, 150 deals        |

The parameters are in [difficulty.ts](src/difficulty.ts): one config per level, not different code.
Lero is the exception: it has no strategy at all ([lero.ts](src/lero.ts)), and the game accepts its
cards without checking the play rules.

## How a decision is made

- **Knowledge** ([knowledge.ts](src/knowledge.ts)): rebuilt from the view on every decision. Exact
  constraints per opponent and suit, learned from the rules: a player who didn't follow is void in
  the led suit (and in trumps if nobody had trumped and they didn't); one who played under the
  trick's best card of the led suit has nothing higher in it; same idea for overtrumping. Nothing
  is learned from Lero seats.
- **Sampling** ([sampler.ts](src/sampler.ts)): possible deals of the unseen cards to the opponents
  and the undealt stock, consistent with hand sizes and the constraints (most constrained cards
  first, restarts, then an exact matching as a fallback). With a bid weight, deals that fit the
  opponents' bids are drawn more often.
- **Card play** ([decide.ts](src/decide.ts)): every legal card is tried on the same sampled deals
  and the round played out with the rollout policy (PIMC, [search/pimc.ts](src/search/pimc.ts)), or
  an ISMCTS tree is grown over them ([search/ismcts.ts](src/search/ismcts.ts)). With few cards left
  (or in rounds of 1 to 3 cards) each deal is solved exactly instead, every player maximising their
  own score ([search/endgame.ts](src/search/endgame.ts)). The best average wins; mistakes (the
  second-best move) come in at the level's rate. Forced moves are played at once.
- **Bidding** ([bidding.ts](src/bidding.ts)): each candidate bid around the quick estimate is played
  out on sampled deals, the bot playing toward that bid, and scored. The scoring itself favours
  bids the bot can control.
- **The rollout policy** ([policy.ts](src/policy.ts)): a fast rule-of-thumb player for every seat
  of a simulation, in WIN mode (needs tricks) or DUCK mode (on or over its bid). It only looks at
  its own hand and what's public. Inside searches it never decides on its own.
- **The quick estimator** ([estimator.ts](src/estimator.ts)): roughly how many tricks a hand takes,
  calibrated per number of players and round size.

The rules the searches use ([rules.ts](src/rules.ts)) are the shared ones re-written on bitmasks
for speed. A test checks they agree with `@podrida/shared` on 20 000 random positions; scoring is
the shared function itself.

Every decision has a time budget (50 ms to 900 ms by level). The sample counts are sized to finish
well within it, so in practice decisions are reproducible: the same seed and game give the same
moves. If anything fails, the bot falls back to the rollout policy, then to a random legal card (or
its quick estimate for a bid), and says so in `stats.fallback`.

## Tests

`npm test -w @podrida/bots`:

- **rules**: every play rule in priority order, and agreement with the shared rules.
- **knowledge**: on real games, the true deal satisfies everything inferred after every move, and
  every sampled deal respects hand sizes, voids, ceilings and the stock.
- **games**: whole games at every level and player count: legal cards only (Lero aside), cards
  conserved, tricks adding up, the same seeds replaying the same game, the time budget kept.
- **scenarios**: positions with a known good move ([tests/scenarios](tests/scenarios)), each level
  listed for one has to find it in 80% of seeds. Add expert positions there as they come up.

## Tournaments

```sh
npm run tournament -- --a expert --b skilled [--players 4] [--deals 12] [--seed 1] [--workers N]
npm run tournament -- --a expert --b expert --tweak "searchType=ismcts,playSamples=200"
npm run tournament -- --calibrate --players 4
```

Duplicate format: each set of deals is replayed with the bots rotated through every seat, which
cancels most of the luck of the cards. It reports each side's mean game score, bid hit rate,
decision times and fallbacks, and A − B per game with a 95% interval. `--tweak` plays A's level with
some parameters changed against the current version: a change should never make that number
negative. `--calibrate` prints the quick estimate against the tricks actually won, by round size,
to refit the table in estimator.ts.

### Latest results

Duplicate tournaments, no time limit (`--deals` sets × every rotation). "Ahead" is the share of
games where the stronger level's seats averaged more points.

| Players | A vs B             | Games | A − B per game | A ahead | Bids hit (A / B) | A's decisions (mean / p95) |
| ------- | ------------------ | ----- | -------------- | ------- | ---------------- | -------------------------- |
| 4       | Beginner vs Lero   | 32    | +78.4 ± 17.1   | 97%     | 41% / 30%        | < 0.1 ms                   |
| 4       | Casual vs Beginner | 32    | +78.0 ± 16.5   | 94%     | 56% / 40%        | 0.6 / 2.5 ms               |
| 4       | Skilled vs Casual  | 32    | +27.0 ± 15.9   | 72%     | 61% / 55%        | 4.2 / 15 ms                |
| 4       | Expert vs Skilled  | 48    | +20.7 ± 12.8   | 75%     | 65% / 61%        | 65 / 250 ms                |
| 5       | Skilled vs Casual  | 30    | +37.2 ± 13.8   | 73%     | 67% / 55%        | 5.0 / 14 ms                |
| 3       | Expert vs Casual   | 18    | +139.2 ± 47.7  | 89%     | 57% / 40%        | 74 / 265 ms                |

What was tried on Expert (each against the then-current Expert, 32 to 80 games): no spoiler term
(−0.5 ± 15.0), three times the samples (−0.9 ± 13.0), a deeper exact endgame (−1.1 ± 8.9), and
ISMCTS with 12 000 iterations instead of PIMC (+4.4 ± 9.7, adopted). More samples not helping
points at the rollout policy as the limit: improving it sharpens every level that searches.
