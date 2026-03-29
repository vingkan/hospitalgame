import { useState, useMemo } from "react";
import type { V, LogEntry, SnapEntry, GameNode } from "../model/types";
import { NODES, DAG_EDGES, fmtKey } from "../model/nodes";
import { fmtNode } from "../model/format";
import { evaluate } from "../model/engine";
import { MM } from "../config/metrics";
import { C, F } from "./theme";

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

export function DAGViewer({
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
