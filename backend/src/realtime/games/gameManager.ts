import {
  GameStatus,
  PodridaPhase,
  roundSchedule,
  type Card,
  type Game,
  type PodridaRoundRecord,
} from "@podrida/shared";
import { gameAbandonAfterSeconds, gameTimings } from "../../data/serverConfig/server-config";
import {
  getCannotKickYourselfError,
  getGameNotFoundError,
  getNotGameHostError,
  getNotInGameError,
  getPlayerNotInGameError,
} from "../../data/errorObjects/roomErrors";
import Games from "../../database/models/Games";
import logger from "../../server/utils/logger";
import { liveCounts } from "../../server/utils/metrics";
import { sendToUser } from "../connections";
import SocketClient from "../SocketClient";
import PodridaMatch, { type RoundLog } from "./PodridaMatch";

// Games being played. Each one is stored (models/Games) the moment it starts, and played here, in
// memory: the PodridaMatch on each LiveGame has the rules and the cards, this file drives it (the
// pace between phases, the kicked seats that play themselves) and tells the players.
//
// Players can't leave: a game runs until its last round, or the host or an admin ends it, or
// nobody has been at the table for gameAbandonAfterSeconds. The host and admins can kick players;
// a kicked player's seat stays, and plays itself (it bids 0 and plays its lowest card).
//
// A player is connected to the game while one of their connections is attached to it (they have
// the game page open). Leaving the page detaches it: they show as away, and the game waits for
// them on their turn.
//
// Everything that checks state and then changes it does so without an await in between, so two
// requests can't both pass the same check. The stored record follows right after.

interface LivePlayer {
  userId: string;
  username: string;
  avatarUrl?: string;
  isKicked: boolean;
}

interface LiveGame {
  id: string;
  roomName: string;
  hostId: string;
  players: Map<string, LivePlayer>; // In seat order.
  startedAt: Date;
  match: PodridaMatch;
  viewers: Map<string, Set<SocketClient>>; // The connections attached to it, by player.
  phaseTimer?: NodeJS.Timeout;
  moveTimer?: NodeJS.Timeout;
  abandonTimer?: NodeJS.Timeout;
}

// Who ended a game or kicked a player: its host, or an admin.
export interface GameActor {
  userId: string;
  username: string;
}

const games = new Map<string, LiveGame>();
const gameIdByUser = new Map<string, string>(); // Only players who haven't been kicked.
const gameIdByClient = new Map<SocketClient, string>(); // The attached connections.

liveCounts.games = () => games.size;

const activePlayerIds = (game: LiveGame) =>
  [...game.players.values()].filter((player) => !player.isKicked).map((player) => player.userId);

const isAtTable = (game: LiveGame, userId: string) => (game.viewers.get(userId)?.size ?? 0) > 0;

const toGame = (game: LiveGame, viewerId: string): Game => ({
  id: game.id,
  roomName: game.roomName,
  hostId: game.hostId,
  players: [...game.players.values()].map((player) => ({
    userId: player.userId,
    username: player.username,
    avatarUrl: player.avatarUrl,
    isConnected: isAtTable(game, player.userId),
    isKicked: player.isKicked,
  })),
  status: GameStatus.inProgress,
  startedAt: game.startedAt.toISOString(),
  state: game.match.viewFor(viewerId),
});

// Everyone gets their own view: their hand, and only how many cards the others hold.
const publishGame = (game: LiveGame) => {
  activePlayerIds(game).forEach((userId) =>
    sendToUser(userId, "game:updated", { game: toGame(game, userId) }),
  );
};

const clearTimers = (game: LiveGame) => {
  clearTimeout(game.phaseTimer);
  clearTimeout(game.moveTimer);
  clearTimeout(game.abandonTimer);
};

