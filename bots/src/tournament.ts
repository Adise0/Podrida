// Bot-only tournaments, to check each level beats the one below it and that a change doesn't make
// a bot worse. Duplicate format, to cancel out the luck of the deal: every set of deals is played
// once per rotation of the seats, so each bot gets every seat's cards.
//
//   npm run tournament -- --a skilled --b casual [--players 4] [--deals 20] [--seed 1]
//                         [--workers 4] [--budget]
//   npm run tournament -- --calibrate [--players 4] [--deals 20]
//
// --a / --b: the two levels (or "lero"); seats alternate A, B, A, B... --budget keeps the time
// budget (otherwise every decision runs its full sample counts, reproducibly).
// --calibrate: Skilled bots only, printing actual tricks against the quick estimate by round size,
// to fit the estimator's calibration table.
import { availableParallelism } from "node:os";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { BotDifficulty } from "@podrida/shared";
import { toId } from "./cards";
import { difficulties, type DifficultyConfig } from "./difficulty";
import { estimateTricks } from "./estimator";
import { mixSeed } from "./rng";
import { playGame, type GameResult, type Seat } from "./tournament/referee";

interface Job {
  dealSeed: number;
  rotation: number;
  arrangement: BotDifficulty[]; // Per seat, before rotating.
  ignoreTimeBudget: boolean;
  calibrate: boolean;
  // Parameter changes for one side, to try a variant against the current version: the A seats
  // play as `variant` (see --tweak).
  variant?: Partial<DifficultyConfig>;
}

interface JobResult {
  job: Job;
  scores: Record<string, number>; // By group ("A" / "B"), summed over the seats in it.
  seatCounts: Record<string, number>;
  rounds: Record<string, { rounds: number; hits: number; over: number; under: number }>;
  decisions: Record<string, number[]>;
  fallbacks: number;
  calibration: { cardsPerPlayer: number; estimate: number; won: number }[];
  elapsedMs: number;
}

const levels: Record<string, BotDifficulty> = {
  lero: BotDifficulty.lero,
  beginner: BotDifficulty.beginner,
  casual: BotDifficulty.casual,
  skilled: BotDifficulty.skilled,
  expert: BotDifficulty.expert,
};

// A variant of A's level, registered under a level name of its own for the A seats.
const VARIANT = "VARIANT" as BotDifficulty;

const runJob = (job: Job): JobResult => {
  const started = performance.now();
  if (job.variant) {
    (difficulties as Record<string, DifficultyConfig>)[VARIANT] = {
      ...difficulties[job.arrangement[0] as keyof typeof difficulties],
      ...job.variant,
    };
  }
  const players = job.arrangement.length;
  const seats: Seat[] = job.arrangement.map((_, index) => {
    const source = (index + job.rotation) % players; // Rotated: seat k gets arrangement[k + r].
    return {
      id: `${source % 2 === 0 ? "A" : "B"}${source}`,
      difficulty: job.variant && source % 2 === 0 ? VARIANT : job.arrangement[source],
      seed: mixSeed(job.dealSeed, source, 77),
    };
  });
  const estimates = new Map<string, number>(); // By seat and round.

  const result: GameResult = playGame(seats, {
    dealSeed: job.dealSeed,
    ignoreTimeBudget: job.ignoreTimeBudget,
    onDecision: job.calibrate
      ? (seat, view, decision) => {
          if (decision.kind !== "bid") return;
          const hand = [0, 0, 0, 0] as [number, number, number, number];
          view.hand.forEach((card) => {
            const id = toId(card);
            hand[id >> 4] |= 1 << (id & 15);
          });
          estimates.set(
            `${seat.id}:${view.roundNumber}`,
            estimateTricks(hand, {
              trump: toId({ suit: view.trumpSuit, rank: 2 }) >> 4,
              players: view.seats.length,
              cardsPerPlayer: view.cardsPerPlayer,
              leads: view.leaderId === view.me,
              unseen: 52 - view.cardsPerPlayer - (view.trumpCard ? 1 : 0),
            }),
          );
        }
      : undefined,
  });

  const groupOf = (id: string) => id[0];
  const out: JobResult = {
    job,
    scores: {},
    seatCounts: {},
    rounds: {},
    decisions: {},
    fallbacks: 0,
    calibration: [],
    elapsedMs: performance.now() - started,
  };
  Object.entries(result.stats).forEach(([id, stats]) => {
    const group = groupOf(id);
    out.scores[group] = (out.scores[group] ?? 0) + stats.total;
    out.seatCounts[group] = (out.seatCounts[group] ?? 0) + 1;
    const rounds = (out.rounds[group] ??= { rounds: 0, hits: 0, over: 0, under: 0 });
    rounds.rounds += stats.rounds;
    rounds.hits += stats.hits;
    rounds.over += stats.over;
    rounds.under += stats.under;
    (out.decisions[group] ??= []).push(...stats.decisions);
    out.fallbacks += stats.fallbacks;
  });

  if (job.calibrate) {
    Object.entries(result.stats).forEach(([id, stats]) => {
      stats.rows.forEach((row, round) => {
        out.calibration.push({
          cardsPerPlayer: row.cardsPerPlayer,
          estimate: estimates.get(`${id}:${round + 1}`) ?? 0,
          won: row.won,
        });
      });
    });
  }
  return out;
};

