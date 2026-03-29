import type { V, GameEvent } from "./types";
import { clampAll } from "./bounds";

export function drift(inp: V): V {
  const o = { ...inp };
  o.base_cost_per_case *= 1.035;
  o.medicare_base_rate *= 1.02;
  o.fixed_costs *= 1.03;
  o.medicare_share += 0.004;
  o.commercial_share -= 0.002;
  if (o.quality_score > 60) o.market_share += 0.004;
  if (o.quality_score < 40) o.market_share -= 0.004;
  if (o.patient_satisfaction > 65) o.market_share += 0.002;
  return clampAll(o);
}

export function applyFx(inp: V, fx: Record<string, number | string>): V {
  const o = { ...inp };
  for (const [k, v] of Object.entries(fx)) {
    if (typeof v === "string") {
      if (v.startsWith("mult:")) o[k] *= parseFloat(v.slice(5));
      else if (v.startsWith("add:")) o[k] += parseFloat(v.slice(4));
    } else o[k] = v;
  }
  return o;
}

export function pickEvent(
  events: GameEvent[],
  yr: number,
  loc: string,
  own: string,
  seed: number,
) {
  const el = events.filter(
    (e) =>
      e.yr === yr &&
      (!e.loc || e.loc.includes(loc)) &&
      (!e.own || e.own.includes(own)),
  );
  return el.length ? el[Math.abs(seed) % el.length] : null;
}
