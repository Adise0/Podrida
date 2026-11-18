import type { AdminGame } from "@podrida/shared";
import { GameDocument } from "../../../../database/models/Games";
import { getLiveConnections } from "../../../../realtime/games/gameManager";

// A game's record as admins see it, with who's connected while it's live.
const toAdminGame = (game: GameDocument): AdminGame => {
  const connections = getLiveConnections(game.id);

  return {
    id: game.id,
    roomName: game.roomName,
    hostId: game.host.toString(),
    players: game.players.map((player) => ({
      userId: player.user.toString(),
      username: player.username,
      kickedAt: player.kickedAt?.toISOString(),
      kickedBy: player.kickedBy?.toString(),
      total: player.total ?? 0,
      isConnected: connections?.[player.user.toString()],
    })),
    status: game.status,
    isLive: connections !== undefined,
    startedAt: game.startedAt.toISOString(),
    endedAt: game.endedAt?.toISOString(),
    endedBy: game.endedBy?.user
      ? { userId: game.endedBy.user.toString(), username: game.endedBy.username }
      : undefined,
  };
};

export default toAdminGame;