if (!isMainThread) {
  parentPort?.on("message", (job: Job) => parentPort?.postMessage(runJob(job)));
} else {
  const args = process.argv.slice(2);
  const option = (name: string, fallback: string) => {
    const index = args.indexOf(`--${name}`);
    return index === -1 ? fallback : (args[index + 1] ?? fallback);
  };
  const flag = (name: string) => args.includes(`--${name}`);

  const calibrate = flag("calibrate");
  const players = Number(option("players", "4"));
  const deals = Number(option("deals", calibrate ? "10" : "12"));
  const seed = Number(option("seed", "1"));
  const workers = Number(option("workers", String(Math.max(1, availableParallelism() - 1))));
  const a = levels[option("a", "skilled")];
  const b = levels[option("b", "casual")];
  if (!a || !b) throw new Error("Unknown level");
  // --tweak "spoiler=0,playSamples=300": A plays its level with these parameters changed.
  const tweak = option("tweak", "");
  const variant = tweak
    ? (Object.fromEntries(
        tweak.split(",").map((pair) => {
          const [key, value] = pair.split("=");
          const parsed = value === "true" ? true : value === "false" ? false : Number(value);
          return [key.trim(), Number.isNaN(parsed) ? value : parsed];
        }),
      ) as Partial<DifficultyConfig>)
    : undefined;

  const arrangement = Array.from({ length: players }, (_, index) =>
    calibrate ? BotDifficulty.skilled : index % 2 === 0 ? a : b,
  );
  const jobs: Job[] = [];
  for (let deal = 0; deal < deals; deal++) {
    for (let rotation = 0; rotation < players; rotation++) {
      jobs.push({
        dealSeed: mixSeed(seed, deal),
        rotation,
        arrangement,
        ignoreTimeBudget: !flag("budget"),
        calibrate,
        variant,
      });
    }
  }

  const results: JobResult[] = [];
  const started = performance.now();
  const pool = Array.from({ length: Math.min(workers, jobs.length) }, () => new Worker(__filename));
  let next = 0;

  const report = () => {
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    if (calibrate) {
      const buckets = new Map<number, { estimate: number; won: number; count: number }>();
      results
        .flatMap((result) => result.calibration)
        .forEach(({ cardsPerPlayer, estimate, won }) => {
          const bucket = buckets.get(Math.min(6, cardsPerPlayer)) ?? {
            estimate: 0,
            won: 0,
            count: 0,
          };
          bucket.estimate += estimate;
          bucket.won += won;
          bucket.count++;
          buckets.set(Math.min(6, cardsPerPlayer), bucket);
        });
      console.log(`Calibration, ${players} players, ${results.length} games (${seconds}s)`);
      [...buckets.entries()]
        .sort(([x], [y]) => x - y)
        .forEach(([cards, bucket]) => {
          console.log(
            `  ${cards === 6 ? "6+" : cards} cards: estimate ${(bucket.estimate / bucket.count).toFixed(2)}  actual ${(bucket.won / bucket.count).toFixed(2)}  scale ${(bucket.won / bucket.estimate).toFixed(2)}`,
          );
        });
      return;
    }

    // Per game: the mean score of A's seats minus B's. Duplicate: each deal set's rotations together.
    const diffs = results.map(
      (result) => result.scores.A / result.seatCounts.A - result.scores.B / result.seatCounts.B,
    );
    const mean = diffs.reduce((sum, value) => sum + value, 0) / diffs.length;
    const variance =
      diffs.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, diffs.length - 1);
    const interval = 1.96 * Math.sqrt(variance / diffs.length);
    const wins = diffs.filter((value) => value > 0).length;

    const describe = (group: string, level: BotDifficulty) => {
      const rounds = results.reduce(
        (total, result) => {
          const value = result.rounds[group];
          return {
            rounds: total.rounds + value.rounds,
            hits: total.hits + value.hits,
            over: total.over + value.over,
            under: total.under + value.under,
          };
        },
        { rounds: 0, hits: 0, over: 0, under: 0 },
      );
      const times = results.flatMap((result) => result.decisions[group]).sort((x, y) => x - y);
      const meanScore =
        results.reduce((sum, result) => sum + result.scores[group] / result.seatCounts[group], 0) /
        results.length;
      const percent = (value: number) => `${((100 * value) / rounds.rounds).toFixed(1)}%`;
      console.log(
        `  ${group} ${level.padEnd(8)} game score ${meanScore.toFixed(1).padStart(6)}  round ${(meanScore / (rounds.rounds / results.length / (results[0].seatCounts[group] ?? 1))).toFixed(2).padStart(6)}  bids hit ${percent(rounds.hits)}  over ${percent(rounds.over)}  under ${percent(rounds.under)}  decision ${(times.reduce((s, t) => s + t, 0) / times.length).toFixed(1)}ms  p95 ${times[Math.floor(times.length * 0.95)]?.toFixed(1)}ms`,
      );
    };

    console.log(
      `${players} players, ${deals} deal sets × ${players} rotations = ${results.length} games (${seconds}s)`,
    );
    describe("A", a);
    if (variant) console.log(`    (A with ${tweak})`);
    describe("B", b);
    console.log(
      `  A − B per game: ${mean.toFixed(1)} ± ${interval.toFixed(1)} (95%)   A ahead in ${((100 * wins) / diffs.length).toFixed(0)}% of games   fallbacks ${results.reduce((sum, result) => sum + result.fallbacks, 0)}`,
    );
  };

  pool.forEach((worker) => {
    const feed = () => {
      if (next >= jobs.length) {
        worker.terminate();
        return;
      }
      worker.postMessage(jobs[next++]);
    };
    worker.on("message", (result: JobResult) => {
      results.push(result);
      if (results.length === jobs.length) report();
      feed();
    });
    worker.on("error", (error) => {
      console.error(error);
      process.exit(1);
    });
    feed();
  });
}
