import { botLimits, BotDifficulty } from "@podrida/shared";
import names from "./names.json";

// The bots' names: an editable list (names.json), one per difficulty plus a shared one any
// difficulty can use. Names are at most botLimits.nameMaxLength characters, so "Name (Bot)" fits
// in a seat (a test checks the file).
export const botNames = names as Record<BotDifficulty | "shared", string[]>;

const randomItem = <T>(items: T[], random: (max: number) => number) => items[random(items.length)];

// A name for a new bot, free in the room (compared without case against everyone there, people
// and bots): from its difficulty's list, else the shared list, else its list's names numbered
// ("Paco 2").
export const pickBotName = (
  difficulty: BotDifficulty,
  takenNames: Iterable<string>,
  random: (max: number) => number,
): string => {
  const taken = new Set([...takenNames].map((name) => name.toLocaleLowerCase()));
  const isFree = (name: string) => !taken.has(name.toLocaleLowerCase());
  const own = botNames[difficulty] ?? [];

  const free = own.filter(isFree);
  if (free.length > 0) return randomItem(free, random);

  const shared = botNames.shared.filter(isFree);
  if (shared.length > 0) return randomItem(shared, random);

  const base = own.length > 0 ? own : botNames.shared;
  for (let number = 2; ; number += 1) {
    const numbered = base
      .map(
        (name) => `${name.slice(0, botLimits.nameMaxLength - String(number).length - 1)} ${number}`,
      )
      .filter(isFree);
    if (numbered.length > 0) return randomItem(numbered, random);
  }
};