const endGame = async (gameId: string, status: GameStatus, endedBy?: GameActor) => {
  const game = games.get(gameId);

  if (!game) {
    return;
  }

  clearTimers(game);

  const playerIds = activePlayerIds(game);
  games.delete(game.id);
  playerIds.forEach((userId) => gameIdByUser.delete(userId));
  game.viewers.forEach((clients) => clients.forEach((client) => gameIdByClient.delete(client)));
  playerIds.forEach((userId) => sendToUser(userId, "game:ended", { gameId: game.id, status }));

  // The live game is gone either way: a failed write only leaves the record behind.
  try {
    await Games.updateOne(
      { _id: game.id },
      {
        $set: {
          status,
          endedAt: new Date(),
          ...(endedBy && { endedBy: { user: endedBy.userId, username: endedBy.username } }),
        },
      },
    );
  } catch (error) {
    logger.error({ err: error, gameId: game.id }, "Couldn't store the end of a game");
  }
};

// Nobody at the table: the game waits gameAbandonAfterSeconds for someone, then it's abandoned.
const checkAbandonment = (gameId: string) => {
  const game = games.get(gameId);

  if (!game) {
    return;
  }

  const isAnyoneThere = activePlayerIds(game).some((userId) => isAtTable(game, userId));

  if (isAnyoneThere) {
    clearTimeout(game.abandonTimer);
    game.abandonTimer = undefined;
    return;
  }

  if (!game.abandonTimer) {
    game.abandonTimer = setTimeout(() => {
      endGame(game.id, GameStatus.abandoned);
    }, gameAbandonAfterSeconds * 1000);
    game.abandonTimer.unref();
  }
};

const storeCard = ({ suit, rank }: Card) => ({ suit, rank });

const storeRound = async (gameId: string, record: PodridaRoundRecord, log: RoundLog) => {
  try {
    await Games.updateOne(
      { _id: gameId },
      {
        $push: {
          rounds: {
            number: record.number,
            cardsPerPlayer: record.cardsPerPlayer,
            trumpSuit: record.trumpSuit,
            dealer: record.dealerId,
            results: record.results.map(({ userId, bid, won, points, total }) => ({
              user: userId,
              bid,
              won,
              points,
              total,
            })),
            trumpCard: log.trumpCard ? storeCard(log.trumpCard) : null,
            hands: log.hands.map(({ userId, cards }) => ({
              user: userId,
              cards: cards.map(storeCard),
            })),
            tricks: log.tricks.map(({ leaderId, cards, winnerId }) => ({
              leader: leaderId,
              winner: winnerId,
              cards: cards.map(({ userId, card }) => ({ user: userId, ...storeCard(card) })),
            })),
          },
        },
        // The players are stored in seat order, like the results.
        $set: Object.fromEntries(
          record.results.map(({ total }, seat) => [`players.${seat}.total`, total]),
        ),
      },
    );
  } catch (error) {
    logger.error({ err: error, gameId }, "Couldn't store a round");
  }
};

const dealingDuration = (cardsPerPlayer: number) =>
  Math.min(
    gameTimings.dealingMaxMs,
    gameTimings.dealingBaseMs + cardsPerPlayer * gameTimings.dealingPerCardMs,
  );

