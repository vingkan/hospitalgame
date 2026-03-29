import type { V } from "./types";
import { cl } from "./utils";

export const BOUNDS: Record<string, [number, number]> = {
  beds: [10, 1500],
  occupancy_rate: [0.3, 0.95],
  avg_los: [2, 10],
  cmi: [0.8, 5],
  medicare_base_rate: [3000, 20000],
  commercial_share: [0.02, 0.8],
  medicare_share: [0.02, 0.7],
  ma_share: [0.01, 0.5],
  medicaid_share: [0.02, 0.6],
  self_pay_share: [0.01, 0.4],
  commercial_mult: [1.2, 4],
  ma_mult: [0.5, 1.5],
  medicaid_mult: [0.3, 1],
  self_pay_collection: [0.1, 0.5],
  outpatient_ratio: [0.2, 0.55],
  teaching_revenue: [0, 2e8],
  other_revenue: [0, 2e8],
  base_cost_per_case: [5000, 30000],
  fixed_costs: [1e6, 2.5e8],
  labor_mult: [0.5, 2],
  supply_mult: [0.5, 2],
  drug_mult: [0.5, 2],
  admin_mult: [0.5, 2],
  capital_mult: [0.5, 2],
  efficiency_mult: [0.88, 1.12],
  quality_score: [0, 100],
  market_share: [0.03, 0.6],
  readmission_rate: [0.04, 0.3],
  patient_satisfaction: [0, 100],
  community_benefit: [0, 100],
};

export const PAYER_KEYS = [
  "commercial_share",
  "medicare_share",
  "ma_share",
  "medicaid_share",
  "self_pay_share",
];

export function clampAll(inp: V): V {
  const o = { ...inp };
  for (const k of PAYER_KEYS)
    if (BOUNDS[k]) o[k] = cl(o[k], BOUNDS[k][0], BOUNDS[k][1]);
  const t = PAYER_KEYS.reduce((s, k) => s + o[k], 0);
  if (t > 0 && Math.abs(t - 1) > 0.005) for (const k of PAYER_KEYS) o[k] /= t;
  for (const [k, [lo, hi]] of Object.entries(BOUNDS))
    o[k] = cl(o[k] ?? 0, lo, hi);
  return o;
}
