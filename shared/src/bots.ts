// Computer players. The host adds them to a room before the game starts; they play by exactly the
// same rules as everyone else (except Lero, see below), and only know what a person in their seat
// would know. The bots themselves are the @podrida/bots package, run by the backend.

// Strongest last. Lero isn't a strength: it doesn't know the rules at all.
export enum BotDifficulty {
  lero = "LERO", // Bids at random, plays its cards in the order they were dealt, legal or not.
  beginner = "BEGINNER",
  casual = "CASUAL",
  skilled = "SKILLED",
  expert = "EXPERT",
}

export const botDifficulties: BotDifficulty[] = [
  BotDifficulty.lero,
  BotDifficulty.beginner,
  BotDifficulty.casual,
  BotDifficulty.skilled,
  BotDifficulty.expert,
];

export const botDifficultyLabels: Record<BotDifficulty, string> = {
  [BotDifficulty.lero]: "Lero",
  [BotDifficulty.beginner]: "Beginner",
  [BotDifficulty.casual]: "Casual",
  [BotDifficulty.skilled]: "Skilled",
  [BotDifficulty.expert]: "Expert",
};

export const botDifficultyDescriptions: Record<BotDifficulty, string> = {
  [BotDifficulty.lero]: "Doesn't know the rules. Plays whatever comes next.",
  [BotDifficulty.beginner]: "Plays by instinct and makes mistakes.",
  [BotDifficulty.casual]: "Plays sensibly, sometimes slips.",
  [BotDifficulty.skilled]: "Counts cards and reads the table.",
  [BotDifficulty.expert]: "Plays to win. Rarely misses a bid.",
};

// What a seat taken from a kicked player plays as.
export const kickedSeatBotDifficulty = BotDifficulty.casual;

export const botLimits = <const>{
  nameMaxLength: 12, // So "Name (Bot)" fits in a seat.
};

// The room's settings, chosen by the host before the game starts and kept for the whole game.
export interface RoomSettings {
  // The bots wait between half this and this long before each move (a forced one: a quarter), so
  // the table can follow. A strong bot still thinking after that takes as long as it needs (under
  // a second).
  botThinkingMaxMs: number;
}

export const roomSettingsLimits = <const>{
  botThinkingMaxMs: { min: 0, max: 5000, step: 250, default: 2000 },
};

export const defaultRoomSettings: RoomSettings = {
  botThinkingMaxMs: roomSettingsLimits.botThinkingMaxMs.default,
};
