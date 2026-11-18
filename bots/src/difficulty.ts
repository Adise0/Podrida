// The difficulty levels: one set of parameters each, not different behaviours (Lero aside, which
// has no strategy at all, see lero.ts). All of them are fair: no level sees hidden cards.
//
// Starting points from the design guide, tuned with tournaments (npm run tournament, see
// tournament.ts and the README).
import { BotDifficulty } from "@podrida/shared";

export type SearchType = "none" | "pimc" | "ismcts";

export interface DifficultyConfig {
  searchType: SearchType;
  playSamples: number; // Deals sampled for each card decision (PIMC).
  playRollouts: number; // Rollouts per move and sample (PIMC).
  ismctsIterations: number; // ISMCTS only.
  bidSamples: number; // 0: the quick estimate alone.
  bidRollouts: number; // Per candidate bid and sample.
  voidInference: boolean;
  ceilingInference: boolean;
  bidWeight: number; // λ: how much opponents' bids weigh the sampled deals. 0 ignores them.
  endgameSolver: boolean;
  endgameThreshold: number; // Cards left in all hands at which the endgame is solved exactly.
  endgameNodeLimit: number; // Per sampled deal; past it the decision falls back to rollouts.
  spoiler: number; // κ: how much opponents' round scores count against the bot's own.
  bidNoise: number; // Chance of moving the chosen bid by ±1.
  playMistakes: number; // Chance of a mistake on an unforced card.
  mistakeType: "random" | "secondBest";
  rolloutRandomness: number; // ε: chance a simulated player plays a random legal card.
  timeBudgetMs: number; // Per decision. The best move found so far is played once it runs out.
}

const base: DifficultyConfig = {
  searchType: "none",
  playSamples: 0,
  playRollouts: 0,
  ismctsIterations: 0,
  bidSamples: 0,
  bidRollouts: 0,
  voidInference: false,
  ceilingInference: false,
  bidWeight: 0,
  endgameSolver: false,
  endgameThreshold: 12,
  endgameNodeLimit: 60_000,
  spoiler: 0,
  bidNoise: 0,
  playMistakes: 0,
  mistakeType: "secondBest",
  rolloutRandomness: 0.1,
  timeBudgetMs: 50,
};

export const difficulties: Record<Exclude<BotDifficulty, BotDifficulty.lero>, DifficultyConfig> = {
  [BotDifficulty.beginner]: {
    ...base,
    bidNoise: 0.4,
    playMistakes: 0.15,
    mistakeType: "random",
    timeBudgetMs: 50,
  },
  [BotDifficulty.casual]: {
    ...base,
    searchType: "pimc",
    playSamples: 12,
    playRollouts: 1,
    bidSamples: 20,
    bidRollouts: 1,
    voidInference: true,
    bidNoise: 0.2,
    playMistakes: 0.07,
    timeBudgetMs: 150,
  },
  [BotDifficulty.skilled]: {
    ...base,
    searchType: "pimc",
    playSamples: 40,
    playRollouts: 2,
    bidSamples: 60,
    bidRollouts: 2,
    voidInference: true,
    ceilingInference: true,
    bidWeight: 0.3,
    endgameSolver: true,
    bidNoise: 0.05,
    playMistakes: 0.02,
    timeBudgetMs: 400,
  },
  // ISMCTS measured slightly ahead of PIMC with the same samples (tournaments, see the README).
  [BotDifficulty.expert]: {
    ...base,
    searchType: "ismcts",
    playSamples: 100,
    playRollouts: 2,
    ismctsIterations: 12000,
    bidSamples: 150,
    bidRollouts: 2,
    voidInference: true,
    ceilingInference: true,
    bidWeight: 0.6,
    endgameSolver: true,
    endgameThreshold: 14,
    spoiler: 0.3,
    timeBudgetMs: 900,
  },
};

export const difficultyConfig = (difficulty: BotDifficulty): DifficultyConfig => {
  if (difficulty === BotDifficulty.lero) {
    throw new Error("Lero has no difficulty parameters");
  }
  return difficulties[difficulty];
};
