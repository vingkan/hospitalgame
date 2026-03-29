# The Margin Game

A hospital financial simulation where players run a hospital over 5 years, making strategic decisions about payer mix, staffing, service lines, and more.

## Architecture

- `Game.tsx` — Main component. Manages all state via a screen-based state machine (title → decision → results → final). No router.
- `model/nodes.ts` — AST-based financial model. The `NODES` array is the sole source of truth; a generic DAG engine (`model/engine.ts`) evaluates it.
- `config/` — Game phases, inputs, events, news, and metric metadata.
- `ui/` — Presentational components (Dashboard, DAGViewer, Final, CalibrationView, KPI, Tip) and theme constants.

## Domain reference

See `docs/` within this folder for healthcare economics background, game design spec, and model architecture docs.
