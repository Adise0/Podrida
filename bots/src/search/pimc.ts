// Perfect Information Monte Carlo: every candidate move is played on the same sampled deals, and
// the rest of the round played out with the rollout policy, averaging the result. The deals are
// the outer loop, so if time runs out every move has been tried on the same ones.
import type { CardId } from "../cards";
import { evaluate, type Objective } from "../objective";
import { rollout } from "../policy";
import type { Rng } from "../rng";
import type { Deal } from "../sampler";
import { Sim } from "../sim";

export interface MoveValues {
  moves: CardId[];
  values: Float64Array; // Mean objective per move.
  samples: number; // Deals actually used.
}

export const pimc = (
  bases: (deal: Deal) => Sim, // The round as it stands, on this deal.
  deals: Deal[],
  moves: CardId[],
  rollouts: number,
  objective: Objective,
  rng: Rng,
  randomness: number,
  deadline: number,
): MoveValues => {
  const totals = new Float64Array(moves.length);
  let weight = 0;
  let used = 0;
  let scratch: Sim | null = null;

  for (const deal of deals) {
    if (used > 0 && performance.now() > deadline) break;
    const base = bases(deal);
    scratch ??= base.clone();

    for (let move = 0; move < moves.length; move++) {
      for (let run = 0; run < rollouts; run++) {
        scratch.copyFrom(base);
        scratch.play(moves[move]);
        rollout(scratch, rng, randomness);
        totals[move] += deal.weight * evaluate(scratch, objective);
      }
    }
    weight += deal.weight * rollouts;
    used++;
  }

  return { moves, values: totals.map((total) => total / Math.max(weight, 1e-9)), samples: used };
};
