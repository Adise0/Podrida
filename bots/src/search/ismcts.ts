// Single-observer Information Set Monte Carlo Tree Search: one tree from the bot's point of view,
// its nodes keyed by the card played. Each iteration draws a deal, walks down the tree using only
// the cards legal in that deal (UCB1, counting how often each child was available), adds one
// node, plays the rest out with the rollout policy, and credits every player with their own
// result. Unlike PIMC, it can't plan on cards it would only know about later ("strategy fusion").
import { SUITS, type CardId } from "../cards";
import { evaluate, type Objective } from "../objective";
import { policyCard, rollout } from "../policy";
import type { Rng } from "../rng";
import { score } from "../rules";
import type { Deal } from "../sampler";
import { Sim } from "../sim";
import type { MoveValues } from "./pimc";

interface Node {
  move: CardId;
  seat: number; // Who played the move leading here.
  visits: number;
  available: number;
  reward: number;
  children: Node[];
}

const EXPLORATION = 0.7;

const newNode = (move: CardId, seat: number): Node => ({
  move,
  seat,
  visits: 0,
  available: 0,
  reward: 0,
  children: [],
});

const legalBuffer = new Int32Array(SUITS);

const legalMoves = (sim: Sim): CardId[] => {
  if (sim.isLero[sim.turn]) return [sim.leroCard(sim.turn)];
  sim.legal(legalBuffer);
  const moves: CardId[] = [];
  for (let suit = 0; suit < SUITS; suit++) {
    let mask = legalBuffer[suit];
    while (mask !== 0) {
      const rank = 31 - Math.clz32(mask & -mask);
      mask &= mask - 1;
      moves.push((suit << 4) | rank);
    }
  }
  return moves;
};

export const ismcts = (
  bases: (deal: Deal) => Sim,
  deals: Deal[],
  rootMoves: CardId[],
  iterations: number,
  objective: Objective,
  rng: Rng,
  randomness: number,
  deadline: number,
  cardsPerPlayer: number,
): MoveValues => {
  const root = newNode(-1, -1);
  const low = -3 * cardsPerPlayer;
  const span = 10 + 6 * cardsPerPlayer;
  const normalise = (value: number) => (value - low) / span;
  const sims = deals.map((deal) => bases(deal));
  const sim = sims[0].clone();
  const path: Node[] = [];
  let done = 0;

  for (let iteration = 0; iteration < iterations; iteration++) {
    if ((iteration & 63) === 0 && iteration > 0 && performance.now() > deadline) break;
    sim.copyFrom(sims[iteration % sims.length]);
    path.length = 0;
    let node = root;

    // Down the tree, while every legal card here has a child.
    while (!sim.isOver) {
      const seat = sim.turn;
      const moves = node === root ? rootMoves : legalMoves(sim);
      const untried: CardId[] = [];
      let best: Node | null = null;
      let bestScore = -Infinity;

      moves.forEach((move) => {
        const child = node.children.find((candidate) => candidate.move === move);
        if (!child) {
          untried.push(move);
          return;
        }
        child.available++;
        const value =
          child.reward / child.visits +
          EXPLORATION * Math.sqrt(Math.log(child.available) / child.visits);
        if (value > bestScore) {
          bestScore = value;
          best = child;
        }
      });

      if (untried.length > 0) {
        // Expand: the policy's choice if it hasn't been tried, else one at random.
        const preferred = policyCard(sim, null);
        const move = untried.includes(preferred) ? preferred : untried[rng.int(untried.length)];
        const child = newNode(move, seat);
        child.available = 1;
        node.children.push(child);
        sim.play(move);
        path.push(child);
        break;
      }

      node = best as unknown as Node;
      sim.play(node.move);
      path.push(node);
    }

    rollout(sim, rng, randomness);

    // Everyone's own result; the bot's through its objective.
    path.forEach((visited) => {
      visited.visits++;
      visited.reward +=
        visited.seat === objective.me
          ? normalise(evaluate(sim, objective))
          : normalise(score(sim.bids[visited.seat], sim.won[visited.seat]));
    });
    done++;
  }

  // Most visited, as the value (mistakes pick the second most visited).
  const values = Float64Array.from(rootMoves, (move) => {
    const child = root.children.find((candidate) => candidate.move === move);
    return child ? child.visits + (child.visits > 0 ? child.reward / child.visits : 0) * 1e-3 : 0;
  });
  return { moves: rootMoves, values, samples: done };
};
