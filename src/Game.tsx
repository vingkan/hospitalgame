import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

// ═══════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════
const fl = document.createElement("link");
fl.href =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,400&family=Manrope:wght@300;400;500;600;700;800&display=swap";
fl.rel = "stylesheet";
document.head.appendChild(fl);
const C = {
  bg: "#0a0f1a",
  surface: "#111827",
  surfaceAlt: "#1a2236",
  border: "#1e293b",
  borderLight: "#334155",
  text: "#e2e8f0",
  textDim: "#94a3b8",
  textMuted: "#64748b",
  accent: "#2dd4bf",
  accentDim: "#0d9488",
  accentBg: "rgba(45,212,191,0.08)",
  good: "#34d399",
  bad: "#f87171",
  warn: "#fbbf24",
  blue: "#60a5fa",
  purple: "#a78bfa",
  pink: "#f472b6",
  orange: "#fb923c",
};
const F = { d: "'Fraunces', serif", b: "'Manrope', sans-serif" };
const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ═══════════════════════════════════════════════════════════════════
// MODEL AST — the single source of truth
// ═══════════════════════════════════════════════════════════════════
// Input nodes (group "input") have no deps/fn. Computed nodes list
// deps, fn({dep1, dep2}), and show({dep1, dep2}) for display formulas.
// The evaluate() engine traverses this array in order (topological).

type V = Record<string, number>;
interface GameNode {
  id: string;
  group: string;
  label: string;
  fmt: string;
  deps?: string[];
  fn?: (args: V) => number;
  show?: (args: V) => string;
}
interface GameEvent {
  yr: number;
  loc?: string[];
  own?: string[];
  text: string;
  fx: Record<string, number | string>;
}
interface PhaseOption {
  id: string;
  label: string;
  icon: string;
  desc: string;
  effects: Record<string, number | string>;
}
interface PhaseDecision {
  id: string;
  title: string;
  description: string;
  options: PhaseOption[];
}
interface Phase {
  phase: number;
  title: string;
  subtitle: string;
  decisions: PhaseDecision[];
}
type LogEntry = { phase: string; decision: string; choice: string };
type SnapEntry = { key: string; label: string; before: number; after: number };
interface CalibResult {
  location: string;
  ownership: string;
  size: string;
  count: number;
  margin: {
    min: number;
    p25: number;
    med: number;
    avg: number;
    p75: number;
    max: number;
  };
  profit: {
    min: number;
    p25: number;
    med: number;
    avg: number;
    p75: number;
    max: number;
  };
  quality: { min: number; avg: number; max: number };
  share: { min: number; avg: number; max: number };
}

const COST_ADJ_FACTOR = 1.0; // how much commercial share increases costs
const CMI_COST_EXP = 0.92; // costs scale nearly linearly with CMI

