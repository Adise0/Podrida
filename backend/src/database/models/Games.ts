import {
  BotDifficulty,
  defaultRoomSettings,
  GameStatus,
  ranks,
  suits,
  type Rank,
  type RoomSettings,
  type Suit,
} from "@podrida/shared";
import { HydratedDocument, model, Schema, Types } from "mongoose";

// Ids in the record (players, dealers, trick cards...) are user ids, or a bot's own id: an
// ObjectId too, but with no account behind it (see players[].bot).

// The stored record of a game. A room only gets one when it starts: until then it only lives in
// memory (see realtime/rooms). The game itself is played live in memory too (realtime/games), this
// is what outlasts it: who played, every round's bids and scores, and how it ended.
export interface StoredCard {
  suit: Suit;
  rank: Rank;
}

export interface DatabaseGameData {
  roomName: string;
  host: Types.ObjectId;
  // Who sat down when it started. The username is a copy, the account may change or go. Kicked
  // players stay listed, with when and by whom (the host or an admin), and the bot that played
  // their seat from then on. Bots have an id of their own (no account), their difficulty, and
  // the seed of their randomness (so a reported odd play can be replayed).
  players: {
    user: Types.ObjectId;
    username: string;
    bot?: { difficulty: BotDifficulty; seed: number };
    kickedAt?: Date;
    kickedBy?: Types.ObjectId;
    takenOverBy?: BotDifficulty;
    total: number; // Points so far, the final score once it's over.
  }[];
  settings: RoomSettings;
  // Every finished round, as it's scored, with enough to replay it: the hands as dealt, the trump
  // card (none in full-deck rounds), and every trick card by card.
  rounds: {
    number: number;
    cardsPerPlayer: number;
    trumpSuit: Suit;
    trumpCard: StoredCard | null;
    dealer: Types.ObjectId;
    results: { user: Types.ObjectId; bid: number; won: number; points: number; total: number }[];
    hands: { user: Types.ObjectId; cards: StoredCard[] }[]; // In seat order, cards as dealt.
    tricks: {
      leader: Types.ObjectId;
      winner: Types.ObjectId;
      cards: (StoredCard & { user: Types.ObjectId })[]; // In play order.
    }[];
  }[];
  roundCount: number;
  status: GameStatus;
  startedAt: Date;
  endedAt?: Date;
  // Who ended it early (status ENDED_EARLY): the host or an admin. The username is a copy.
  endedBy?: { user: Types.ObjectId; username: string };
  createdAt: Date;
  updatedAt: Date;
}

export type GameDocument = HydratedDocument<DatabaseGameData>;

const card = {
  suit: { type: String, enum: suits, required: true },
  rank: { type: Number, enum: ranks, required: true },
};

const CardSchema = new Schema(card, { _id: false });

const GameSchema = new Schema<DatabaseGameData>(
  {
    roomName: { type: String, required: true },
    host: { type: Schema.Types.ObjectId, ref: "Users", required: true },
    players: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: "Users", required: true },
        username: { type: String, required: true },
        bot: {
          type: new Schema(
            {
              difficulty: { type: String, enum: Object.values(BotDifficulty), required: true },
              seed: { type: Number, required: true },
            },
            { _id: false },
          ),
          default: undefined,
        },
        kickedAt: Date,
        kickedBy: { type: Schema.Types.ObjectId, ref: "Users" },
        takenOverBy: { type: String, enum: Object.values(BotDifficulty) },
        total: { type: Number, default: 0 },
      },
    ],
    rounds: [
      {
        _id: false,
        number: { type: Number, required: true },
        cardsPerPlayer: { type: Number, required: true },
        trumpSuit: { type: String, enum: suits, required: true },
        trumpCard: { type: CardSchema, default: null },
        dealer: { type: Schema.Types.ObjectId, ref: "Users", required: true },
        results: [
          {
            _id: false,
            user: { type: Schema.Types.ObjectId, ref: "Users", required: true },
            bid: { type: Number, required: true },
            won: { type: Number, required: true },
            points: { type: Number, required: true },
            total: { type: Number, required: true },
          },
        ],
        hands: [
          {
            _id: false,
            user: { type: Schema.Types.ObjectId, ref: "Users", required: true },
            cards: [CardSchema],
          },
        ],
        tricks: [
          {
            _id: false,
            leader: { type: Schema.Types.ObjectId, ref: "Users", required: true },
            winner: { type: Schema.Types.ObjectId, ref: "Users", required: true },
            cards: [
              new Schema(
                { ...card, user: { type: Schema.Types.ObjectId, ref: "Users", required: true } },
                { _id: false },
              ),
            ],
          },
        ],
      },
    ],
    // Games stored before there were settings get the defaults.
    settings: {
      _id: false,
      botThinkingMaxMs: { type: Number, default: defaultRoomSettings.botThinkingMaxMs },
    },
    roundCount: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(GameStatus),
      default: GameStatus.inProgress,
    },
    startedAt: { type: Date, required: true },
    endedAt: Date,
    endedBy: {
      _id: false,
      user: { type: Schema.Types.ObjectId, ref: "Users" },
      username: String,
    },
  },
  { timestamps: true },
);

// A player's games, newest first.
GameSchema.index({ "players.user": 1, startedAt: -1 });
// Finding the games still marked as running (eg. after a restart).
GameSchema.index({ status: 1 });

const Games = model<DatabaseGameData>("Games", GameSchema, "games");

export default Games;
