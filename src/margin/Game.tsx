import { useState, useCallback, useEffect } from "react";
import type { V, GameEvent, LogEntry, SnapEntry } from "./model/types";
import { NODES } from "./model/nodes";
import { fv } from "./model/format";
import { evaluate } from "./model/engine";
import { clampAll } from "./model/bounds";
import { applyFx, drift, pickEvent } from "./model/effects";
import { PHASES } from "./config/phases";
import { EVENTS } from "./config/events";
import { NEWS } from "./config/news";
import { BASE_INPUTS } from "./config/inputs";
import { MM } from "./config/metrics";
import { C, F } from "./ui/theme";
import { DAGViewer } from "./ui/DAGViewer";
import { Dashboard } from "./ui/Dashboard";
import { Final } from "./ui/Final";
import { CalibrationView } from "./ui/CalibrationView";

export default function Game({ onBack }: { onBack?: () => void }) {
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
      event = pickEvent(EVENTS, pi, loc || "suburban", own || "nonprofit", seed);
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
          {onBack && (
            <button
              onClick={onBack}
              style={{
                marginTop: 18,
                background: "none",
                border: "none",
                color: C.textMuted,
                fontFamily: F.b,
                fontSize: 13,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              ← Back to Menu
            </button>
          )}
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
