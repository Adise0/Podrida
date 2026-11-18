import type { FinishedGameDetails, FinishedGameSummary } from "@podrida/shared";
import { GameDocument } from "../../../database/models/Games";
import Users from "../../../database/models/Users";
import { getAvatarUrl } from "../../utils/users/avatar";

// The current avatars of everyone in these games, by user id. The usernames are the record's own,
// as they were when the game was played.
export const getAvatarUrls = async (games: GameDocument[]) => {
  const userIds = [...new Set(games.flatMap((game) => game.players.map(({ user }) => user)))];
  const users = await Users.find({ _id: { $in: userIds } }).select("avatar");
  return new Map(users.map((user) => [user.id, getAvatarUrl(user.id, user.avatar)]));
};

export const toFinishedGameSummary = (
  game: GameDocument,
  avatarUrls: Map<string, string | undefined>,
): FinishedGameSummary => {
  const best = Math.max(...game.players.map(({ total }) => total ?? 0));

  return {
    id: game.id,
    roomName: game.roomName,
    startedAt: game.startedAt.toISOString(),
    endedAt: (game.endedAt ?? game.updatedAt).toISOString(),
    players: game.players.map((player) => ({
      userId: player.user.toString(),
      username: player.username,
      avatarUrl: avatarUrls.get(player.user.toString()),
      total: player.total ?? 0,
      isWinner: (player.total ?? 0) === best, // No tie-breaker: a tie shares the win.
      wasKicked: Boolean(player.kickedAt),
    })),
  };
};

export const toFinishedGameDetails = (
  game: GameDocument,
  avatarUrls: Map<string, string | undefined>,
): FinishedGameDetails => ({
  ...toFinishedGameSummary(game, avatarUrls),
  hostId: game.host.toString(),
  roundCount: game.roundCount,
  rounds: game.rounds.map((round) => ({
    number: round.number,
    cardsPerPlayer: round.cardsPerPlayer,
    trumpSuit: round.trumpSuit,
    dealerId: round.dealer.toString(),
    results: round.results.map((result) => ({
      userId: result.user.toString(),
      bid: result.bid,
      won: result.won,
      points: result.points,
      total: result.total,
    })),
  })),
});
