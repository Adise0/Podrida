// The exact endgame: with few cards left, each sampled deal is solved outright instead of played
// out by the rollout policy. Perfect information, every player choosing among their legal cards
// to maximise their own round score (max^n). Finished positions are remembered at trick
// boundaries (a transposition table), and cards next to each other in rank with nothing in
// between still in play are the same move.
import { rankOf, SUITS, suitOf, type CardId } from "../cards";
import type { Objective } from "../objective";
import { policyCard } from "../policy";
import { score } from "../rules";
import { Sim } from "../sim";

export class NodeLimitReached extends Error {}

const moveBuffer = new Int32Array(SUITS);

// The seat's distinct moves: one card per run of "touching" cards (no card in between held by
// anyone or lying in the current trick). Lero seats have one move: the next card they were dealt.
const movesOf = (sim: Sim): CardId[] => {
  const seat = sim.turn;
  if (sim.isLero[seat]) return [sim.leroCard(seat)];

  sim.legal(moveBuffer);
  const moves: CardId[] = [];
  for (let suit = 0; suit < SUITS; suit++) {
    const mask = moveBuffer[suit];
    if (mask === 0) continue;
    // Ranks that tell cards apart: held by someone, or in the trick.
    let live = 0;
    for (let other = 0; other < sim.n; other++) live |= sim.hands[other * SUITS + suit];
    for (let index = 0; index < sim.trickLength; index++) {
      if (suitOf(sim.trick[index]) === suit) live |= 1 << rankOf(sim.trick[index]);
    }
    let lastWasMove = false; // The last live rank below was one of these moves.
    for (let rank = 0; rank < 13; rank++) {
      if ((live & (1 << rank)) === 0) continue;
      const isMove = (mask & (1 << rank)) !== 0;
      if (isMove && !lastWasMove) moves.push((suit << 4) | rank);
      lastWasMove = isMove;
    }
  }
  return moves;
};

interface Solver {
  objective: Objective;
  nodes: number;
  limit: number;
  table: Map<string, Float64Array>;
  stack: Sim[];
}

const leafScores = (sim: Sim) =>
  Float64Array.from(sim.bids, (bid, seat) => score(bid, sim.won[seat]));

const valueFor = (solver: Solver, seat: number, scores: Float64Array) => {
  if (seat !== solver.objective.me || solver.objective.spoiler === 0) return scores[seat];
  let others = 0;
  for (let other = 0; other < scores.length; other++) {
    if (other !== seat) others += solver.objective.weights[other] * scores[other];
  }
  return scores[seat] - solver.objective.spoiler * others;
};

const keyOf = (sim: Sim) => `${sim.hands.join(",")}|${sim.won.join(",")}|${sim.leader}`;

// Every seat's final round score, everyone playing their best from here.
const solve = (solver: Solver, sim: Sim, depth: number): Float64Array => {
  solver.nodes++;
  if (solver.nodes > solver.limit) throw new NodeLimitReached();
  if (sim.isOver) return leafScores(sim);

  const atBoundary = sim.trickLength === 0;
  const key = atBoundary ? keyOf(sim) : "";
  if (atBoundary) {
    const known = solver.table.get(key);
    if (known) return known;
  }

  const seat = sim.turn;
  const moves = movesOf(sim);
  // The policy's choice first: ties go to it.
  if (moves.length > 1) {
    const preferred = policyCard(sim, null);
    const index = moves.findIndex((move) => move === preferred);
    if (index > 0) [moves[0], moves[index]] = [moves[index], moves[0]];
  }

  solver.stack[depth] ??= new Sim(sim.n, sim.trump);
  const child = solver.stack[depth];
  let best: Float64Array | null = null;
  let bestValue = -Infinity;

  for (const move of moves) {
    child.copyFrom(sim);
    child.play(move);
    const result = solve(solver, child, depth + 1);
    const value = valueFor(solver, seat, result);
    if (value > bestValue) {
      bestValue = value;
      best = result;
    }
  }

  if (atBoundary) solver.table.set(key, best as Float64Array);
  return best as Float64Array;
};

// The value (the bot's objective) of each root move on this deal, or throws NodeLimitReached.
export const solveEndgame = (
  root: Sim,
  moves: CardId[],
  objective: Objective,
  nodeLimit: number,
): Float64Array => {
  const solver: Solver = { objective, nodes: 0, limit: nodeLimit, table: new Map(), stack: [] };
  const child = new Sim(root.n, root.trump);
  solver.stack[0] = new Sim(root.n, root.trump);

  return Float64Array.from(moves, (move) => {
    child.copyFrom(root);
    child.play(move);
    return valueFor(solver, objective.me, solve(solver, child, 0));
  });
};

// The final scores of the round from here, everyone playing their best (for the bidding search).
export const solveScores = (root: Sim, objective: Objective, nodeLimit: number): Float64Array => {
  const solver: Solver = { objective, nodes: 0, limit: nodeLimit, table: new Map(), stack: [] };
  return solve(solver, root.clone(), 0);
};

export const endgameMoves = movesOf;
