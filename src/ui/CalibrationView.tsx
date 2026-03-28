import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import type { CalibResult, PhaseOption } from "../model/types";
import { evaluateFast } from "../model/engine";
import { NODES } from "../model/nodes";
import { fv } from "../model/format";
import { clampAll } from "../model/bounds";
import { applyFx } from "../model/effects";
import { PHASES } from "../config/phases";
import { BASE_INPUTS } from "../config/inputs";
import { C, F } from "./theme";

export function CalibrationView({ onBack }: { onBack: () => void }) {
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