// Moves the game on after every change: starts the timer of a timed phase, has a kicked seat play,
// and tells everyone.
const advance = (gameId: string) => {
  const game = games.get(gameId);

  if (!game) {
    return;
  }

  const { match } = game;
  clearTimeout(game.phaseTimer);
  clearTimeout(game.moveTimer);
  match.phaseEndsAt = null;

  const after = (milliseconds: number, next: () => void) => {
    match.phaseEndsAt = Date.now() + milliseconds;
    game.phaseTimer = setTimeout(() => {
      try {
        next();
      } catch (error) {
        logger.error({ err: error, gameId }, "A game couldn't move on");
      }
    }, milliseconds);
    game.phaseTimer.unref();
  };

  switch (match.phase) {
    case PodridaPhase.dealing:
      after(dealingDuration(match.cardsPerPlayer), () => {
        match.beginBidding();
        advance(gameId);
      });
      break;

    case PodridaPhase.trickEnd:
      after(gameTimings.trickEndMs, () => {
        const finished = match.finishTrick();
        advance(gameId);
        if (finished) storeRound(gameId, finished.record, finished.log);
      });
      break;

    case PodridaPhase.scoring:
      after(gameTimings.roundSummaryMs, () => {
        match.nextRound();
        advance(gameId);
      });
      break;

    case PodridaPhase.finished:
      publishGame(game); // The final scores, then it's over.
      endGame(gameId, GameStatus.finished);
      return;

    default:
      break;
  }

  // A kicked player's seat plays itself.
  const { turnId } = match;

  if (turnId && game.players.get(turnId)?.isKicked) {
    game.moveTimer = setTimeout(() => {
      try {
        const move = match.automaticMove();
        if ("bid" in move) match.bid(turnId, move.bid);
        else match.play(turnId, move.card);
        advance(gameId);
      } catch (error) {
        logger.error({ err: error, gameId }, "A kicked seat couldn't play");
      }
    }, gameTimings.automaticMoveMs);
    game.moveTimer.unref();
  }

  publishGame(game);
};

const getLiveGame = (gameId: string) => {
  const game = games.get(gameId);

  if (!game) {
    throw getGameNotFoundError();
  }

  return game;
};

// The game the user is playing (not kicked from).
const getGameOfUser = (userId: string) => {
  const gameId = gameIdByUser.get(userId);
  const game = gameId ? games.get(gameId) : undefined;

  if (!game) {
    throw getNotInGameError();
  }

  return game;
};

const getHostedGame = (userId: string) => {
  const game = getGameOfUser(userId);

  if (game.hostId !== userId) {
    throw getNotGameHostError();
  }

  return game;
};

export const getGameIdOfUser = (userId: string) => gameIdByUser.get(userId);

// Whether each player of a live game is at the table, for the admin pages. undefined when it
// isn't live.
export const getLiveConnections = (gameId: string): Record<string, boolean> | undefined => {
  const game = games.get(gameId);

  return game
    ? Object.fromEntries(
        [...game.players.keys()].map((userId) => [userId, isAtTable(game, userId)]),
      )
    : undefined;
};

export interface NewGame {
  roomName: string;
  hostId: string;
  players: Omit<LivePlayer, "isKicked">[];
}

// Stores the game, then deals its first round. Whoever calls it makes sure the players are free.
export const createGame = async ({ roomName, hostId, players }: NewGame): Promise<string> => {
  const startedAt = new Date();
  const record = await Games.create({
    roomName,
    host: hostId,
    players: players.map(({ userId, username }) => ({ user: userId, username })),
    status: GameStatus.inProgress,
    startedAt,
    roundCount: roundSchedule(players.length).length,
  });

  const game: LiveGame = {
    id: record.id,
    roomName,
    hostId,
    players: new Map(players.map((player) => [player.userId, { ...player, isKicked: false }])),
    startedAt,
    match: new PodridaMatch(players.map((player) => player.userId)),
    viewers: new Map(),
  };

  games.set(game.id, game);
  players.forEach(({ userId }) => gameIdByUser.set(userId, game.id));
  advance(game.id);
  checkAbandonment(game.id);

  return game.id;
};

// A connection leaves the table it was attached to (another page, or it closed).
export const detachClient = (client: SocketClient) => {
  const gameId = gameIdByClient.get(client);
  gameIdByClient.delete(client);
  const game = gameId ? games.get(gameId) : undefined;
  const userId = client.userId as string;
  const clients = game?.viewers.get(userId);

  if (!game || !clients) {
    return;
  }

  clients.delete(client);

  if (clients.size === 0) {
    game.viewers.delete(userId);
    publishGame(game);
    checkAbandonment(game.id);
  }
};

