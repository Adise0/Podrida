import { GameStatus } from "@podrida/shared";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { gameStatusLabels } from "../../lib/gameStatus";

const tones: Record<GameStatus, BadgeTone> = {
  [GameStatus.inProgress]: "success",
  [GameStatus.finished]: "neutral",
  [GameStatus.endedEarly]: "warning",
  [GameStatus.abandoned]: "neutral",
  [GameStatus.interrupted]: "danger",
};

// isLive is false for an in-progress record the server isn't running (it can't be ended anymore).
export function GameStatusBadge({ status, isLive }: { status: GameStatus; isLive: boolean }) {
  if (status === GameStatus.inProgress && !isLive) return <Badge $tone="danger">Not running</Badge>;
  return <Badge $tone={tones[status]}>{gameStatusLabels[status]}</Badge>;
}
