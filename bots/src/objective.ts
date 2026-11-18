// What a bot plays for: its own round score. An Expert also counts the opponents' round scores
// against it (κ, "spoiler"), the leader's most, and late in the game it weighs them by the
// standings: protect a lead, or catch up.
import { score } from "./rules";
import type { Sim } from "./sim";
import type { BotView } from "./view";

export interface Objective {
  me: number;
  spoiler: number;
  weights: Float64Array; // Per seat, for the spoiler term.
}

export const makeObjective = (view: BotView, spoiler: number): Objective => {
  const me = view.seats.indexOf(view.me);
  const totals = view.seats.map((userId) => view.totals[userId] ?? 0);
  const mine = totals[me];
  const leaderTotal = Math.max(...totals.filter((_, seat) => seat !== me));
  const isLate = view.roundNumber > view.roundCount * 0.75;

  const weights = Float64Array.from(totals, (total, seat) => {
    if (seat === me) return 0;
    let weight = Math.min(2.5, Math.max(0.25, 1 + (total - mine) / 40));
    if (total === leaderTotal) weight += 0.5;
    // Late on, only the race that's still open matters.
    if (isLate) weight *= Math.abs(total - mine) < 40 ? 1.5 : 0.5;
    return weight;
  });

  return { me, spoiler, weights };
};

export const evaluate = (sim: Sim, objective: Objective) => {
  const own = score(sim.bids[objective.me], sim.won[objective.me]);
  if (objective.spoiler === 0) return own;
  let others = 0;
  for (let seat = 0; seat < sim.n; seat++) {
    if (seat !== objective.me)
      others += objective.weights[seat] * score(sim.bids[seat], sim.won[seat]);
  }
  return own - objective.spoiler * others;
};
