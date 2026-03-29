# src/ structure

- `main.tsx` — Shared menu/launcher that renders game tiles. Each game is lazy-loaded when selected.
- `reset.css` — Shared CSS reset used by all games.
- Each subfolder (e.g. `margin/`) is an independent, self-contained game. Games do not share code with each other. Do not assume that patterns, types, or conventions from one game apply to another.
