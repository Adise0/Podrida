// Seeded randomness, so a bot given the same seed and the same game makes the same decisions (an
// odd play reported by a player can be replayed). sfc32, seeded through splitmix32.

export interface Rng {
  next(): number; // [0, 1)
  int(max: number): number; // [0, max)
}

const splitmix32 = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
    value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
    return (value ^ (value >>> 16)) >>> 0;
  };
};

export const createRng = (seed: number): Rng => {
  const mix = splitmix32(seed);
  let a = mix();
  let b = mix();
  let c = mix();
  let d = mix();

  const next = () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };

  return { next, int: (max) => Math.floor(next() * max) };
};

// One seed from several numbers (a bot's seed, the round, the trick...).
export const mixSeed = (...values: number[]) => {
  let hash = 0x811c9dc5;
  for (const value of values) {
    hash = Math.imul(hash ^ (value >>> 0), 0x01000193);
    hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
  }
  return hash >>> 0;
};

export const shuffleInPlace = <T>(items: T[], rng: Rng) => {
  for (let index = items.length - 1; index > 0; index--) {
    const other = rng.int(index + 1);
    const swap = items[index];
    items[index] = items[other];
    items[other] = swap;
  }
  return items;
};
