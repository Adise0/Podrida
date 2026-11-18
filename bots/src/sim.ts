// A round being simulated, with every hand filled in: one sampled deal (a "determinization"), or a
// test position. The searches play thousands of these per decision, so it's flat typed arrays,
// copied in place rather than cloned.
//
// Simulated players only ever look at their own hand and what's public (see policy.ts): the deal
// is complete here only because the simulation has to play every seat.
import { bitCount, rankOf, SUITS, suitOf, type CardId } from "./cards";
import { legalInto, winningIndex } from "./rules";

export class Sim {
  readonly n: number;
  readonly trump: number;
  readonly hands: Int32Array; // seat * 4 + suit
  readonly gone: Int32Array; // Played this round, and the trump card. Per suit.
  readonly bids: Int8Array; // What each seat plays toward (its bid, or an assumed one).
  readonly won: Int8Array;
  readonly trick: Int32Array;
  trickLength = 0;
  leader = 0;
  turn = 0;
  tricksLeft = 0; // Including the current one.
  readonly publicVoid: Uint8Array; // Per seat: a bit per suit, voids everyone has seen.
  readonly isLero: Uint8Array;
  // Lero seats: their cards in dealt order (some of them already played). Shared, never changed
  // by a simulation: a Lero seat plays the first one it still holds.
  leroOrder: (CardId[] | null)[];

  constructor(n: number, trump: number) {
    this.n = n;
    this.trump = trump;
    this.hands = new Int32Array(n * SUITS);
    this.gone = new Int32Array(SUITS);
    this.bids = new Int8Array(n);
    this.won = new Int8Array(n);
    this.trick = new Int32Array(n);
    this.publicVoid = new Uint8Array(n);
    this.isLero = new Uint8Array(n);
    this.leroOrder = Array.from({ length: n }, () => null);
  }

  copyFrom(other: Sim) {
    this.hands.set(other.hands);
    this.gone.set(other.gone);
    this.bids.set(other.bids);
    this.won.set(other.won);
    this.trick.set(other.trick);
    this.trickLength = other.trickLength;
    this.leader = other.leader;
    this.turn = other.turn;
    this.tricksLeft = other.tricksLeft;
    this.publicVoid.set(other.publicVoid);
    this.isLero.set(other.isLero);
    this.leroOrder = other.leroOrder;
    return this;
  }

  clone() {
    return new Sim(this.n, this.trump).copyFrom(this);
  }

  get isOver() {
    return this.tricksLeft === 0;
  }

  holds(seat: number, card: CardId) {
    return (this.hands[seat * SUITS + suitOf(card)] & (1 << rankOf(card))) !== 0;
  }

  handSize(seat: number) {
    const offset = seat * SUITS;
    return (
      bitCount(this.hands[offset]) +
      bitCount(this.hands[offset + 1]) +
      bitCount(this.hands[offset + 2]) +
      bitCount(this.hands[offset + 3])
    );
  }

  // The legal cards of the seat to play, as four masks in `out`. Returns how many.
  legal(out: Int32Array | number[]) {
    return legalInto(this.hands, this.turn * SUITS, this.trick, this.trickLength, this.trump, out);
  }

  // What a Lero seat plays: the first card it still holds, in dealt order, legal or not.
  leroCard(seat: number): CardId {
    const order = this.leroOrder[seat];
    if (order) {
      for (const card of order) if (this.holds(seat, card)) return card;
    }
    // No order known (shouldn't happen): its lowest card.
    const offset = seat * SUITS;
    for (let suit = 0; suit < SUITS; suit++) {
      const mask = this.hands[offset + suit];
      if (mask !== 0) return (suit << 4) | (31 - Math.clz32(mask & -mask));
    }
    throw new Error("Lero seat has no cards");
  }

  // Plays a card for the seat whose turn it is. Returns the winning seat when it completes the
  // trick, -1 otherwise.
  play(card: CardId): number {
    const seat = this.turn;
    const suit = suitOf(card);
    const bit = 1 << rankOf(card);

    if (this.trickLength > 0 && this.isLero[seat] === 0) {
      // What everyone at the table learns from it (a Lero seat's plays mean nothing).
      const led = suitOf(this.trick[0]);
      if (suit !== led) {
        this.publicVoid[seat] |= 1 << led;
        if (suit !== this.trump && !this.trickHasTrump()) this.publicVoid[seat] |= 1 << this.trump;
      }
    }

    this.hands[seat * SUITS + suit] &= ~bit;
    this.gone[suit] |= bit;
    this.trick[this.trickLength++] = card;

    if (this.trickLength < this.n) {
      this.turn = (seat + 1) % this.n;
      return -1;
    }

    const winner = (this.leader + winningIndex(this.trick, this.n, this.trump)) % this.n;
    this.won[winner] += 1;
    this.trickLength = 0;
    this.leader = winner;
    this.turn = winner;
    this.tricksLeft -= 1;
    return winner;
  }

  trickHasTrump() {
    for (let index = 0; index < this.trickLength; index++) {
      if (suitOf(this.trick[index]) === this.trump) return true;
    }
    return false;
  }
}
