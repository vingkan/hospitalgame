# Game App

- **Stack:** Single-file React (JSX artifact), Recharts, Google Fonts (Fraunces + Manrope), dark theme with teal accents
- **Flow:** Title → Phase 0 (location + ownership, no results shown) → Phase 1 (size + strategy) → Year 1 Results → Years 2–5 (2 decisions each → results) → Final Report with letter grade
- **Decision phases:** Setup (location, ownership, size, strategy), then per-year pairs covering physician alignment, service lines, ambulatory strategy, payer negotiation, staffing, technology, growth, capital allocation
- **Results dashboard:** KPI cards (profit, margin, quality, market share) with YoY deltas + revenue/cost/payer/metrics tables using `<table>` layout with right-aligned value and delta columns + financial trend chart (revenue vs costs only, no profit line)
- **Tooltips:** Viewport-aware positioning (checks all 4 edges via `getBoundingClientRect`), defined in centralized `MM` metadata object with polarity (`higher: "good"|"bad"|"neutral"`) for delta coloring
- **Context-sensitive market events:** ~18 events tagged by `loc`/`own`, one fires per year (2–5), selected deterministically via hash of prior choice IDs
- **Final report:** Radar chart (5 axes), 5-year line chart (quality line = pink), scorecard with tooltips, decisions table with impact badges from before/after model snapshots
- **Grade formula:** `quality(35%) + market_share(25%) + margin(25%) + community(15%)`, margin denominator = 5% (full credit at 5%+), thresholds A>70 B>55 C>40 D>25
- **Scroll to top** on every screen/phase transition via `useEffect`
- **Calibration view:** Accessible from footer button, enumerates all 62,208 decision combos per segment (36 segments = 3 loc × 3 own × 4 size), shows min/P25/median/mean/P75/max margin heatmap table, computed progressively with `setTimeout` chunking
- **Transpilation gotcha:** `return<JSX>` (no space) breaks — transpiler merges `return` + `React` into `returnReact`