// A player's connection sits down at the table: it gets the game, and the player shows as there.
export const attachToGame = (client: SocketClient, gameId: string): Game => {
  const userId = client.userId as string;
  const game = getLiveGame(gameId);
  const player = game.players.get(userId);

  if (!player || player.isKicked) {
    throw getNotInGameError();
  }

  if (gameIdByClient.get(client) !== gameId) {
    detachClient(client);
    gameIdByClient.set(client, gameId);
  }

  const clients = game.viewers.get(userId) ?? new Set<SocketClient>();
  const wasAway = clients.size === 0;
  clients.add(client);
  game.viewers.set(userId, clients);

  if (wasAway) {
    publishGame(game);
    checkAbandonment(game.id);
  }

  return toGame(game, userId);
};

export const bidInGame = (userId: string, bid: number) => {
  const game = getGameOfUser(userId);
  game.match.bid(userId, bid);
  advance(game.id);
};

export const playInGame = (userId: string, card: Card) => {
  const game = getGameOfUser(userId);
  game.match.play(userId, card);
  advance(game.id);
};

// Ends a live game before its natural end. By its host or an admin.
export const endGameEarly = (gameId: string, by: GameActor) =>
  endGame(getLiveGame(gameId).id, GameStatus.endedEarly, by);

// Takes a player out of a live game: their seat stays and plays itself. If it was the host (only
// an admin can do that), the host passes to the next player still in it, and a game with nobody
// left in it ends.
export const kickPlayer = async (gameId: string, userId: string, by: GameActor) => {
  const game = getLiveGame(gameId);
  const player = game.players.get(userId);

  if (!player || player.isKicked) {
    throw getPlayerNotInGameError();
  }

  player.isKicked = true;
  gameIdByUser.delete(userId);
  game.viewers.get(userId)?.forEach((client) => gameIdByClient.delete(client));
  game.viewers.delete(userId);
  sendToUser(userId, "game:kicked", { gameId: game.id });

  const remaining = activePlayerIds(game);
  const hostChanged = game.hostId === userId && remaining.length > 0;

  if (hostChanged) {
    [game.hostId] = remaining;
  }

  if (remaining.length > 0) {
    advance(game.id); // Their turn, if it was, now plays itself.
    checkAbandonment(game.id);
  }

  await Games.updateOne(
    { _id: game.id, "players.user": userId },
    {
      $set: {
        "players.$.kickedAt": new Date(),
        "players.$.kickedBy": by.userId,
        ...(hostChanged && { host: game.hostId }),
      },
    },
  );

  if (remaining.length === 0) {
    await endGame(game.id, GameStatus.endedEarly, by);
  }
};

// The host's own controls, over the realtime connection.
export const endGameAsHost = (userId: string) => {
  const game = getHostedGame(userId);
  const host = game.players.get(userId) as LivePlayer;
  return endGameEarly(game.id, { userId, username: host.username });
};

export const kickPlayerAsHost = (userId: string, targetUserId: string) => {
  const game = getHostedGame(userId);

  if (targetUserId === userId) {
    throw getCannotKickYourselfError();
  }

  const host = game.players.get(userId) as LivePlayer;
  return kickPlayer(game.id, targetUserId, { userId, username: host.username });
};

// Live games don't survive a restart: the ones still marked as running were cut short. Call it once
// at startup, before taking connections. (Their rounds so far are kept in the record.)
export const interruptStaleGames = async () => {
  const { modifiedCount } = await Games.updateMany(
    { status: GameStatus.inProgress },
    { $set: { status: GameStatus.interrupted, endedAt: new Date() } },
  );

  if (modifiedCount > 0) {
    logger.warn(`${modifiedCount} game(s) were still running at shutdown, marked as interrupted`);
  }
};

// Tests only: the live match, to look at the hands.
export const getMatchForTests = (gameId: string) => games.get(gameId)?.match;

// Tests only: forgets every live game.
export const resetLiveGames = () => {
  games.forEach(clearTimers);
  games.clear();
  gameIdByUser.clear();
  gameIdByClient.clear();
};
