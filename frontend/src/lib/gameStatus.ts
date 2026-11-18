import { GameStatus } from "@podrida/shared";

export const gameStatusLabels: Record<GameStatus, string> = {
  [GameStatus.inProgress]: "In progress",
  [GameStatus.finished]: "Finished",
  [GameStatus.endedEarly]: "Ended early",
  [GameStatus.abandoned]: "Abandoned",
  [GameStatus.interrupted]: "Interrupted",
};
