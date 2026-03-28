# Hospital Model

- **Architecture:** AST-based — single `NODES` array (~60 nodes) is the sole source of truth; generic `evaluate(nodes, inputs)` engine traverses it; DAG viewer reads same array (zero drift)
- **Node format:** `{ id, group, label, fmt, deps, fn({named_deps}), show({named_deps}) }` — named destructured params prevent mis-ordering
- **DAG viewer:** Hover highlights upstream (blue) / downstream (orange) via `getAncestors`/`getDescendants` on derived `DAG_EDGES`; click input nodes to expand decision modification trail
- **Revenue model:** `admissions × payer_share × avg_drg × payer_multiplier`, summed across 5 payers; outpatient = IP × ratio; other = `teaching_rev + other_rev × (beds/200)` — the beds scaling prevents small hospitals from getting outsized DSH
- **Cost model:** `case_cost = base_cost_per_case × CMI^0.92 × market_cost_adj × rate_cost_adj`, then split into 6 categories (labor 56%, supplies 11%, drugs 8%, admin 10%, capital 5%, other 10%) with per-category multipliers
- **Key cost mechanisms:**
  - `CMI_COST_EXP = 0.92` — costs scale nearly linearly with CMI (revenue scales linearly, so margin premium from CMI is small)
  - `market_cost_adj = max(1.0, 1 + (commercial_share − 0.30) × 1.0)` — floored at 1.0, only increases costs in rich commercial markets
  - `rate_cost_adj = max(1.0, 1 + (commercial_mult − 2.2) × 0.35)` — 35% of rate premium above baseline flows to costs; also floored at 1.0
  - `cost_revenue_linked = gross_revenue × 15%` — outside efficiency_mult, cannot be optimized away; represents admin/compliance/physician incentives scaling with revenue; structurally caps max margin ~15%
  - `total_costs = structural_costs × efficiency_mult + revenue_linked_cost`
- **Location effects on costs:** Rural `base_cost × 0.85`, Urban `base_cost × 1.05`, Suburban = baseline
- **Bounds enforcement:** `BOUNDS` object covers all ~30 inputs; payer shares clamped then normalized; key caps: `efficiency_mult [0.88, 1.12]`, `outpatient_ratio [0.20, 0.55]`
- **Decision effects:** Applied as `set`, `mult:X`, or `add:X` on input variables; went through 3 rounds of calibration cuts (~50% reduction each round on CMI and commercial_mult additions)
- **Annual drift:** Cost inflation 3.5%, Medicare rate update 2%, Medicare share creep +0.4pp, quality-driven market share shifts
- **Calibration targets:** Default community NP ~2%, suburban FP medium ~5–7%, rural gov small −5% to 0%, urban gov large −10% to −5%; medians achieved within range, spreads 40–60pp (theoretical max combos), maxes ~25–35% (acceptable as theoretical ceiling)
