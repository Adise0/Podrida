// @podrida/bots: the computer players. See the README for how they think.
//
// decide() is pure computation (no I/O, no clock besides the time budget): the backend runs it in
// worker threads (BotPool), the tournament runner and the tests call it directly.
export { decide } from "./decide";
export { BotPool, type BotPoolOptions } from "./pool";
export { difficulties, difficultyConfig, type DifficultyConfig } from "./difficulty";
export type {
  BotDecision,
  BotDecisionKind,
  BotDecisionStats,
  BotRequest,
  BotTrick,
  BotView,
} from "./view";
