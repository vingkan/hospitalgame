import type { V } from "../model/types";
import { NODES } from "../model/nodes";
import { fv } from "../model/format";
import { cl } from "../model/utils";
import { MM } from "../config/metrics";
import { C } from "./theme";

export function delta(key: string, cur: number, prev: number) {
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

export function grade(h: V[]) {
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
