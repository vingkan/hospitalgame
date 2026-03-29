import type { GameEvent } from "../model/types";

export const EVENTS: GameEvent[] = [
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
    text: "📰 Major employer relocates HQ to your suburb — insured population surges.",
    fx: { commercial_share: "add:0.03", occupancy_rate: "add:0.03" },
  },
  {
    yr: 2,
    loc: ["urban"],
    text: "📰 State mandates nurse staffing ratios. Labor costs spike.",
    fx: { labor_mult: "mult:1.06", quality_score: "add:3" },
  },
  {
    yr: 2,
    loc: ["urban"],
    text: "📰 A major insurer drops your hospital from their network.",
    fx: { commercial_share: "add:-0.04", market_share: "add:-0.03" },
  },
  {
    yr: 3,
    own: ["nonprofit"],
    text: "📰 Local foundation gifts $8M for community health programs.",
    fx: { other_revenue: "add:8000000", community_benefit: "add:10" },
  },
  {
    yr: 3,
    own: ["forprofit"],
    text: "📰 Private equity owners push for margin improvement.",
    fx: { efficiency_mult: "mult:0.97", community_benefit: "add:-8" },
  },
  {
    yr: 3,
    own: ["government"],
    text: "📰 County budget shortfall threatens appropriation.",
    fx: { other_revenue: "add:-4000000", fixed_costs: "mult:0.97" },
  },
  {
    yr: 3,
    text: "📰 CMS announces site-neutral payment expansion.",
    fx: { outpatient_ratio: "add:0.02" },
  },
  {
    yr: 4,
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
