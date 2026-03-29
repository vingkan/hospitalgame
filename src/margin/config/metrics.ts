export const MM: Record<string, { l: string; h: string; t: string }> = {
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