const NODES: GameNode[] = [
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
const DAG_EDGES: Record<string, string[]> = {};
for (const n of NODES) if (n.deps) DAG_EDGES[n.id] = n.deps;

// ═══════════════════════════════════════════════════════════════════
// EVALUATE ENGINE — traverses AST, returns {vals, formulas}
// ═══════════════════════════════════════════════════════════════════
function evaluate(nodes: GameNode[], inputs: V) {
  const vals: V = {},
    formulas: Record<string, string> = {};
  for (const node of nodes) {
    if (!node.deps) {
      vals[node.id] = inputs[node.id] ?? 0;
      continue;
    }
    const args: V = {};
    for (const d of node.deps) args[d] = vals[d];
    vals[node.id] = node.fn!(args);
    if (node.show) formulas[node.id] = node.show(args);
  }
  return { vals, formulas };
}

// Fast evaluate — skips formula generation, for bulk calibration runs
function evaluateFast(nodes: GameNode[], inputs: V): V {
  const vals: V = {};
  for (const node of nodes) {
    if (!node.deps) {
      vals[node.id] = inputs[node.id] ?? 0;
      continue;
    }
    const args: V = {};
    for (const d of node.deps) args[d] = vals[d];
    vals[node.id] = node.fn!(args);
  }
  return vals;
}

// ═══════════════════════════════════════════════════════════════════
// BOUNDS + CLAMP
// ═══════════════════════════════════════════════════════════════════
const BOUNDS: Record<string, [number, number]> = {
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
const PAYER_KEYS = [
  "commercial_share",
  "medicare_share",
  "ma_share",
  "medicaid_share",
  "self_pay_share",
];
function clampAll(inp: V): V {
  const o = { ...inp };
  for (const k of PAYER_KEYS)
    if (BOUNDS[k]) o[k] = cl(o[k], BOUNDS[k][0], BOUNDS[k][1]);
  const t = PAYER_KEYS.reduce((s, k) => s + o[k], 0);
  if (t > 0 && Math.abs(t - 1) > 0.005) for (const k of PAYER_KEYS) o[k] /= t;
  for (const [k, [lo, hi]] of Object.entries(BOUNDS))
    o[k] = cl(o[k] ?? 0, lo, hi);
  return o;
}

// ═══════════════════════════════════════════════════════════════════
// BASE INPUTS (calibrated: default community ≈ 2% margin)
// ═══════════════════════════════════════════════════════════════════
const BASE_INPUTS = {
  beds: 200,
  occupancy_rate: 0.65,
  avg_los: 4.5,
  cmi: 1.5,
  medicare_base_rate: 8200,
  commercial_share: 0.35,
  medicare_share: 0.25,
  ma_share: 0.1,
  medicaid_share: 0.2,
  self_pay_share: 0.1,
  commercial_mult: 2.2,
  ma_mult: 0.88,
  medicaid_mult: 0.6,
  self_pay_collection: 0.25,
  outpatient_ratio: 0.35,
  teaching_revenue: 0,
  other_revenue: 0,
  base_cost_per_case: 10200,
  fixed_costs: 18000000,
  labor_mult: 1,
  supply_mult: 1,
  drug_mult: 1,
  admin_mult: 1,
  capital_mult: 1,
  efficiency_mult: 1,
  quality_score: 50,
  market_share: 0.2,
  readmission_rate: 0.15,
  patient_satisfaction: 50,
  community_benefit: 50,
};

// ═══════════════════════════════════════════════════════════════════
// METRIC METADATA — display info for dashboard/tooltips
// ═══════════════════════════════════════════════════════════════════
const MM: Record<string, { l: string; h: string; t: string }> = {
  total_revenue: {
    l: "Total Revenue",
    h: "good",
    t: "All money in: inpatient + outpatient + teaching + other.",
  },
  total_costs: {
    l: "Total Costs",
    h: "bad",
    t: "Everything spent: labor (56%), supplies, drugs, admin, capital, fixed overhead.",
  },
  profit: {
    l: "Operating Profit",
    h: "good",
    t: "Revenue minus costs. US avg ~2% margin. Negative means burning reserves.",
  },
  operating_margin: {
    l: "Operating Margin",
    h: "good",
    t: "Profit as % of revenue. Avg ~2%. For-profit leaders 10-15%.",
  },
  quality_score: {
    l: "Quality Score",
    h: "good",
    t: "Composite clinical quality. Drives CMS penalties/bonuses (up to 6%).",
  },
  market_share: {
    l: "Market Share",
    h: "good",
    t: "Your share of local admissions. Drives occupancy, payer leverage.",
  },
  patient_satisfaction: {
    l: "Patient Satisfaction",
    h: "good",
    t: "HCAHPS proxy. 1-star ≈ 8.8% more net revenue per discharge.",
  },
  community_benefit: {
    l: "Community Benefit",
    h: "good",
    t: "Community health impact. Critical for non-profit status.",
  },
  readmission_rate: {
    l: "Readmission Rate",
    h: "bad",
    t: "30-day readmit %. >13% triggers HRRP penalty (up to 3% of Medicare).",
  },
  admissions: {
    l: "Admissions",
    h: "good",
    t: "Annual inpatient admissions. Each earns a DRG lump sum.",
  },
  effective_occupancy: {
    l: "Occupancy",
    h: "good",
    t: "Avg % beds filled. <50%=high fixed cost. >85%=bottlenecks.",
  },
  cmi: {
    l: "Case Mix Index",
    h: "good",
    t: "Avg DRG weight — directly multiplies inpatient revenue.",
  },
  avg_los: {
    l: "Avg Length of Stay",
    h: "bad",
    t: "Days per admission. Shorter = cheaper under DRG.",
  },
  beds: { l: "Licensed Beds", h: "neutral", t: "Bed capacity." },
  rev_commercial: {
    l: "Commercial",
    h: "good",
    t: "Private insurance. Pays 2-3× Medicare. #1 profitability driver.",
  },
  rev_medicare: {
    l: "Medicare FFS",
    h: "neutral",
    t: "Traditional Medicare. Pays ~83¢/$1 of cost.",
  },
  rev_ma: {
    l: "Medicare Adv.",
    h: "neutral",
    t: "Private Medicare plans. ~88% of FFS rates.",
  },
  rev_medicaid: {
    l: "Medicaid",
    h: "neutral",
    t: "Low-income program. ~60% of Medicare. Loses money.",
  },
  rev_self_pay: { l: "Self-Pay", h: "bad", t: "Uninsured. ~25% collection." },
  rev_outpatient: {
    l: "Outpatient",
    h: "good",
    t: "ER, clinics, surgery, imaging. Growing ~13% YOY.",
  },
  rev_other: {
    l: "Teaching & Other",
    h: "good",
    t: "GME/IME, DSH, grants. Often margin-decisive.",
  },
  cost_labor: {
    l: "Labor",
    h: "bad",
    t: "~56% of costs. Hospital wages avg ~$68/hr.",
  },
  cost_supplies: { l: "Supplies", h: "bad", t: "~11%. Implants, disposables." },
  cost_drugs: { l: "Drugs", h: "bad", t: "~8%. Growing ~13% YOY." },
  cost_admin: { l: "Admin", h: "bad", t: "~10%. Billing, coding, denials." },
  cost_capital: { l: "Capital", h: "bad", t: "~5%. Buildings, equipment, IT." },
  cost_fixed: {
    l: "Fixed Overhead",
    h: "bad",
    t: "Non-volume costs: leadership, utilities, insurance.",
  },
  cost_revenue_linked: {
    l: "Revenue-Linked",
    h: "bad",
    t: "Admin complexity, physician incentives, compliance scaling with revenue (~10%).",
  },
  commercial_share: {
    l: "Commercial %",
    h: "good",
    t: "% from private insurance. #1 predictor of financial health.",
  },
  medicare_share: {
    l: "Medicare %",
    h: "neutral",
    t: "% from traditional Medicare.",
  },
  ma_share: { l: "MA %", h: "neutral", t: "% from Medicare Advantage." },
  medicaid_share: {
    l: "Medicaid %",
    h: "bad",
    t: "% from Medicaid. Loses money per admission.",
  },
  self_pay_share: {
    l: "Self-Pay %",
    h: "bad",
    t: "% uninsured. ~25% collection.",
  },
};

// ═══════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════
function fv(fmt: string, v: number | null | undefined): string {
  if (v == null) return "—";
  switch (fmt) {
    case "$": {
      const a = Math.abs(v),
        s = v < 0 ? "-" : "";
      return a >= 1e9
        ? `${s}$${(a / 1e9).toFixed(1)}B`
        : a >= 1e6
          ? `${s}$${(a / 1e6).toFixed(1)}M`
          : a >= 1e3
            ? `${s}$${(a / 1e3).toFixed(0)}K`
            : `${s}$${a.toFixed(0)}`;
    }
    case "%":
      return `${(v * 100).toFixed(1)}%`;
    case "%p":
      return `${v.toFixed(1)}%`;
    case "i":
      return Math.round(v).toLocaleString();
    case "s":
      return `${Math.round(v)}/100`;
    case "d":
      return v.toFixed(2);
    case "dy":
      return `${v.toFixed(1)}d`;
    case "x":
      return `${v.toFixed(3)}×`;
    default:
      return String(v);
  }
}
function fmtNode(node: GameNode, v: number) {
  return fv(node.fmt, v);
}
function fmtKey(key: string, v: number) {
  const n = NODES.find((n) => n.id === key);
  return n ? fv(n.fmt, v) : fv("$", v);
}

function delta(key: string, cur: number, prev: number) {
  if (prev == null || Math.abs(cur - prev) < 0.001) return null;
  const m = MM[key],
    d = cur - prev,
    up = d > 0;
  const good = m ? (m.h === "good" ? up : m.h === "bad" ? !up : null) : null;
  const col = good === true ? C.good : good === false ? C.bad : C.textMuted;
  const n = NODES.find((n) => n.id === key);
  const lbl =
    n?.fmt === "$"
      ? fv("$", Math.abs(d))
      : n?.fmt === "%p"
        ? `${Math.abs(d).toFixed(1)}pp`
        : `${(prev ? Math.abs(d / prev) * 100 : 0).toFixed(1)}%`;
  return { arrow: up ? "▲" : "▼", lbl, col };
}
function grade(h: V[]) {
  if (!h.length) return { l: "?", n: "Unknown", c: C.textMuted };
  const x = h[h.length - 1],
    am = h.reduce((s, v) => s + v.operating_margin, 0) / h.length;
  const s =
    (cl(x.quality_score, 0, 100) / 100) * 35 +
    (cl(x.market_share, 0, 0.5) / 0.5) * 25 +
    (cl(am, -5, 5) / 5) * 25 +
    (cl(x.community_benefit, 0, 100) / 100) * 15;
  if (s > 70) return { l: "A", n: "Exceptional", c: C.good };
  if (s > 55) return { l: "B", n: "Strong", c: C.accent };
  if (s > 40) return { l: "C", n: "Adequate", c: C.warn };
  if (s > 25) return { l: "D", n: "Struggling", c: C.orange };
  return { l: "F", n: "Critical", c: C.bad };
}

// ═══════════════════════════════════════════════════════════════════
// DRIFT + CONTEXT EVENTS
// ═══════════════════════════════════════════════════════════════════
function drift(inp: V): V {
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
function applyFx(inp: V, fx: Record<string, number | string>): V {
  const o = { ...inp };
  for (const [k, v] of Object.entries(fx)) {
    if (typeof v === "string") {
      if (v.startsWith("mult:")) o[k] *= parseFloat(v.slice(5));
      else if (v.startsWith("add:")) o[k] += parseFloat(v.slice(4));
    } else o[k] = v;
  }
  return o;
}

const EVENTS: GameEvent[] = [
  {
    yr: 2,
    loc: ["rural"],
    text: "📰 Your only cardiologist retires — recruiting to a small town proves difficult.",
    fx: { quality_score: "add:-4", market_share: "add:-0.02" },
  },
  {
    yr: 2,
    loc: ["rural"],
    text: "📰 The neighboring county hospital closes. Your admissions surge.",
    fx: { occupancy_rate: "add:0.06", market_share: "add:0.05" },
  },
  {
    yr: 2,
    loc: ["suburban"],
    text: "📰 A competing ASC opens nearby, drawing commercial orthopedic cases.",
    fx: { market_share: "add:-0.015", commercial_share: "add:-0.01" },
  },
  {
    yr: 2,
    loc: ["suburban"],
    text: "📰 An urgent care chain opens, diverting low-acuity ED visits.",
    fx: { outpatient_ratio: "add:-0.03", market_share: "add:-0.01" },
  },
  {
    yr: 2,
    loc: ["urban"],
    text: "📰 The academic medical center expands its cardiac program.",
    fx: { market_share: "add:-0.02", cmi: "add:-0.05" },
  },
  {
    yr: 2,
    loc: ["urban"],
    text: "📰 A commercial payer announces a narrow network.",
    fx: { commercial_share: "add:-0.015", commercial_mult: "add:0.08" },
  },
  {
    yr: 3,
    loc: ["rural"],
    text: "📰 State increases rural Medicaid supplemental payments.",
    fx: { other_revenue: "add:2000000", medicaid_mult: "add:0.05" },
  },
  {
    yr: 3,
    loc: ["suburban"],
    text: "📰 Largest employer switches plans — your hospital is now in-network.",
    fx: { commercial_share: "add:0.015", occupancy_rate: "add:0.02" },
  },
  {
    yr: 3,
    loc: ["urban"],
    text: "📰 City transit expansion improves patient access.",
    fx: { market_share: "add:0.02", patient_satisfaction: "add:3" },
  },
  {
    yr: 3,
    own: ["government"],
    text: "📰 City council holds hospital budget flat despite inflation.",
    fx: { other_revenue: "add:-2000000", community_benefit: "add:3" },
  },
  {
    yr: 3,
    own: ["forprofit"],
    text: "📰 Investor group mandates cost reduction targets.",
    fx: { efficiency_mult: "mult:0.98", community_benefit: "add:-5" },
  },
  {
    yr: 4,
    loc: ["rural"],
    text: "📰 Drug wholesaler consolidates rural routes — supply costs spike.",
    fx: { supply_mult: "mult:1.08", drug_mult: "mult:1.06" },
  },
  {
    yr: 4,
    loc: ["suburban"],
    text: "📰 CMS expands site-neutral reform. HOPD drug admin rates cut.",
    fx: { outpatient_ratio: "add:0.02", commercial_mult: "add:-0.04" },
  },
  {
    yr: 4,
    loc: ["urban"],
    text: "📰 Housing crisis increases homelessness and uncompensated care.",
    fx: { self_pay_share: "add:0.02", community_benefit: "add:5" },
  },
  {
    yr: 5,
    loc: ["rural"],
    text: "📰 State Medicaid expansion reaches rural counties.",
    fx: { medicaid_share: "add:0.03", self_pay_share: "add:-0.03" },
  },
  {
    yr: 5,
    loc: ["suburban"],
    text: "📰 Consolidation wave — acquisition offers from national chains.",
    fx: { market_share: "add:0.01", commercial_mult: "add:0.03" },
  },
  {
    yr: 5,
    loc: ["urban"],
    text: "📰 Two competing hospitals merge — market dynamics shift.",
    fx: { market_share: "add:-0.02", commercial_mult: "add:0.03" },
  },
];
function pickEvent(yr: number, loc: string, own: string, seed: number) {
  const el = EVENTS.filter(
    (e) =>
      e.yr === yr &&
      (!e.loc || e.loc.includes(loc)) &&
      (!e.own || e.own.includes(own)),
  );
  return el.length ? el[Math.abs(seed) % el.length] : null;
}

// ═══════════════════════════════════════════════════════════════════
// PHASES (calibrated margins: community care mult:0.98 not 0.94)
// ═══════════════════════════════════════════════════════════════════
const PHASES: Phase[] = [
  {
    phase: 0,
    title: "Choose Your Market",
    subtitle: "Location and ownership shape everything.",
    decisions: [
      {
        id: "location",
        title: "Location",
        description: "Your market shapes payer mix, competition, and costs.",
        options: [
          {
            id: "rural",
            label: "Rural Community",
            icon: "🌾",
            desc: "Aging population. Dominant but heavy Medicare, thin commercial.",
            effects: {
              commercial_share: 0.15,
              medicare_share: 0.45,
              ma_share: 0.08,
              medicaid_share: 0.18,
              self_pay_share: 0.14,
              market_share: 0.42,
              fixed_costs: 10000000,
              commercial_mult: 1.6,
              base_cost_per_case: "mult:0.85",
              other_revenue: "add:2000000",
              community_benefit: 65,
              patient_satisfaction: 55,
            },
          },
          {
            id: "suburban",
            label: "Suburban Growth",
            icon: "🏘️",
            desc: "Young families, employer insurance. Strong commercial, rising competition.",
            effects: {
              commercial_share: 0.44,
              medicare_share: 0.2,
              ma_share: 0.08,
              medicaid_share: 0.16,
              self_pay_share: 0.12,
              market_share: 0.24,
              fixed_costs: 20000000,
              commercial_mult: 2.3,
              community_benefit: 45,
              patient_satisfaction: 52,
            },
          },
          {
            id: "urban",
            label: "Urban Metro",
            icon: "🏙️",
            desc: "Diverse. Higher Medicaid/uninsured, large volumes, intense competition.",
            effects: {
              commercial_share: 0.3,
              medicare_share: 0.22,
              ma_share: 0.12,
              medicaid_share: 0.26,
              self_pay_share: 0.1,
              market_share: 0.12,
              fixed_costs: 26000000,
              commercial_mult: 2.5,
              base_cost_per_case: "mult:1.05",
              other_revenue: "add:3000000",
              community_benefit: 55,
              patient_satisfaction: 42,
            },
          },
        ],
      },
      {
        id: "ownership",
        title: "Ownership",
        description: "Governance defines incentives, capital, and culture.",
        options: [
          {
            id: "nonprofit",
            label: "Non-Profit",
            icon: "🏥",
            desc: "Tax-exempt, philanthropy. Mission-driven.",
            effects: {
              other_revenue: "add:4000000",
              efficiency_mult: "mult:1.01",
              quality_score: "add:5",
              community_benefit: "add:10",
            },
          },
          {
            id: "forprofit",
            label: "For-Profit",
            icon: "📈",
            desc: "Shareholder-driven, disciplined costs.",
            effects: {
              efficiency_mult: "mult:0.97",
              quality_score: "add:-3",
              community_benefit: "add:-10",
            },
          },
          {
            id: "government",
            label: "Government",
            icon: "🏛️",
            desc: "Safety net with appropriations.",
            effects: {
              medicaid_share: "add:0.10",
              commercial_share: "add:-0.08",
              self_pay_share: "add:0.03",
              other_revenue: "add:20000000",
              efficiency_mult: "mult:1.05",
              quality_score: "add:-5",
              community_benefit: "add:20",
              market_share: "add:0.03",
            },
          },
        ],
      },
    ],
  },
  {
    phase: 1,
    title: "Build Your Foundation",
    subtitle: "Scale and strategy for Year 1",
    decisions: [
      {
        id: "size",
        title: "Hospital Size",
        description: "Scale drives volume, services, and fixed costs.",
        options: [
          {
            id: "small",
            label: "Small (75 beds)",
            icon: "🏠",
            desc: "Critical access. Low overhead, limited services.",
            effects: {
              beds: 75,
              fixed_costs: "mult:0.50",
              cmi: 1.2,
              outpatient_ratio: 0.25,
              quality_score: "add:-5",
            },
          },
          {
            id: "medium",
            label: "Medium (200 beds)",
            icon: "🏢",
            desc: "Community hospital. Core services.",
            effects: { beds: 200, cmi: 1.5, outpatient_ratio: 0.35 },
          },
          {
            id: "large",
            label: "Large (400 beds)",
            icon: "🏗️",
            desc: "Regional center. Full services.",
            effects: {
              beds: 400,
              fixed_costs: "mult:1.90",
              cmi: 1.8,
              outpatient_ratio: 0.4,
              quality_score: "add:5",
              occupancy_rate: "add:0.03",
            },
          },
          {
            id: "major",
            label: "Major (650 beds)",
            icon: "🏰",
            desc: "Tertiary center. Maximum complexity.",
            effects: {
              beds: 650,
              fixed_costs: "mult:3.20",
              cmi: 2.2,
              outpatient_ratio: 0.45,
              quality_score: "add:10",
              occupancy_rate: "add:0.06",
              base_cost_per_case: "mult:1.12",
            },
          },
        ],
      },
      {
        id: "strategy",
        title: "Strategic Focus",
        description: "What defines your competitive advantage?",
        options: [
          {
            id: "teaching",
            label: "Teaching & Research",
            icon: "🎓",
            desc: "Academic mission. GME/IME, grants. Highest quality + costs.",
            effects: {
              teaching_revenue: "add:25000000",
              cmi: "add:0.12",
              quality_score: "add:15",
              base_cost_per_case: "mult:1.15",
              fixed_costs: "mult:1.25",
              readmission_rate: "add:-0.02",
              market_share: "add:0.04",
            },
          },
          {
            id: "procedural",
            label: "Procedural Excellence",
            icon: "🔬",
            desc: "High-margin surgical specialties.",
            effects: {
              cmi: "add:0.08",
              commercial_mult: "add:0.06",
              base_cost_per_case: "mult:1.06",
              quality_score: "add:8",
              avg_los: "add:-0.3",
              market_share: "add:0.02",
            },
          },
          {
            id: "community",
            label: "Community Care",
            icon: "❤️",
            desc: "Primary/preventive. Strong loyalty, lower readmissions.",
            effects: {
              readmission_rate: "add:-0.03",
              patient_satisfaction: "add:12",
              community_benefit: "add:15",
              base_cost_per_case: "mult:0.98",
              market_share: "add:0.03",
              quality_score: "add:5",
            },
          },
          {
            id: "safety_net",
            label: "Safety Net",
            icon: "🛡️",
            desc: "Serve the underserved. DSH and grants offset payer mix.",
            effects: {
              medicaid_share: "add:0.08",
              self_pay_share: "add:0.04",
              commercial_share: "add:-0.08",
              other_revenue: "add:12000000",
              community_benefit: "add:25",
              quality_score: "add:3",
              readmission_rate: "add:0.01",
            },
          },
        ],
      },
    ],
  },
  {
    phase: 2,
    title: "Year 2 — Physicians & Services",
    subtitle: "Organize medical staff and invest.",
    decisions: [
      {
        id: "phys",
        title: "Physician Alignment",
        description:
          "Doctor relationships drive quality, documentation, referrals.",
        options: [
          {
            id: "employ",
            label: "Employ Physicians",
            icon: "👔",
            desc: "Control practice patterns, CDI. Subsidy ~$317K/FTE.",
            effects: {
              fixed_costs: "mult:1.12",
              quality_score: "add:8",
              cmi: "add:0.03",
              readmission_rate: "add:-0.01",
              avg_los: "add:-0.2",
              efficiency_mult: "mult:0.985",
            },
          },
          {
            id: "contract",
            label: "Contract Groups",
            icon: "📋",
            desc: "Predictable costs, less alignment.",
            effects: {
              fixed_costs: "mult:1.04",
              efficiency_mult: "mult:1.01",
              quality_score: "add:2",
              patient_satisfaction: "add:-5",
            },
          },
          {
            id: "independent",
            label: "Independent Staff",
            icon: "🤝",
            desc: "Lowest cost, lowest control.",
            effects: {
              quality_score: "add:-3",
              market_share: "add:-0.02",
              efficiency_mult: "mult:0.99",
              patient_satisfaction: "add:3",
              readmission_rate: "add:0.01",
            },
          },
        ],
      },
      {
        id: "svc",
        title: "Service Line Investment",
        description: "Where you invest defines cases and margin.",
        options: [
          {
            id: "cardio",
            label: "Cardiology & Ortho",
            icon: "💓",
            desc: "Highest-margin procedural lines.",
            effects: {
              cmi: "add:0.05",
              commercial_mult: "add:0.04",
              base_cost_per_case: "mult:1.04",
              fixed_costs: "add:6000000",
              market_share: "add:0.02",
              avg_los: "add:-0.2",
            },
          },
          {
            id: "cancer",
            label: "Cancer Center",
            icon: "🎗️",
            desc: "Referral magnet. Enormous capital.",
            effects: {
              cmi: "add:0.06",
              fixed_costs: "add:12000000",
              outpatient_ratio: "add:0.04",
              market_share: "add:0.04",
              quality_score: "add:6",
              patient_satisfaction: "add:5",
            },
          },
          {
            id: "behav",
            label: "Behavioral Health",
            icon: "🧠",
            desc: "Massive unmet demand. Cuts readmissions.",
            effects: {
              community_benefit: "add:18",
              readmission_rate: "add:-0.02",
              quality_score: "add:4",
              patient_satisfaction: "add:8",
              fixed_costs: "add:3000000",
              market_share: "add:0.02",
            },
          },
          {
            id: "maintain",
            label: "Maintain Mix",
            icon: "⚖️",
            desc: "Operational improvement focus.",
            effects: {
              efficiency_mult: "mult:0.985",
              fixed_costs: "add:-1000000",
            },
          },
        ],
      },
    ],
  },
  {
    phase: 3,
    title: "Year 3 — Ambulatory & Payer",
    subtitle: "Outpatient growing 2× faster than inpatient.",
    decisions: [
      {
        id: "amb",
        title: "Ambulatory Strategy",
        description: "HOPDs pay ~1.8× ASCs but cost 42% more.",
        options: [
          {
            id: "own_asc",
            label: "Build Owned ASCs",
            icon: "🏥",
            desc: "Lower cost at ASC rates.",
            effects: {
              outpatient_ratio: "add:0.06",
              base_cost_per_case: "mult:0.97",
              fixed_costs: "add:5000000",
              efficiency_mult: "mult:0.985",
              market_share: "add:0.02",
            },
          },
          {
            id: "jv_asc",
            label: "JV with Physicians",
            icon: "🤝",
            desc: "Shared ownership, aligned incentives.",
            effects: {
              outpatient_ratio: "add:0.05",
              market_share: "add:0.04",
              patient_satisfaction: "add:5",
              quality_score: "add:3",
              fixed_costs: "add:2500000",
            },
          },
          {
            id: "hopd",
            label: "Double Down HOPD",
            icon: "🏗️",
            desc: "Higher rates today. Reform risk.",
            effects: {
              outpatient_ratio: "add:0.05",
              commercial_mult: "add:0.03",
            },
          },
        ],
      },
      {
        id: "payer",
        title: "Payer Strategy",
        description: "Commercial rates = #1 margin driver.",
        options: [
          {
            id: "agg_comm",
            label: "Aggressive Rates",
            icon: "💰",
            desc: "Leverage position. Risk exclusion.",
            effects: {
              commercial_mult: "add:0.05",
              market_share: "add:-0.02",
              patient_satisfaction: "add:-3",
            },
          },
          {
            id: "ma",
            label: "Pursue MA",
            icon: "📑",
            desc: "Growing volume, lower pay.",
            effects: {
              ma_share: "add:0.06",
              medicare_share: "add:-0.04",
              ma_mult: "add:0.05",
              occupancy_rate: "add:0.03",
              efficiency_mult: "mult:1.01",
            },
          },
          {
            id: "vbc",
            label: "Value-Based Risk",
            icon: "🎯",
            desc: "Shared savings. High upside.",
            effects: {
              readmission_rate: "add:-0.02",
              quality_score: "add:8",
              efficiency_mult: "mult:0.98",
              fixed_costs: "add:3000000",
              community_benefit: "add:8",
            },
          },
        ],
      },
    ],
  },
  {
    phase: 4,
    title: "Year 4 — Workforce & Technology",
    subtitle: "Labor is 56% of costs.",
    decisions: [
      {
        id: "staff",
        title: "Staffing",
        description: "Contract labor costs industry $51B/year.",
        options: [
          {
            id: "premium",
            label: "Premium Wages",
            icon: "💎",
            desc: "Above-market. Reduces agency spend.",
            effects: {
              labor_mult: "mult:1.10",
              quality_score: "add:10",
              patient_satisfaction: "add:10",
              readmission_rate: "add:-0.015",
              efficiency_mult: "mult:0.98",
              market_share: "add:0.02",
            },
          },
          {
            id: "lean",
            label: "Lean + Travelers",
            icon: "✈️",
            desc: "Lower fixed cost, inconsistent quality.",
            effects: {
              labor_mult: "mult:0.93",
              fixed_costs: "mult:0.95",
              quality_score: "add:-8",
              patient_satisfaction: "add:-10",
              readmission_rate: "add:0.02",
              efficiency_mult: "mult:1.02",
            },
          },
          {
            id: "train",
            label: "Training Programs",
            icon: "📚",
            desc: "Build pipelines. Long payoff.",
            effects: {
              fixed_costs: "add:4000000",
              quality_score: "add:6",
              teaching_revenue: "add:3000000",
              patient_satisfaction: "add:5",
              readmission_rate: "add:-0.01",
            },
          },
        ],
      },
      {
        id: "tech",
        title: "Technology",
        description: "Expensive but potentially transformative.",
        options: [
          {
            id: "ehr",
            label: "EHR Overhaul",
            icon: "💻",
            desc: "Unified platform. Long-term gains.",
            effects: {
              fixed_costs: "add:15000000",
              efficiency_mult: "mult:0.97",
              quality_score: "add:6",
              avg_los: "add:-0.15",
              readmission_rate: "add:-0.01",
            },
          },
          {
            id: "ai",
            label: "AI Decision Support",
            icon: "🤖",
            desc: "CDI, sepsis, coding. CMI boost.",
            effects: {
              cmi: "add:0.04",
              fixed_costs: "add:5000000",
              quality_score: "add:4",
              avg_los: "add:-0.1",
              admin_mult: "mult:0.92",
            },
          },
          {
            id: "tele",
            label: "Telehealth",
            icon: "📱",
            desc: "Virtual visits. Extends reach.",
            effects: {
              outpatient_ratio: "add:0.03",
              patient_satisfaction: "add:7",
              community_benefit: "add:10",
              fixed_costs: "add:2000000",
              market_share: "add:0.02",
            },
          },
          {
            id: "min",
            label: "Minimal Tech",
            icon: "📄",
            desc: "Keep current. Risk falling behind.",
            effects: {
              quality_score: "add:-4",
              efficiency_mult: "mult:1.01",
              patient_satisfaction: "add:-3",
            },
          },
        ],
      },
    ],
  },
  {
    phase: 5,
    title: "Year 5 — Growth & Capital",
    subtitle: "Secure the future.",
    decisions: [
      {
        id: "growth",
        title: "Growth Strategy",
        description: "Consolidation and rationalization.",
        options: [
          {
            id: "acquire",
            label: "Acquire",
            icon: "🏗️",
            desc: "Expand overnight. Integration risk.",
            effects: {
              beds: "add:120",
              market_share: "add:0.10",
              fixed_costs: "mult:1.40",
              base_cost_per_case: "mult:1.03",
              occupancy_rate: "add:-0.05",
              quality_score: "add:-3",
            },
          },
          {
            id: "merge",
            label: "Join System",
            icon: "🔗",
            desc: "Purchasing power. Lose autonomy.",
            effects: {
              base_cost_per_case: "mult:0.93",
              commercial_mult: "add:0.04",
              efficiency_mult: "mult:0.97",
              fixed_costs: "mult:0.92",
              quality_score: "add:5",
            },
          },
          {
            id: "divest",
            label: "Divest",
            icon: "✂️",
            desc: "Improve margins, shrink footprint.",
            effects: {
              beds: "mult:0.80",
              fixed_costs: "mult:0.78",
              market_share: "add:-0.04",
              cmi: "add:0.03",
              efficiency_mult: "mult:0.97",
              community_benefit: "add:-10",
            },
          },
          {
            id: "organic",
            label: "Organic Growth",
            icon: "🌱",
            desc: "Quality and reputation.",
            effects: {
              quality_score: "add:5",
              patient_satisfaction: "add:5",
              market_share: "add:0.02",
              community_benefit: "add:5",
            },
          },
        ],
      },
      {
        id: "cap",
        title: "Capital Allocation",
        description: "Plant age rising 10%+.",
        options: [
          {
            id: "tower",
            label: "Patient Tower",
            icon: "🏗️",
            desc: "Modern facility. Massive capex.",
            effects: {
              beds: "add:80",
              fixed_costs: "add:18000000",
              patient_satisfaction: "add:15",
              quality_score: "add:8",
              market_share: "add:0.05",
              occupancy_rate: "add:0.04",
            },
          },
          {
            id: "ambnet",
            label: "Ambulatory Network",
            icon: "🏥",
            desc: "Outpatient clinics. Referral funnel.",
            effects: {
              outpatient_ratio: "add:0.06",
              market_share: "add:0.04",
              fixed_costs: "add:8000000",
              community_benefit: "add:8",
              patient_satisfaction: "add:5",
            },
          },
          {
            id: "debt",
            label: "Debt Reduction",
            icon: "📉",
            desc: "Better ratings, lower interest.",
            effects: {
              fixed_costs: "mult:0.88",
              efficiency_mult: "mult:0.985",
            },
          },
        ],
      },
    ],
  },
];

const NEWS: Record<string, string> = {
  rural:
    "Your hospital opens in a rural community — primary provider for 50 miles.",
  suburban: "Located in a booming suburban corridor.",
  urban: "In the metro, serving diverse communities.",
  nonprofit: "Non-profit board balances mission with sustainability.",
  forprofit: "Investors expect discipline.",
  government: "County charter signed. The safety net.",
  small: "75 beds — lean and focused.",
  medium: "200 beds: the community workhorse.",
  large: "400 beds at regional referral scale.",
  major: "650 beds. Building an institution.",
  teaching: "Teaching programs attract top residents.",
  procedural: "Surgical investment pays off.",
  community: "Community programs build trust.",
  safety_net: "DSH payments offset the payer mix.",
  employ: "Physician employment unlocks CDI.",
  contract: "Contract groups: predictable costs.",
  independent: "Independent physicians; coordination difficult.",
  cardio: "Heart and joint programs attract referrals.",
  cancer: "Cancer center becomes a magnet.",
  behav: "Behavioral health cuts ED psych holds 40%.",
  maintain: "Operational excellence compounds.",
  own_asc: "ASC network captures volume.",
  jv_asc: "Physician JV aligns incentives.",
  hopd: "HOPD rates favorable. Reform looms.",
  agg_comm: "Premium rates; two payers drop you.",
  ma: "MA volume surges.",
  vbc: "Value-based contracts reward quality.",
  premium: "Best workplace. Travel spend drops 60%.",
  lean: "Costs controlled; turnover accelerates.",
  train: "Nursing academy graduates stay.",
  ehr: "EHR: painful then transformative.",
  ai: "AI CDI catches gaps. Sepsis alerts save lives.",
  tele: "Virtual visits extend reach.",
  min: "Holding tech line; competitors ahead.",
  acquire: "Acquisition doubles presence.",
  merge: "System affiliation drops supply costs 8%.",
  divest: "Shedding underperformers improves costs.",
  organic: "Quality drives sustainable growth.",
  tower: "New tower opens to fanfare.",
  ambnet: "Five outpatient locations create funnel.",
  debt: "Bond upgrade. Savings compound.",
};

// ═══════════════════════════════════════════════════════════════════
// TOOLTIP — viewport-aware
// ═══════════════════════════════════════════════════════════════════
function Tip({ text, children }: { text?: string; children: ReactNode }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<CSSProperties>({});
  const onEnter = useCallback(() => {
    setShow(true);
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect(),
      s: CSSProperties = {};
    if (r.top > 200) s.bottom = "calc(100% + 8px)";
    else s.top = "calc(100% + 8px)";
    if (r.left < 140) {
      s.left = 0;
      s.transform = "none";
    } else if (window.innerWidth - r.right < 140) {
      s.right = 0;
      s.transform = "none";
    } else {
      s.left = "50%";
      s.transform = "translateX(-50%)";
    }
    setPos(s);
  }, []);
  if (!text) return <>{children}</>;
  return (
    <span
      ref={ref}
      style={{
        position: "relative",
        cursor: "help",
        borderBottom: `1px dotted ${C.textMuted}44`,
      }}
      onMouseEnter={onEnter}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          style={{
            position: "absolute",
            width: 260,
            padding: "10px 12px",
            background: "#1e293b",
            border: `1px solid ${C.borderLight}`,
            borderRadius: 8,
            fontSize: 11,
            lineHeight: 1.5,
            color: C.textDim,
            zIndex: 1000,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            pointerEvents: "none",
            ...pos,
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DAG VIEWER — reads from AST + evaluate output
// ═══════════════════════════════════════════════════════════════════
function getAnc(id: string, v = new Set<string>()) {
  if (v.has(id)) return v;
  v.add(id);
  for (const d of DAG_EDGES[id] || []) getAnc(d, v);
  return v;
}
function getDesc(id: string, v = new Set<string>()) {
  if (v.has(id)) return v;
  v.add(id);
  for (const [k, ds] of Object.entries(DAG_EDGES))
    if (ds.includes(id)) getDesc(k, v);
  return v;
}

const GROUP_ICONS: Record<string, string> = {
  input: "📥",
  volume: "📊",
  revenue: "💰",
  costs: "🏭",
  output: "📈",
};
const GROUP_LABELS: Record<string, string> = {
  input: "INPUTS",
  volume: "VOLUME",
  revenue: "REVENUE",
  costs: "COSTS",
  output: "OUTPUTS",
};

function DAGViewer({
  inputs,
  log,
  snaps,
}: {
  inputs: V;
  log: LogEntry[];
  snaps: SnapEntry[][];
}) {
  const { vals, formulas } = useMemo(() => evaluate(NODES, inputs), [inputs]);
  const [hov, setHov] = useState<string | null>(null);
  const anc = useMemo(() => (hov ? getAnc(hov) : new Set<string>()), [hov]);
  const desc = useMemo(() => (hov ? getDesc(hov) : new Set<string>()), [hov]);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Decision trail per variable
  const trail = useMemo(() => {
    const t: Record<string, Array<{ label: string; d: number }>> = {};
    if (!log || !snaps) return t;
    for (let i = 0; i < log.length; i++)
      for (const imp of snaps[i] || []) {
        if (!t[imp.key]) t[imp.key] = [];
        t[imp.key].push({ label: log[i].choice, d: imp.after - imp.before });
      }
    return t;
  }, [log, snaps]);

  function rowStyle(vid: string) {
    if (!hov) return {};
    if (vid === hov)
      return { borderLeft: `3px solid ${C.accent}`, background: C.accentBg };
    if (anc.has(vid)) return { borderLeft: `2px solid ${C.blue}`, opacity: 1 };
    if (desc.has(vid))
      return { borderLeft: `2px solid ${C.orange}`, opacity: 1 };
    return { opacity: 0.3 };
  }

  const groups: Record<string, GameNode[]> = {};
  for (const n of NODES) {
    if (!groups[n.group]) groups[n.group] = [];
    groups[n.group].push(n);
  }

  return (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "14px 16px",
        maxHeight: "78vh",
        overflowY: "auto",
        fontSize: 11,
        fontFamily: "monospace",
        lineHeight: 1.8,
      }}
    >
      <div
        style={{
          fontFamily: F.d,
          fontSize: 14,
          fontWeight: 700,
          color: C.accent,
          marginBottom: 4,
        }}
      >
        🔧 Model Inspector
      </div>
      <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 8 }}>
        Hover to trace dependencies. Click inputs to see decision history.
      </div>
      {hov && (
        <div
          style={{
            fontSize: 10,
            color: C.textDim,
            marginBottom: 6,
            padding: "3px 8px",
            background: C.surfaceAlt,
            borderRadius: 6,
          }}
        >
          <span style={{ color: C.blue }}>■</span> upstream →{" "}
          <span style={{ color: C.accent, fontWeight: 700 }}>{hov}</span> →{" "}
          <span style={{ color: C.orange }}>■</span> downstream
        </div>
      )}
      {Object.entries(groups).map(([grp, nodes]) => (
        <div key={grp} style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: C.accent,
              marginBottom: 2,
            }}
          >
            {GROUP_ICONS[grp]} {GROUP_LABELS[grp]}
          </div>
          {nodes.map((node) => {
            const v = vals[node.id],
              isInput = !node.deps,
              formula = formulas[node.id];
            const hasTrail = isInput && trail[node.id];
            return (
              <div
                key={node.id}
                onMouseEnter={() => setHov(node.id)}
                onMouseLeave={() => setHov(null)}
                onClick={() =>
                  hasTrail && setExpanded(expanded === node.id ? null : node.id)
                }
                style={{
                  paddingLeft: 8,
                  cursor: hasTrail ? "pointer" : "default",
                  transition: "opacity 0.15s",
                  ...rowStyle(node.id),
                }}
              >
                {isInput ? (
                  <span>
                    <span
                      style={{
                        color: C.textMuted,
                        minWidth: 140,
                        display: "inline-block",
                      }}
                    >
                      {node.id}
                    </span>
                    {" = "}
                    <span style={{ color: C.text, fontWeight: 600 }}>
                      {fmtNode(node, v)}
                    </span>
                    {hasTrail && (
                      <span
                        style={{ color: C.accent, fontSize: 9, marginLeft: 4 }}
                      >
                        ▸ {trail[node.id].length} changes
                      </span>
                    )}
                  </span>
                ) : (
                  <span
                    style={{
                      color: formula ? C.textDim : C.text,
                      fontWeight: node.group === "output" ? 700 : 400,
                    }}
                  >
                    <span style={{ color: C.textMuted }}>{node.label}</span>
                    {" = "}
                    <b
                      style={{
                        color: node.group === "output" ? C.accent : C.text,
                      }}
                    >
                      {fmtNode(node, v)}
                    </b>
                    {formula && (
                      <span
                        style={{
                          color: C.textMuted,
                          fontSize: 10,
                          marginLeft: 6,
                        }}
                      >
                        ← {formula}
                      </span>
                    )}
                  </span>
                )}
                {expanded === node.id && trail[node.id] && (
                  <div
                    style={{ paddingLeft: 12, marginTop: 2, marginBottom: 4 }}
                  >
                    {trail[node.id].map((t, i) => {
                      const m = MM[node.id],
                        up = t.d > 0;
                      const good = m
                        ? m.h === "good"
                          ? up
                          : m.h === "bad"
                            ? !up
                            : null
                        : null;
                      const col =
                        good === true
                          ? C.good
                          : good === false
                            ? C.bad
                            : C.textMuted;
                      return (
                        <div key={i} style={{ fontSize: 10, color: col }}>
                          → {t.label}: {up ? "+" : ""}
                          {fmtKey(node.id, t.d)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// KPI + DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function KPI({
  k,
  v,
  pv,
  icon,
}: {
  k: string;
  v: number;
  pv?: number | null;
  icon: string;
}) {
  const m = MM[k],
    d = pv != null ? delta(k, v, pv) : null;
  const col =
    k === "profit"
      ? v > 0
        ? C.good
        : C.bad
      : k === "operating_margin"
        ? v > 5
          ? C.good
          : v > 0
            ? C.warn
            : C.bad
        : m?.h === "good"
          ? C.good
          : C.blue;
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "12px 14px",
        flex: "1 1 0",
        minWidth: 125,
      }}
    >
      <Tip text={m?.t}>
        <div
          style={{
            fontSize: 10,
            color: C.textMuted,
            marginBottom: 3,
            fontWeight: 600,
          }}
        >
          {icon} {m?.l}
        </div>
      </Tip>
      <div
        style={{ fontSize: 20, fontWeight: 700, color: col, fontFamily: F.d }}
      >
        {fmtKey(k, v)}
      </div>
      {d && (
        <div
          style={{ fontSize: 10, color: d.col, marginTop: 1, fontWeight: 600 }}
        >
          {d.arrow} {d.lbl}
        </div>
      )}
    </div>
  );
}

function Dashboard({
  history,
  projection,
}: {
  history: V[];
  projection: V | null;
}) {
  const c = history[history.length - 1],
    p = history.length > 1 ? history[history.length - 2] : null;
  const cd = history.map((h, i) => ({
    yr: `Y${i + 1}`,
    rev: h.total_revenue / 1e6,
    cost: h.total_costs / 1e6,
  }));
  if (projection)
    cd.push({
      yr: `Y${history.length + 1}`,
      rev: projection.total_revenue / 1e6,
      cost: projection.total_costs / 1e6,
    });

  const ts: CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
  };
  const tdL: CSSProperties = {
    padding: "3px 0",
    color: C.textDim,
    fontSize: 12,
  };
  const tdV: CSSProperties = {
    padding: "3px 0",
    textAlign: "right",
    fontWeight: 600,
    fontFamily: "monospace",
    fontSize: 11.5,
  };
  const tdD: CSSProperties = {
    padding: "3px 0",
    textAlign: "right",
    fontSize: 9.5,
    fontWeight: 600,
    width: 65,
  };

  const TRow = ({
    label,
    tip,
    value,
    d,
    color,
  }: {
    label: string;
    tip: string;
    value: string;
    d: { arrow: string; lbl: string; col: string } | null;
    color?: string;
  }) => (
    <tr>
      <td style={tdL}>
        <Tip text={tip}>
          <span>
            {color && (
              <span
                style={{
                  display: "inline-block",
                  width: 7,
                  height: 7,
                  borderRadius: 2,
                  background: color,
                  marginRight: 6,
                }}
              />
            )}
            {label}
          </span>
        </Tip>
      </td>
      <td style={tdV}>{value}</td>
      <td style={tdD}>
        {d && (
          <span style={{ color: d.col }}>
            {d.arrow} {d.lbl}
          </span>
        )}
      </td>
    </tr>
  );

  return (
    <div>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}
      >
        <KPI k="profit" v={c.profit} pv={p?.profit} icon="💰" />
        <KPI
          k="operating_margin"
          v={c.operating_margin}
          pv={p?.operating_margin}
          icon="📊"
        />
        <KPI
          k="quality_score"
          v={c.quality_score}
          pv={p?.quality_score}
          icon="⭐"
        />
        <KPI
          k="market_share"
          v={c.market_share}
          pv={p?.market_share}
          icon="📈"
        />
      </div>
      {cd.length > 1 && (
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "12px 6px 6px 0",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingLeft: 18,
              marginBottom: 4,
              fontSize: 11,
            }}
          >
            <Tip text="Revenue and costs over time. The gap between lines is your margin.">
              <span style={{ fontWeight: 600, color: C.textDim }}>
                Financial Trend ($M)
              </span>
            </Tip>
            {projection && (
              <span style={{ color: C.textMuted, fontSize: 9.5 }}>
                last point = outlook
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={175}>
            <AreaChart data={cd}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="yr" stroke={C.textMuted} fontSize={10} />
              <YAxis stroke={C.textMuted} fontSize={9} />
              <RTooltip
                contentStyle={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  fontSize: 11,
                }}
                formatter={(v) => `$${Number(v).toFixed(1)}M`}
              />
              <Area
                type="monotone"
                dataKey="rev"
                stroke={C.blue}
                fill="none"
                strokeWidth={2.5}
                name="Revenue"
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke={C.orange}
                fill="none"
                strokeWidth={2.5}
                name="Costs"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "12px 14px",
          }}
        >
          <Tip text="Revenue by source.">
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.textDim,
                display: "block",
                marginBottom: 4,
              }}
            >
              Revenue
            </span>
          </Tip>
          <table style={ts}>
            <tbody>
              {[
                ["rev_commercial", C.good],
                ["rev_medicare", C.blue],
                ["rev_ma", C.purple],
                ["rev_medicaid", C.orange],
                ["rev_self_pay", C.pink],
                ["rev_outpatient", C.accent],
                ["rev_other", C.warn],
              ].map(([k, col]) => (
                <TRow
                  key={k}
                  label={MM[k]?.l}
                  tip={MM[k]?.t}
                  value={fv("$", c[k])}
                  d={p ? delta(k, c[k], p[k]) : null}
                  color={col}
                />
              ))}
              <tr>
                <td
                  colSpan={3}
                  style={{ borderTop: `1px solid ${C.border}`, paddingTop: 3 }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    <span>Total</span>
                    <span style={{ color: C.accent }}>
                      {fv("$", c.total_revenue)}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "12px 14px",
          }}
        >
          <Tip text="Cost breakdown. Labor is 56%.">
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.textDim,
                display: "block",
                marginBottom: 4,
              }}
            >
              Costs
            </span>
          </Tip>
          <table style={ts}>
            <tbody>
              {[
                "cost_labor",
                "cost_supplies",
                "cost_drugs",
                "cost_admin",
                "cost_capital",
                "cost_fixed",
                "cost_revenue_linked",
              ].map((k) => {
                const pt =
                  c.total_costs > 0
                    ? ((c[k] / c.total_costs) * 100).toFixed(0)
                    : "0";
                return (
                  <TRow
                    key={k}
                    label={`${MM[k]?.l} (${pt}%)`}
                    tip={MM[k]?.t}
                    value={fv("$", c[k])}
                    d={p ? delta(k, c[k], p[k]) : null}
                  />
                );
              })}
              <tr>
                <td
                  colSpan={3}
                  style={{ borderTop: `1px solid ${C.border}`, paddingTop: 3 }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    <span>Total</span>
                    <span style={{ color: C.orange }}>
                      {fv("$", c.total_costs)}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "12px 14px",
          }}
        >
          <Tip text="Payer distribution.">
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.textDim,
                display: "block",
                marginBottom: 4,
              }}
            >
              Payer Mix
            </span>
          </Tip>
          <table style={ts}>
            <tbody>
              {[
                ["commercial_share", C.good],
                ["medicare_share", C.blue],
                ["ma_share", C.purple],
                ["medicaid_share", C.orange],
                ["self_pay_share", C.pink],
              ].map(([k, col]) => (
                <TRow
                  key={k}
                  label={MM[k]?.l}
                  tip={MM[k]?.t}
                  value={`${(c[k] * 100).toFixed(1)}%`}
                  d={p ? delta(k, c[k], p[k]) : null}
                  color={col}
                />
              ))}
            </tbody>
          </table>
          <div
            style={{
              display: "flex",
              height: 6,
              borderRadius: 3,
              overflow: "hidden",
              marginTop: 6,
              gap: 1,
            }}
          >
            {[
              c.commercial_share,
              c.medicare_share,
              c.ma_share,
              c.medicaid_share,
              c.self_pay_share,
            ].map((v, i) => (
              <div
                key={i}
                style={{
                  width: `${v * 100}%`,
                  background: [C.good, C.blue, C.purple, C.orange, C.pink][i],
                }}
              />
            ))}
          </div>
        </div>
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "12px 14px",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.textDim,
              display: "block",
              marginBottom: 4,
            }}
          >
            Key Metrics
          </span>
          <table style={ts}>
            <tbody>
              {[
                "beds",
                "admissions",
                "effective_occupancy",
                "cmi",
                "avg_los",
                "readmission_rate",
                "patient_satisfaction",
                "community_benefit",
              ].map((k) => (
                <TRow
                  key={k}
                  label={MM[k]?.l || k}
                  tip={MM[k]?.t}
                  value={fmtKey(k, c[k])}
                  d={p ? delta(k, c[k], p[k]) : null}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FINAL REPORT
// ═══════════════════════════════════════════════════════════════════
function Final({
  history: h,
  log,
  snaps,
}: {
  history: V[];
  log: LogEntry[];
  snaps: SnapEntry[][];
}) {
  const g = grade(h),
    x = h[h.length - 1],
    f = h[0],
    tp = h.reduce((s, v) => s + v.profit, 0),
    am = h.reduce((s, v) => s + v.operating_margin, 0) / h.length;
  const rd = [
    { m: "Profit", v: cl((x.operating_margin / 12) * 100, 0, 100) },
    { m: "Quality", v: x.quality_score },
    { m: "Market", v: cl((x.market_share / 0.5) * 100, 0, 100) },
    { m: "Satisfaction", v: x.patient_satisfaction },
    { m: "Community", v: x.community_benefit },
  ];
  const cd = h.map((v, i) => ({
    yr: `Y${i + 1}`,
    profit: +(v.profit / 1e6).toFixed(1),
    quality: Math.round(v.quality_score),
    share: Math.round(v.market_share * 100),
  }));
  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 80,
            height: 80,
            borderRadius: "50%",
            border: `3px solid ${g.c}`,
            fontSize: 40,
            fontFamily: F.d,
            fontWeight: 700,
            color: g.c,
            marginBottom: 8,
          }}
        >
          {g.l}
        </div>
        <div style={{ fontSize: 18, fontFamily: F.d, fontWeight: 500 }}>
          {g.n} Performance
        </div>
        <div style={{ color: C.textDim, fontSize: 12, marginTop: 3 }}>
          5-Year Profit:{" "}
          <span style={{ color: tp > 0 ? C.good : C.bad, fontWeight: 700 }}>
            {fv("$", tp)}
          </span>{" "}
          · Avg Margin:{" "}
          <span style={{ fontWeight: 700 }}>{am.toFixed(1)}%</span>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            display: "flex",
            justifyContent: "center",
            padding: "10px 0",
          }}
        >
          <ResponsiveContainer width="100%" height={210}>
            <RadarChart data={rd} cx="50%" cy="50%" outerRadius="65%">
              <PolarGrid stroke={C.border} />
              <PolarAngleAxis
                dataKey="m"
                tick={{ fontSize: 10, fill: C.textDim }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <Radar
                dataKey="v"
                stroke={C.accent}
                fill={C.accent}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "12px 6px 6px 0",
          }}
        >
          <div
            style={{
              paddingLeft: 16,
              fontSize: 11,
              fontWeight: 600,
              color: C.textDim,
              marginBottom: 3,
            }}
          >
            5-Year Journey
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={cd}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="yr" stroke={C.textMuted} fontSize={10} />
              <YAxis yAxisId="l" stroke={C.textMuted} fontSize={9} />
              <YAxis
                yAxisId="r"
                orientation="right"
                stroke={C.textMuted}
                fontSize={9}
              />
              <RTooltip
                contentStyle={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  fontSize: 10,
                }}
              />
              <Line
                yAxisId="l"
                type="monotone"
                dataKey="profit"
                stroke={C.good}
                strokeWidth={2.5}
                name="Profit $M"
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="r"
                type="monotone"
                dataKey="quality"
                stroke={C.pink}
                strokeWidth={2}
                name="Quality"
                dot={{ r: 2 }}
              />
              <Line
                yAxisId="r"
                type="monotone"
                dataKey="share"
                stroke={C.blue}
                strokeWidth={2}
                name="Share %"
                dot={{ r: 2 }}
              />
              <Legend wrapperStyle={{ fontSize: 9 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "12px 14px",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.textDim,
            marginBottom: 8,
          }}
        >
          Scorecard
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 10,
          }}
        >
          {[
            {
              l: "Revenue Growth",
              v: `${((x.total_revenue / f.total_revenue - 1) * 100).toFixed(0)}%`,
              g: x.total_revenue > f.total_revenue,
              t: "Total revenue change from Year 1 to Year 5. Driven by payer mix, CMI, outpatient growth, and volume.",
            },
            {
              l: "Margin Δ",
              v: `${(x.operating_margin - f.operating_margin).toFixed(1)}pp`,
              g: x.operating_margin > f.operating_margin,
              t: "Change in operating margin (profit/revenue). Positive means you improved efficiency relative to revenue.",
            },
            {
              l: "Quality Δ",
              v: `${x.quality_score > f.quality_score ? "+" : ""}${(x.quality_score - f.quality_score).toFixed(0)}pts`,
              g: x.quality_score > f.quality_score,
              t: "Change in composite quality score. Driven by staffing, technology, physician alignment, and care management investments.",
            },
            {
              l: "Share Δ",
              v: `${x.market_share > f.market_share ? "+" : ""}${((x.market_share - f.market_share) * 100).toFixed(1)}pp`,
              g: x.market_share > f.market_share,
              t: "Change in local market share. Grows with quality, satisfaction, and strategic investment. Shrinks with poor quality or aggressive pricing.",
            },
            {
              l: "Readmissions",
              v: `${(x.readmission_rate * 100).toFixed(1)}%`,
              g: x.readmission_rate < f.readmission_rate,
              t: "Final year 30-day readmission rate. Below 13% avoids CMS penalties. Lower is better — indicates effective care management.",
            },
            {
              l: "Satisfaction",
              v: `${Math.round(x.patient_satisfaction)}/100`,
              g: x.patient_satisfaction > 60,
              t: "Final year patient satisfaction (HCAHPS proxy). Above 70 earns revenue bonuses. Driven by staffing, facilities, and care coordination.",
            },
          ].map(({ l, v, g: gd, t }) => (
            <div key={l} style={{ textAlign: "center", padding: "8px 0" }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  fontFamily: F.d,
                  color: gd ? C.good : C.bad,
                }}
              >
                {v}
              </div>
              <Tip text={t}>
                <div
                  style={{ fontSize: 9.5, color: C.textMuted, marginTop: 1 }}
                >
                  {l}
                </div>
              </Tip>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "12px 14px",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.textDim,
            marginBottom: 8,
          }}
        >
          Decisions & Consequences
        </div>
        {log.map((e, i) => (
          <div
            key={i}
            style={{
              padding: "8px 0",
              borderBottom:
                i < log.length - 1 ? `1px solid ${C.border}` : "none",
            }}
          >
            <div
              style={{ display: "flex", gap: 8, fontSize: 12, marginBottom: 3 }}
            >
              <span style={{ color: C.accent, fontWeight: 700, minWidth: 48 }}>
                {e.phase}
              </span>
              <span style={{ color: C.textDim }}>{e.decision}:</span>
              <span style={{ fontWeight: 600 }}>{e.choice}</span>
            </div>
            {snaps[i] && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  paddingLeft: 56,
                }}
              >
                {snaps[i]
                  .filter((s) => Math.abs(s.after - s.before) > 0.001)
                  .slice(0, 8)
                  .map((s) => {
                    const d = s.after - s.before,
                      up = d > 0,
                      m = MM[s.key],
                      good = m
                        ? m.h === "good"
                          ? up
                          : m.h === "bad"
                            ? !up
                            : null
                        : null;
                    const col =
                      good === true
                        ? C.good
                        : good === false
                          ? C.bad
                          : C.textMuted;
                    return (
                      <span
                        key={s.key}
                        style={{
                          fontSize: 9.5,
                          padding: "1px 7px",
                          borderRadius: 5,
                          background: `${col}12`,
                          color: col,
                          fontWeight: 600,
                        }}
                      >
                        {s.label} {up ? "+" : ""}
                        {fmtKey(s.key, d)}
                      </span>
                    );
                  })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CALIBRATION VIEW
// ═══════════════════════════════════════════════════════════════════
function CalibrationView({ onBack }: { onBack: () => void }) {
  const [results, setResults] = useState<CalibResult[]>([]);
  const [computing, setComputing] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const locs = PHASES[0].decisions[0].options;
    const owns = PHASES[0].decisions[1].options;
    const szs = PHASES[1].decisions[0].options;
    const segs: Array<{ loc: PhaseOption; own: PhaseOption; sz: PhaseOption }> =
      [];
    for (const loc of locs)
      for (const own of owns) for (const sz of szs) segs.push({ loc, own, sz });
    const total = segs.length;

    // Gather variable decision options (everything except location, ownership, size)
    const strats = PHASES[1].decisions[1].options;
    const phys = PHASES[2].decisions[0].options;
    const svcs = PHASES[2].decisions[1].options;
    const ambs = PHASES[3].decisions[0].options;
    const pays = PHASES[3].decisions[1].options;
    const staffs = PHASES[4].decisions[0].options;
    const techs = PHASES[4].decisions[1].options;
    const growths = PHASES[5].decisions[0].options;
    const caps = PHASES[5].decisions[1].options;

    let idx = 0;
    function next() {
      if (idx >= total) {
        setComputing(false);
        return;
      }
      const { loc, own, sz } = segs[idx];
      const base = clampAll(
        applyFx(
          applyFx(applyFx({ ...BASE_INPUTS }, loc.effects), own.effects),
          sz.effects,
        ),
      );
      const margins: number[] = [],
        profits: number[] = [],
        qualities: number[] = [],
        shares: number[] = [];

      for (const st of strats)
        for (const ph of phys)
          for (const sv of svcs)
            for (const am of ambs)
              for (const pa of pays)
                for (const sf of staffs)
                  for (const tc of techs)
                    for (const gr of growths)
                      for (const ca of caps) {
                        let inp = { ...base };
                        inp = applyFx(inp, st.effects);
                        inp = applyFx(inp, ph.effects);
                        inp = applyFx(inp, sv.effects);
                        inp = applyFx(inp, am.effects);
                        inp = applyFx(inp, pa.effects);
                        inp = applyFx(inp, sf.effects);
                        inp = applyFx(inp, tc.effects);
                        inp = applyFx(inp, gr.effects);
                        inp = applyFx(inp, ca.effects);
                        inp = clampAll(inp);
                        const v = evaluateFast(NODES, inp);
                        margins.push(v.operating_margin);
                        profits.push(v.profit);
                        qualities.push(v.quality_score);
                        shares.push(v.market_share);
                      }

      margins.sort((a, b) => a - b);
      profits.sort((a, b) => a - b);
      qualities.sort((a, b) => a - b);
      shares.sort((a, b) => a - b);
      const pct = (arr: number[], p: number) => arr[Math.floor(arr.length * p)];
      const avg = (arr: number[]) =>
        arr.reduce((s, v) => s + v, 0) / arr.length;

      setResults((r) => [
        ...r,
        {
          location: loc.label,
          ownership: own.label,
          size: sz.label,
          count: margins.length,
          margin: {
            min: margins[0],
            p25: pct(margins, 0.25),
            med: pct(margins, 0.5),
            avg: avg(margins),
            p75: pct(margins, 0.75),
            max: margins[margins.length - 1],
          },
          profit: {
            min: profits[0],
            p25: pct(profits, 0.25),
            med: pct(profits, 0.5),
            avg: avg(profits),
            p75: pct(profits, 0.75),
            max: profits[profits.length - 1],
          },
          quality: {
            min: qualities[0],
            avg: avg(qualities),
            max: qualities[qualities.length - 1],
          },
          share: {
            min: shares[0],
            avg: avg(shares),
            max: shares[shares.length - 1],
          },
        },
      ]);
      setProgress(idx + 1);
      idx++;
      setTimeout(next, 0);
    }
    setTimeout(next, 50);
  }, []);

  const mc = (v: number) => {
    if (v > 15) return `rgba(52,211,153,0.35)`;
    if (v > 10) return `rgba(52,211,153,0.25)`;
    if (v > 5) return `rgba(52,211,153,0.15)`;
    if (v > 0) return `rgba(52,211,153,0.07)`;
    if (v > -5) return `rgba(248,113,113,0.12)`;
    return `rgba(248,113,113,0.28)`;
  };
  const cs: CSSProperties = {
    padding: "6px 10px",
    fontSize: 11,
    fontFamily: "monospace",
    textAlign: "right",
    borderBottom: `1px solid ${C.border}`,
  };
  const hs: CSSProperties = {
    ...cs,
    textAlign: "center",
    fontWeight: 700,
    color: C.accent,
    fontSize: 10,
    letterSpacing: 0.5,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(135deg,${C.bg},#0d1525)`,
        color: C.text,
        fontFamily: F.b,
        padding: "24px 20px 60px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <button
          onClick={onBack}
          style={{
            background: "transparent",
            border: `1px solid ${C.borderLight}`,
            color: C.textDim,
            padding: "6px 16px",
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: F.b,
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          ← Back to Game
        </button>
        <h1
          style={{
            fontFamily: F.d,
            fontSize: 28,
            fontWeight: 500,
            margin: "0 0 4px",
          }}
        >
          🔬 Calibration View
        </h1>
        <p style={{ color: C.textDim, fontSize: 13, margin: "0 0 6px" }}>
          36 segments (3 locations × 3 ownerships × 4 sizes). Each segment
          enumerates all {(4 * 3 * 4 * 3 * 3 * 3 * 4 * 4 * 3).toLocaleString()}{" "}
          decision combinations.
        </p>
        <p style={{ color: C.textDim, fontSize: 12, margin: "0 0 16px" }}>
          All decisions applied simultaneously to base inputs (no drift, no
          events). Shows structural model response.
        </p>

        {computing && (
          <div
            style={{
              background: C.surfaceAlt,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: C.accent,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              Computing... {progress}/36 segments
            </div>
            <div style={{ height: 4, borderRadius: 2, background: C.border }}>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: C.accent,
                  width: `${(progress / 36) * 100}%`,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>
          <b style={{ color: C.textDim }}>Reference targets</b> (from industry
          data): Rural nonprofit small −2% to 3% · Suburban for-profit medium
          3%–12% · Urban government large −5% to 2% · Academic teaching 0%–4%
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: C.surface,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <thead>
              <tr style={{ background: C.surfaceAlt }}>
                <th style={{ ...hs, textAlign: "left", minWidth: 100 }}>
                  Location
                </th>
                <th style={{ ...hs, textAlign: "left", minWidth: 90 }}>
                  Ownership
                </th>
                <th style={{ ...hs, textAlign: "left", minWidth: 90 }}>Size</th>
                <th style={hs}>Min</th>
                <th style={hs}>P25</th>
                <th style={hs}>Median</th>
                <th style={hs}>Mean</th>
                <th style={hs}>P75</th>
                <th style={hs}>Max</th>
                <th style={hs}>Spread</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr
                  key={i}
                  style={{
                    background:
                      i % 2 === 0 ? "transparent" : C.surfaceAlt + "44",
                  }}
                >
                  <td
                    style={{
                      ...cs,
                      textAlign: "left",
                      color: C.textDim,
                      fontFamily: F.b,
                      fontWeight: 500,
                    }}
                  >
                    {r.location}
                  </td>
                  <td
                    style={{
                      ...cs,
                      textAlign: "left",
                      color: C.textDim,
                      fontFamily: F.b,
                      fontWeight: 500,
                    }}
                  >
                    {r.ownership}
                  </td>
                  <td
                    style={{
                      ...cs,
                      textAlign: "left",
                      color: C.textDim,
                      fontFamily: F.b,
                      fontSize: 10,
                    }}
                  >
                    {r.size}
                  </td>
                  <td style={{ ...cs, background: mc(r.margin.min) }}>
                    {r.margin.min.toFixed(1)}%
                  </td>
                  <td style={{ ...cs, background: mc(r.margin.p25) }}>
                    {r.margin.p25.toFixed(1)}%
                  </td>
                  <td
                    style={{
                      ...cs,
                      background: mc(r.margin.med),
                      fontWeight: 700,
                    }}
                  >
                    {r.margin.med.toFixed(1)}%
                  </td>
                  <td
                    style={{
                      ...cs,
                      background: mc(r.margin.avg),
                      fontWeight: 700,
                    }}
                  >
                    {r.margin.avg.toFixed(1)}%
                  </td>
                  <td style={{ ...cs, background: mc(r.margin.p75) }}>
                    {r.margin.p75.toFixed(1)}%
                  </td>
                  <td style={{ ...cs, background: mc(r.margin.max) }}>
                    {r.margin.max.toFixed(1)}%
                  </td>
                  <td style={{ ...cs, color: C.textMuted }}>
                    {(r.margin.max - r.margin.min).toFixed(1)}pp
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!computing && results.length > 0 && (
          <>
            <h2
              style={{
                fontFamily: F.d,
                fontSize: 20,
                fontWeight: 500,
                margin: "28px 0 8px",
              }}
            >
              Additional Metrics
            </h2>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  background: C.surface,
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <thead>
                  <tr style={{ background: C.surfaceAlt }}>
                    <th style={{ ...hs, textAlign: "left", minWidth: 100 }}>
                      Location
                    </th>
                    <th style={{ ...hs, textAlign: "left", minWidth: 90 }}>
                      Ownership
                    </th>
                    <th style={{ ...hs, textAlign: "left", minWidth: 90 }}>
                      Size
                    </th>
                    <th style={hs}>Profit Min</th>
                    <th style={hs}>Profit Med</th>
                    <th style={hs}>Profit Max</th>
                    <th style={hs}>Quality Avg</th>
                    <th style={hs}>Share Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr
                      key={i}
                      style={{
                        background:
                          i % 2 === 0 ? "transparent" : C.surfaceAlt + "44",
                      }}
                    >
                      <td
                        style={{
                          ...cs,
                          textAlign: "left",
                          color: C.textDim,
                          fontFamily: F.b,
                          fontWeight: 500,
                        }}
                      >
                        {r.location}
                      </td>
                      <td
                        style={{
                          ...cs,
                          textAlign: "left",
                          color: C.textDim,
                          fontFamily: F.b,
                          fontWeight: 500,
                        }}
                      >
                        {r.ownership}
                      </td>
                      <td
                        style={{
                          ...cs,
                          textAlign: "left",
                          color: C.textDim,
                          fontFamily: F.b,
                          fontSize: 10,
                        }}
                      >
                        {r.size}
                      </td>
                      <td
                        style={{
                          ...cs,
                          color: r.profit.min < 0 ? C.bad : C.good,
                        }}
                      >
                        {fv("$", r.profit.min)}
                      </td>
                      <td
                        style={{
                          ...cs,
                          color: r.profit.med < 0 ? C.bad : C.good,
                          fontWeight: 700,
                        }}
                      >
                        {fv("$", r.profit.med)}
                      </td>
                      <td
                        style={{
                          ...cs,
                          color: r.profit.max < 0 ? C.bad : C.good,
                        }}
                      >
                        {fv("$", r.profit.max)}
                      </td>
                      <td style={{ ...cs, color: C.accent }}>
                        {r.quality.avg.toFixed(0)}
                      </td>
                      <td style={{ ...cs, color: C.blue }}>
                        {(r.share.avg * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div
          style={{
            textAlign: "center",
            marginTop: 36,
            fontSize: 9.5,
            color: C.textMuted,
          }}
        >
          {results.length > 0 &&
            !computing &&
            `${results.length} segments · ${results.reduce((s, r) => s + r.count, 0).toLocaleString()} total combinations evaluated`}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN GAME
// ═══════════════════════════════════════════════════════════════════
export default function Game() {
  const [screen, setScreen] = useState("title");
  const [pi, setPi] = useState(0);
  const [inp, setInp] = useState<V>({ ...BASE_INPUTS });
  const [sels, setSels] = useState<Record<string, string>>({});
  const [hist, setHist] = useState<V[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [snaps, setSnaps] = useState<SnapEntry[][]>([]);
  const [news, setNews] = useState<string[]>([]);
  const [evt, setEvt] = useState<GameEvent | null>(null);
  const [dag, setDag] = useState(false);
  const [setupLoc, setSetupLoc] = useState<string | null>(null);
  const [setupOwn, setSetupOwn] = useState<string | null>(null);
  const [cids, setCids] = useState<string[]>([]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen, pi]);

  const phase = PHASES[pi];
  const done = phase ? phase.decisions.every((d) => sels[d.id]) : false;

  const confirm = useCallback(() => {
    let ni = { ...inp };
    const nl: LogEntry[] = [],
      ns: SnapEntry[][] = [];
    let loc = setupLoc,
      own = setupOwn;
    const nc = [...cids];
    for (const d of phase.decisions) {
      const o = d.options.find((o) => o.id === sels[d.id]);
      if (!o) continue;
      if (d.id === "location") loc = o.id;
      if (d.id === "ownership") own = o.id;
      nc.push(o.id);
      const bef = evaluate(NODES, clampAll({ ...ni })).vals;
      ni = applyFx(ni, o.effects);
      const aft = evaluate(NODES, clampAll({ ...ni })).vals;
      const impacts = [];
      for (const [k, m] of Object.entries(MM))
        if (
          bef[k] != null &&
          aft[k] != null &&
          Math.abs(aft[k] - bef[k]) > 0.001
        )
          impacts.push({ key: k, label: m.l, before: bef[k], after: aft[k] });
      ns.push(impacts);
      nl.push({
        phase: pi <= 1 ? "Setup" : `Year ${pi}`,
        decision: d.title,
        choice: o.label,
      });
    }
    ni = clampAll(ni);
    const nw = phase.decisions.map((d) => NEWS[sels[d.id]]).filter(Boolean);
    if (loc) setSetupLoc(loc);
    if (own) setSetupOwn(own);
    setCids(nc);
    if (pi === 0) {
      setInp(ni);
      setLog((l) => [...l, ...nl]);
      setSnaps((s) => [...s, ...ns]);
      setNews((n) => [...n, ...nw]);
      setSels({});
      setPi(1);
      return;
    }
    let event = null;
    if (pi >= 2) {
      const seed = nc.reduce(
        (s, c, i) =>
          s + c.charCodeAt(0) * (i + 1) * 7 + (c.charCodeAt(c.length - 1) || 0),
        pi * 31,
      );
      event = pickEvent(pi, loc || "suburban", own || "nonprofit", seed);
      if (event) ni = applyFx(ni, event.fx);
    }
    ni = clampAll(ni);
    const result = evaluate(NODES, ni).vals;
    if (pi >= 1) ni = drift(ni);
    ni = clampAll(ni);
    setInp(ni);
    setHist((h) => [...h, result]);
    setLog((l) => [...l, ...nl]);
    setSnaps((s) => [...s, ...ns]);
    setNews(nw);
    setEvt(event);
    setSels({});
    setScreen("results");
  }, [inp, phase, pi, sels, setupLoc, setupOwn, cids]);

  const next = useCallback(() => {
    if (pi >= PHASES.length - 1) {
      setScreen("final");
      return;
    }
    setPi((p) => p + 1);
    setScreen("decision");
    setDag(false);
  }, [pi]);
  const restart = useCallback(() => {
    setScreen("title");
    setPi(0);
    setInp({ ...BASE_INPUTS });
    setSels({});
    setHist([]);
    setLog([]);
    setSnaps([]);
    setNews([]);
    setEvt(null);
    setDag(false);
    setSetupLoc(null);
    setSetupOwn(null);
    setCids([]);
  }, []);

  const proj =
    hist.length > 0 && pi < PHASES.length - 1
      ? evaluate(NODES, clampAll({ ...inp })).vals
      : null;

  if (screen === "title")
    return (
      <div
        style={{
          minHeight: "100vh",
          background: `linear-gradient(135deg,${C.bg},#0d1525,#0a1020)`,
          color: C.text,
          fontFamily: F.b,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "85vh",
            textAlign: "center",
            padding: "40px 20px",
          }}
        >
          <div
            style={{
              fontSize: 12,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: C.accent,
              fontWeight: 600,
              marginBottom: 18,
            }}
          >
            Hospital Economics Simulator
          </div>
          <h1
            style={{
              fontFamily: F.d,
              fontSize: 52,
              fontWeight: 500,
              margin: "0 0 14px",
              lineHeight: 1.1,
              fontStyle: "italic",
            }}
          >
            The Margin
            <br />
            <span style={{ color: C.accent }}>Game</span>
          </h1>
          <p
            style={{
              color: C.textDim,
              fontSize: 16,
              maxWidth: 480,
              margin: "0 0 36px",
              lineHeight: 1.6,
              fontWeight: 300,
            }}
          >
            Build and run a hospital over five years. Navigate razor-thin
            margins, payer politics, quality mandates, and the tension between
            profit and mission.
          </p>
          <button
            onClick={() => setScreen("decision")}
            style={{
              padding: "14px 44px",
              borderRadius: 12,
              border: "none",
              background: C.accent,
              color: C.bg,
              fontFamily: F.b,
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Begin →
          </button>
          <div
            style={{
              marginTop: 24,
              fontSize: 10,
              color: C.textMuted,
              maxWidth: 360,
            }}
          >
            Based on real US hospital economics. ~2% avg margin, ~$1.6T total
            spend.
          </div>
        </div>
      </div>
    );

  if (screen === "calibration")
    return <CalibrationView onBack={() => setScreen("title")} />;

  const pTotal = PHASES.length + 1,
    pVal =
      screen === "final" ? pTotal - 1 : pi + (screen === "results" ? 0.5 : 0);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(135deg,${C.bg},#0d1525,#0a1020)`,
        color: C.text,
        fontFamily: F.b,
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
      <div
        style={{ maxWidth: 940, margin: "0 auto", padding: "18px 18px 50px" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", gap: 4, flex: 1 }}>
            {Array.from({ length: pTotal }, (_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background:
                    i < pVal ? C.accent : i < pVal + 1 ? C.accentDim : C.border,
                  transition: "all 0.3s",
                }}
              />
            ))}
          </div>
          <button
            onClick={() => setDag((v) => !v)}
            style={{
              marginLeft: 10,
              padding: "3px 10px",
              borderRadius: 7,
              border: `1px solid ${dag ? C.accent : C.borderLight}`,
              background: dag ? C.accentBg : "transparent",
              color: dag ? C.accent : C.textMuted,
              fontSize: 10.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: F.b,
            }}
          >
            🔧 {dag ? "Hide" : "Show"} Model
          </button>
        </div>
        {dag && (
          <div style={{ marginBottom: 16 }}>
            <DAGViewer inputs={inp} log={log} snaps={snaps} />
          </div>
        )}

        {screen === "decision" && phase && (
          <>
            <div
              style={{
                display: "inline-block",
                padding: "3px 11px",
                borderRadius: 14,
                background: C.accentBg,
                border: `1px solid ${C.accentDim}`,
                color: C.accent,
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              {pi === 0
                ? "Hospital Setup"
                : pi === 1
                  ? "Year 1 Foundation"
                  : `Year ${pi} Strategy`}
            </div>
            <h1
              style={{
                fontFamily: F.d,
                fontSize: 30,
                fontWeight: 500,
                margin: "0 0 3px",
                lineHeight: 1.2,
              }}
            >
              {phase.title}
            </h1>
            <p
              style={{
                color: C.textDim,
                fontSize: 14,
                margin: "0 0 24px",
                fontWeight: 300,
              }}
            >
              {phase.subtitle}
            </p>
            {phase.decisions.map((dec) => (
              <div key={dec.id} style={{ marginBottom: 26 }}>
                <h2
                  style={{
                    fontFamily: F.d,
                    fontSize: 18,
                    fontWeight: 500,
                    margin: "0 0 2px",
                  }}
                >
                  {dec.title}
                </h2>
                <p
                  style={{ color: C.textDim, fontSize: 12, margin: "0 0 12px" }}
                >
                  {dec.description}
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      dec.options.length <= 3
                        ? `repeat(${dec.options.length},1fr)`
                        : "1fr 1fr",
                    gap: 9,
                  }}
                >
                  {dec.options.map((opt) => {
                    const sel = sels[dec.id] === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() =>
                          setSels((s) => ({ ...s, [dec.id]: opt.id }))
                        }
                        style={{
                          background: sel ? C.accentBg : C.surface,
                          border: `1.5px solid ${sel ? C.accent : C.border}`,
                          borderRadius: 10,
                          padding: "12px 14px",
                          cursor: "pointer",
                          transition: "all 0.15s",
                          position: "relative",
                        }}
                      >
                        {sel && (
                          <div
                            style={{
                              position: "absolute",
                              top: 7,
                              right: 9,
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              background: C.accent,
                              color: C.bg,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            ✓
                          </div>
                        )}
                        <div style={{ fontSize: 18, marginBottom: 3 }}>
                          {opt.icon}
                        </div>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 13,
                            marginBottom: 2,
                          }}
                        >
                          {opt.label}
                        </div>
                        <p
                          style={{
                            color: C.textDim,
                            fontSize: 11,
                            margin: 0,
                            lineHeight: 1.45,
                          }}
                        >
                          {opt.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 12,
              }}
            >
              <button
                onClick={done ? confirm : undefined}
                style={{
                  padding: "10px 22px",
                  borderRadius: 9,
                  border: "none",
                  cursor: done ? "pointer" : "default",
                  background: done ? C.accent : C.surfaceAlt,
                  color: done ? C.bg : C.textMuted,
                  fontFamily: F.b,
                  fontWeight: 700,
                  fontSize: 13,
                  opacity: done ? 1 : 0.5,
                }}
              >
                {pi === 0
                  ? "Continue to Foundation →"
                  : pi === 1
                    ? "Launch Year 1 →"
                    : `Commit Year ${pi} →`}
              </button>
            </div>
          </>
        )}

        {screen === "results" && (
          <>
            <div
              style={{
                display: "inline-block",
                padding: "3px 11px",
                borderRadius: 14,
                background: C.accentBg,
                border: `1px solid ${C.accentDim}`,
                color: C.accent,
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Year {pi} Results
            </div>
            <h1
              style={{
                fontFamily: F.d,
                fontSize: 30,
                fontWeight: 500,
                margin: "0 0 3px",
              }}
            >
              Year {pi} Results
            </h1>
            <p
              style={{
                color: C.textDim,
                fontSize: 13,
                margin: "0 0 18px",
                fontWeight: 300,
              }}
            >
              {hist[hist.length - 1]?.profit > 0
                ? "Your hospital finished the year in the black."
                : "The year closed with a loss."}
            </p>
            {evt && (
              <div
                style={{
                  background: "rgba(251,191,36,0.06)",
                  border: "1px solid rgba(251,191,36,0.2)",
                  borderLeft: `3px solid ${C.warn}`,
                  borderRadius: 9,
                  padding: "10px 14px",
                  marginBottom: 14,
                  fontSize: 12,
                  color: C.warn,
                }}
              >
                {evt.text}
              </div>
            )}
            {news.length > 0 && (
              <div
                style={{
                  background: C.surfaceAlt,
                  border: `1px solid ${C.border}`,
                  borderLeft: `3px solid ${C.accent}`,
                  borderRadius: 9,
                  padding: "10px 14px",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 9.5,
                    color: C.accent,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  {pi === 1 ? "🏥 Hospital Profile" : "📰 Year in Review"}
                </div>
                {news.map((n, i) => (
                  <p
                    key={i}
                    style={{
                      color: C.textDim,
                      fontSize: 12,
                      margin: "3px 0",
                      lineHeight: 1.5,
                    }}
                  >
                    {n}
                  </p>
                ))}
              </div>
            )}
            <Dashboard history={hist} projection={proj} />
            {proj && pi < PHASES.length - 1 && (
              <div
                style={{
                  background: C.surfaceAlt,
                  border: `1px dashed ${C.borderLight}`,
                  borderRadius: 9,
                  padding: "10px 14px",
                  marginTop: 14,
                  fontSize: 11.5,
                }}
              >
                <span style={{ color: C.blue, fontWeight: 700 }}>
                  Year {pi + 1} outlook:
                </span>
                <span style={{ color: C.textDim, marginLeft: 6 }}>
                  Revenue {fv("$", proj.total_revenue)} · Costs{" "}
                  {fv("$", proj.total_costs)} · Margin{" "}
                  {proj.operating_margin.toFixed(1)}%
                </span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 18,
              }}
            >
              <button
                onClick={next}
                style={{
                  padding: "10px 22px",
                  borderRadius: 9,
                  border: "none",
                  background: C.accent,
                  color: C.bg,
                  fontFamily: F.b,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {pi < PHASES.length - 1
                  ? `Proceed to Year ${pi + 1} →`
                  : "View Final Report →"}
              </button>
            </div>
          </>
        )}

        {screen === "final" && (
          <>
            <div
              style={{
                display: "inline-block",
                padding: "3px 11px",
                borderRadius: 14,
                background: C.accentBg,
                border: `1px solid ${C.accentDim}`,
                color: C.accent,
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Final Report
            </div>
            <h1
              style={{
                fontFamily: F.d,
                fontSize: 30,
                fontWeight: 500,
                margin: "0 0 3px",
              }}
            >
              Five-Year Review
            </h1>
            <p
              style={{
                color: C.textDim,
                fontSize: 13,
                margin: "0 0 20px",
                fontWeight: 300,
              }}
            >
              Profit, quality, and community impact.
            </p>
            <Final history={hist} log={log} snaps={snaps} />
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: 24,
              }}
            >
              <button
                onClick={restart}
                style={{
                  padding: "10px 24px",
                  borderRadius: 9,
                  border: "none",
                  background: C.accent,
                  color: C.bg,
                  fontFamily: F.b,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Play Again ↺
              </button>
            </div>
          </>
        )}

        <div
          style={{
            textAlign: "center",
            marginTop: 36,
            padding: "10px 0",
            borderTop: `1px solid ${C.border}`,
            fontSize: 9.5,
            color: C.textMuted,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>
            The Margin Game · Real US hospital economics · Not financial advice
          </span>
          <button
            onClick={() => setScreen("calibration")}
            style={{
              background: "transparent",
              border: `1px solid ${C.borderLight}`,
              color: C.textMuted,
              padding: "3px 10px",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: F.b,
              fontSize: 9.5,
              fontWeight: 600,
            }}
          >
            🔬 Calibration
          </button>
        </div>
      </div>
    </div>
  );
}
