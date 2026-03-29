import type { GameNode } from "./types";
import { fv } from "./format";
import { cl } from "./utils";

export const COST_ADJ_FACTOR = 1.0;
export const CMI_COST_EXP = 0.92;

export const NODES: GameNode[] = [
  // ─── INPUTS ───
  ...[
    ["beds", "input", "Licensed Beds", "i"],
    ["occupancy_rate", "input", "Occupancy Rate", "%"],
    ["avg_los", "input", "Avg Length of Stay", "dy"],
    ["cmi", "input", "Case Mix Index", "d"],
    ["medicare_base_rate", "input", "Medicare Base Rate", "$"],
    ["commercial_share", "input", "Commercial %", "%"],
    ["medicare_share", "input", "Medicare %", "%"],
    ["ma_share", "input", "MA %", "%"],
    ["medicaid_share", "input", "Medicaid %", "%"],
    ["self_pay_share", "input", "Self-Pay %", "%"],
    ["commercial_mult", "input", "Commercial Multiplier", "x"],
    ["ma_mult", "input", "MA Multiplier", "x"],
    ["medicaid_mult", "input", "Medicaid Multiplier", "x"],
    ["self_pay_collection", "input", "Self-Pay Collection", "x"],
    ["outpatient_ratio", "input", "Outpatient Ratio", "%"],
    ["teaching_revenue", "input", "Teaching Revenue", "$"],
    ["other_revenue", "input", "Other Revenue", "$"],
    ["base_cost_per_case", "input", "Base Cost/Case (CMI=1)", "$"],
    ["fixed_costs", "input", "Fixed Costs", "$"],
    ["labor_mult", "input", "Labor Multiplier", "x"],
    ["supply_mult", "input", "Supply Multiplier", "x"],
    ["drug_mult", "input", "Drug Multiplier", "x"],
    ["admin_mult", "input", "Admin Multiplier", "x"],
    ["capital_mult", "input", "Capital Multiplier", "x"],
    ["efficiency_mult", "input", "Efficiency Multiplier", "x"],
    ["quality_score", "input", "Quality Score", "s"],
    ["market_share", "input", "Market Share", "%"],
    ["readmission_rate", "input", "Readmission Rate", "%"],
    ["patient_satisfaction", "input", "Patient Satisfaction", "s"],
    ["community_benefit", "input", "Community Benefit", "s"],
  ].map(([id, group, label, fmt]) => ({ id, group, label, fmt })),

  // ─── VOLUME ───
  {
    id: "occupied_bed_days",
    group: "volume",
    label: "Occupied Bed Days",
    fmt: "i",
    deps: ["beds", "occupancy_rate"],
    fn: ({ beds, occupancy_rate }) => Math.round(beds * 365 * occupancy_rate),
    show: ({ beds, occupancy_rate }) =>
      `${beds} × 365 × ${(occupancy_rate * 100).toFixed(0)}%`,
  },
  {
    id: "admissions",
    group: "volume",
    label: "Admissions",
    fmt: "i",
    deps: ["occupied_bed_days", "avg_los"],
    fn: ({ occupied_bed_days, avg_los }) =>
      Math.round(occupied_bed_days / avg_los),
    show: ({ occupied_bed_days, avg_los }) =>
      `${occupied_bed_days.toLocaleString()} / ${avg_los.toFixed(1)}`,
  },
  {
    id: "avg_drg",
    group: "volume",
    label: "Avg DRG Payment",
    fmt: "$",
    deps: ["medicare_base_rate", "cmi"],
    fn: ({ medicare_base_rate, cmi }) => medicare_base_rate * cmi,
    show: ({ medicare_base_rate, cmi }) =>
      `${fv("$", medicare_base_rate)} × ${cmi.toFixed(2)}`,
  },

  // ─── REVENUE ───
  {
    id: "rev_commercial",
    group: "revenue",
    label: "Commercial Revenue",
    fmt: "$",
    deps: ["admissions", "commercial_share", "avg_drg", "commercial_mult"],
    fn: ({ admissions, commercial_share, avg_drg, commercial_mult }) =>
      admissions * commercial_share * avg_drg * commercial_mult,
    show: ({ admissions, commercial_share, avg_drg, commercial_mult }) =>
      `${admissions.toLocaleString()} × ${(commercial_share * 100).toFixed(0)}% × ${fv("$", avg_drg)} × ${commercial_mult.toFixed(1)}×`,
  },
  {
    id: "rev_medicare",
    group: "revenue",
    label: "Medicare Revenue",
    fmt: "$",
    deps: ["admissions", "medicare_share", "avg_drg"],
    fn: ({ admissions, medicare_share, avg_drg }) =>
      admissions * medicare_share * avg_drg,
    show: ({ admissions, medicare_share, avg_drg }) =>
      `${admissions.toLocaleString()} × ${(medicare_share * 100).toFixed(0)}% × ${fv("$", avg_drg)}`,
  },
  {
    id: "rev_ma",
    group: "revenue",
    label: "MA Revenue",
    fmt: "$",
    deps: ["admissions", "ma_share", "avg_drg", "ma_mult"],
    fn: ({ admissions, ma_share, avg_drg, ma_mult }) =>
      admissions * ma_share * avg_drg * ma_mult,
  },
  {
    id: "rev_medicaid",
    group: "revenue",
    label: "Medicaid Revenue",
    fmt: "$",
    deps: ["admissions", "medicaid_share", "avg_drg", "medicaid_mult"],
    fn: ({ admissions, medicaid_share, avg_drg, medicaid_mult }) =>
      admissions * medicaid_share * avg_drg * medicaid_mult,
  },
  {
    id: "rev_self_pay",
    group: "revenue",
    label: "Self-Pay Revenue",
    fmt: "$",
    deps: ["admissions", "self_pay_share", "avg_drg", "self_pay_collection"],
    fn: ({ admissions, self_pay_share, avg_drg, self_pay_collection }) =>
      admissions * self_pay_share * avg_drg * self_pay_collection,
  },
  {
    id: "inpatient_revenue",
    group: "revenue",
    label: "Inpatient Revenue",
    fmt: "$",
    deps: [
      "rev_commercial",
      "rev_medicare",
      "rev_ma",
      "rev_medicaid",
      "rev_self_pay",
    ],
    fn: ({
      rev_commercial,
      rev_medicare,
      rev_ma,
      rev_medicaid,
      rev_self_pay,
    }) => rev_commercial + rev_medicare + rev_ma + rev_medicaid + rev_self_pay,
    show: () => `Σ commercial + medicare + MA + medicaid + self-pay`,
  },
  {
    id: "rev_outpatient",
    group: "revenue",
    label: "Outpatient Revenue",
    fmt: "$",
    deps: ["inpatient_revenue", "outpatient_ratio"],
    fn: ({ inpatient_revenue, outpatient_ratio }) =>
      inpatient_revenue * outpatient_ratio,
    show: ({ outpatient_ratio }) =>
      `inpatient × ${(outpatient_ratio * 100).toFixed(0)}%`,
  },
  {
    id: "rev_other",
    group: "revenue",
    label: "Teaching & Other",
    fmt: "$",
    deps: ["teaching_revenue", "other_revenue", "beds"],
    fn: ({ teaching_revenue, other_revenue, beds }) =>
      teaching_revenue + other_revenue * (beds / 200),
    show: ({ other_revenue, beds }) =>
      `teaching + ${fv("$", other_revenue)} × (${beds}/200)`,
  },
  {
    id: "gross_revenue",
    group: "revenue",
    label: "Gross Revenue",
    fmt: "$",
    deps: ["inpatient_revenue", "rev_outpatient", "rev_other"],
    fn: ({ inpatient_revenue, rev_outpatient, rev_other }) =>
      inpatient_revenue + rev_outpatient + rev_other,
    show: () => `inpatient + outpatient + other`,
  },
  {
    id: "readmit_penalty",
    group: "revenue",
    label: "Readmission Penalty",
    fmt: "$",
    deps: ["readmission_rate", "gross_revenue"],
    fn: ({ readmission_rate, gross_revenue }) =>
      readmission_rate > 0.13
        ? gross_revenue * Math.min(0.03, (readmission_rate - 0.13) * 0.15)
        : 0,
    show: ({ readmission_rate }) =>
      readmission_rate > 0.13
        ? `rate ${(readmission_rate * 100).toFixed(1)}% > 13% → penalty`
        : `rate ${(readmission_rate * 100).toFixed(1)}% ≤ 13% → $0`,
  },
  {
    id: "quality_bonus",
    group: "revenue",
    label: "Quality Bonus",
    fmt: "$",
    deps: ["quality_score", "gross_revenue"],
    fn: ({ quality_score, gross_revenue }) =>
      quality_score > 65
        ? gross_revenue * 0.004 * ((quality_score - 65) / 35)
        : quality_score < 35
          ? -gross_revenue * 0.004 * ((35 - quality_score) / 35)
          : 0,
    show: ({ quality_score }) =>
      `score ${Math.round(quality_score)} ${quality_score > 65 ? "> 65 → bonus" : quality_score < 35 ? "< 35 → penalty" : "in 35-65 → $0"}`,
  },
  {
    id: "hcahps_bonus",
    group: "revenue",
    label: "HCAHPS Bonus",
    fmt: "$",
    deps: ["patient_satisfaction", "gross_revenue"],
    fn: ({ patient_satisfaction, gross_revenue }) =>
      patient_satisfaction > 70
        ? gross_revenue * 0.008 * ((patient_satisfaction - 70) / 30)
        : 0,
    show: ({ patient_satisfaction }) =>
      `satisfaction ${Math.round(patient_satisfaction)} ${patient_satisfaction > 70 ? "> 70 → bonus" : "≤ 70 → $0"}`,
  },
  {
    id: "total_revenue",
    group: "revenue",
    label: "Total Revenue",
    fmt: "$",
    deps: ["gross_revenue", "readmit_penalty", "quality_bonus", "hcahps_bonus"],
    fn: ({ gross_revenue, readmit_penalty, quality_bonus, hcahps_bonus }) =>
      gross_revenue - readmit_penalty + quality_bonus + hcahps_bonus,
    show: () => `gross − penalties + bonuses`,
  },

  // ─── COSTS ───
  {
    id: "market_cost_adj",
    group: "costs",
    label: "Market Cost Adjustment",
    fmt: "x",
    deps: ["commercial_share"],
    fn: ({ commercial_share }) =>
      Math.max(1.0, 1 + (commercial_share - 0.3) * COST_ADJ_FACTOR),
    show: ({ commercial_share }) =>
      `max(1.0, 1 + (${(commercial_share * 100).toFixed(0)}% − 30%) × ${COST_ADJ_FACTOR})`,
  },
  {
    id: "rate_cost_adj",
    group: "costs",
    label: "Rate Cost Adjustment",
    fmt: "x",
    deps: ["commercial_mult"],
    fn: ({ commercial_mult }) =>
      Math.max(1.0, 1 + (commercial_mult - 2.2) * 0.35),
    show: ({ commercial_mult }) =>
      `max(1.0, 1 + (${commercial_mult.toFixed(2)} − 2.20) × 0.35)`,
  },
  {
    id: "case_cost",
    group: "costs",
    label: "Cost Per Case",
    fmt: "$",
    deps: ["base_cost_per_case", "cmi", "market_cost_adj", "rate_cost_adj"],
    fn: ({ base_cost_per_case, cmi, market_cost_adj, rate_cost_adj }) =>
      base_cost_per_case *
      Math.pow(cmi, CMI_COST_EXP) *
      market_cost_adj *
      rate_cost_adj,
    show: ({ base_cost_per_case, cmi, market_cost_adj, rate_cost_adj }) =>
      `${fv("$", base_cost_per_case)} × ${cmi.toFixed(2)}^${CMI_COST_EXP} × ${market_cost_adj.toFixed(3)} × ${rate_cost_adj.toFixed(3)}`,
  },
  {
    id: "total_variable_base",
    group: "costs",
    label: "Total Variable Costs",
    fmt: "$",
    deps: ["admissions", "case_cost"],
    fn: ({ admissions, case_cost }) => admissions * case_cost,
    show: ({ admissions, case_cost }) =>
      `${admissions.toLocaleString()} × ${fv("$", case_cost)}`,
  },
  {
    id: "cost_labor",
    group: "costs",
    label: "Labor (56%)",
    fmt: "$",
    deps: ["total_variable_base", "labor_mult"],
    fn: ({ total_variable_base, labor_mult }) =>
      total_variable_base * 0.56 * labor_mult,
    show: ({ labor_mult }) => `variable × 56% × ${labor_mult.toFixed(2)}`,
  },
  {
    id: "cost_supplies",
    group: "costs",
    label: "Supplies (11%)",
    fmt: "$",
    deps: ["total_variable_base", "supply_mult"],
    fn: ({ total_variable_base, supply_mult }) =>
      total_variable_base * 0.11 * supply_mult,
  },
  {
    id: "cost_drugs",
    group: "costs",
    label: "Drugs (8%)",
    fmt: "$",
    deps: ["total_variable_base", "drug_mult"],
    fn: ({ total_variable_base, drug_mult }) =>
      total_variable_base * 0.08 * drug_mult,
  },
  {
    id: "cost_admin",
    group: "costs",
    label: "Admin (10%)",
    fmt: "$",
    deps: ["total_variable_base", "admin_mult"],
    fn: ({ total_variable_base, admin_mult }) =>
      total_variable_base * 0.1 * admin_mult,
  },
  {
    id: "cost_capital",
    group: "costs",
    label: "Capital (5%)",
    fmt: "$",
    deps: ["total_variable_base", "capital_mult"],
    fn: ({ total_variable_base, capital_mult }) =>
      total_variable_base * 0.05 * capital_mult,
  },
  {
    id: "cost_other_var",
    group: "costs",
    label: "Other Variable (10%)",
    fmt: "$",
    deps: ["total_variable_base"],
    fn: ({ total_variable_base }) => total_variable_base * 0.1,
  },
  {
    id: "cost_fixed",
    group: "costs",
    label: "Fixed Overhead",
    fmt: "$",
    deps: ["fixed_costs"],
    fn: ({ fixed_costs }) => fixed_costs,
  },
  {
    id: "cost_revenue_linked",
    group: "costs",
    label: "Revenue-Linked (15%)",
    fmt: "$",
    deps: ["gross_revenue"],
    fn: ({ gross_revenue }) => gross_revenue * 0.15,
    show: ({ gross_revenue }) => `${fv("$", gross_revenue)} × 15%`,
  },
  {
    id: "structural_costs",
    group: "costs",
    label: "Structural Costs",
    fmt: "$",
    deps: [
      "cost_labor",
      "cost_supplies",
      "cost_drugs",
      "cost_admin",
      "cost_capital",
      "cost_other_var",
      "cost_fixed",
    ],
    fn: ({
      cost_labor,
      cost_supplies,
      cost_drugs,
      cost_admin,
      cost_capital,
      cost_other_var,
      cost_fixed,
    }) =>
      cost_labor +
      cost_supplies +
      cost_drugs +
      cost_admin +
      cost_capital +
      cost_other_var +
      cost_fixed,
    show: () => `Σ labor + supplies + drugs + admin + capital + other + fixed`,
  },
  {
    id: "total_costs",
    group: "costs",
    label: "Total Costs",
    fmt: "$",
    deps: ["structural_costs", "efficiency_mult", "cost_revenue_linked"],
    fn: ({ structural_costs, efficiency_mult, cost_revenue_linked }) =>
      structural_costs * efficiency_mult + cost_revenue_linked,
    show: ({ efficiency_mult }) =>
      `structural × ${efficiency_mult.toFixed(3)} + revenue-linked`,
  },

  // ─── OUTPUTS ───
  {
    id: "profit",
    group: "output",
    label: "Operating Profit",
    fmt: "$",
    deps: ["total_revenue", "total_costs"],
    fn: ({ total_revenue, total_costs }) => total_revenue - total_costs,
    show: () => `total revenue − total costs`,
  },
  {
    id: "operating_margin",
    group: "output",
    label: "Operating Margin",
    fmt: "%p",
    deps: ["profit", "total_revenue"],
    fn: ({ profit, total_revenue }) =>
      total_revenue > 0 ? (profit / total_revenue) * 100 : 0,
    show: () => `profit / revenue × 100`,
  },
  {
    id: "effective_occupancy",
    group: "output",
    label: "Effective Occupancy",
    fmt: "%",
    deps: ["occupancy_rate", "market_share"],
    fn: ({ occupancy_rate, market_share }) =>
      cl(occupancy_rate + (market_share - 0.2) * 0.15, 0.3, 0.95),
    show: ({ occupancy_rate, market_share }) =>
      `${(occupancy_rate * 100).toFixed(0)}% + (${(market_share * 100).toFixed(1)}% − 20%) × 0.15`,
  },
];

// Derive edges for DAG highlighting
export const DAG_EDGES: Record<string, string[]> = {};
for (const n of NODES) if (n.deps) DAG_EDGES[n.id] = n.deps;

export function fmtKey(key: string, v: number) {
  const n = NODES.find((n) => n.id === key);
  return n ? fv(n.fmt, v) : fv("$", v);
}
