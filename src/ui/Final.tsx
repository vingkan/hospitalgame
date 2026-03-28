import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import type { V, LogEntry, SnapEntry } from "../model/types";
import { fv } from "../model/format";
import { fmtKey } from "../model/nodes";
import { cl } from "../model/utils";
import { MM } from "../config/metrics";
import { C, F } from "./theme";
import { grade } from "./helpers";
import { Tip } from "./Tip";

export function Final({
  history: h,
  log,
  snaps,
}: {
  history: V[];
  log: LogEntry[];
  snaps: SnapEntry[][];
}) {
  const g = grade(h),
    x = h[h.length - 1],
    f = h[0],
    tp = h.reduce((s, v) => s + v.profit, 0),
    am = h.reduce((s, v) => s + v.operating_margin, 0) / h.length;
  const rd = [
    { m: "Profit", v: cl((x.operating_margin / 12) * 100, 0, 100) },
    { m: "Quality", v: x.quality_score },
    { m: "Market", v: cl((x.market_share / 0.5) * 100, 0, 100) },
    { m: "Satisfaction", v: x.patient_satisfaction },
    { m: "Community", v: x.community_benefit },
  ];
  const cd = h.map((v, i) => ({
    yr: `Y${i + 1}`,
    profit: +(v.profit / 1e6).toFixed(1),
    quality: Math.round(v.quality_score),
    share: Math.round(v.market_share * 100),
  }));
  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 80,
            height: 80,
            borderRadius: "50%",
            border: `3px solid ${g.c}`,
            fontSize: 40,
            fontFamily: F.d,
            fontWeight: 700,
            color: g.c,
            marginBottom: 8,
          }}
        >
          {g.l}
        </div>
        <div style={{ fontSize: 18, fontFamily: F.d, fontWeight: 500 }}>
          {g.n} Performance
        </div>
        <div style={{ color: C.textDim, fontSize: 12, marginTop: 3 }}>
          5-Year Profit:{" "}
          <span style={{ color: tp > 0 ? C.good : C.bad, fontWeight: 700 }}>
            {fv("$", tp)}
          </span>{" "}
          · Avg Margin:{" "}
          <span style={{ fontWeight: 700 }}>{am.toFixed(1)}%</span>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            display: "flex",
            justifyContent: "center",
            padding: "10px 0",
          }}
        >
          <ResponsiveContainer width="100%" height={210}>
            <RadarChart data={rd} cx="50%" cy="50%" outerRadius="65%">
              <PolarGrid stroke={C.border} />
              <PolarAngleAxis
                dataKey="m"
                tick={{ fontSize: 10, fill: C.textDim }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <Radar
                dataKey="v"
                stroke={C.accent}
                fill={C.accent}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "12px 6px 6px 0",
          }}
        >
          <div
            style={{
              paddingLeft: 16,
              fontSize: 11,
              fontWeight: 600,
              color: C.textDim,
              marginBottom: 3,
            }}
          >
            5-Year Journey
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={cd}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="yr" stroke={C.textMuted} fontSize={10} />
              <YAxis yAxisId="l" stroke={C.textMuted} fontSize={9} />
              <YAxis
                yAxisId="r"
                orientation="right"
                stroke={C.textMuted}
                fontSize={9}
              />
              <RTooltip
                contentStyle={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  fontSize: 10,
                }}
              />
              <Line
                yAxisId="l"
                type="monotone"
                dataKey="profit"
                stroke={C.good}
                strokeWidth={2.5}
                name="Profit $M"
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="r"
                type="monotone"
                dataKey="quality"
                stroke={C.pink}
                strokeWidth={2}
                name="Quality"
                dot={{ r: 2 }}
              />
              <Line
                yAxisId="r"
                type="monotone"
                dataKey="share"
                stroke={C.blue}
                strokeWidth={2}
                name="Share %"
                dot={{ r: 2 }}
              />
              <Legend wrapperStyle={{ fontSize: 9 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "12px 14px",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.textDim,
            marginBottom: 8,
          }}
        >
          Scorecard
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 10,
          }}
        >
          {[
            {
              l: "Revenue Growth",
              v: `${((x.total_revenue / f.total_revenue - 1) * 100).toFixed(0)}%`,
              g: x.total_revenue > f.total_revenue,
              t: "Total revenue change from Year 1 to Year 5. Driven by payer mix, CMI, outpatient growth, and volume.",
            },
            {
              l: "Margin Δ",
              v: `${(x.operating_margin - f.operating_margin).toFixed(1)}pp`,
              g: x.operating_margin > f.operating_margin,
              t: "Change in operating margin (profit/revenue). Positive means you improved efficiency relative to revenue.",
            },
            {
              l: "Quality Δ",
              v: `${x.quality_score > f.quality_score ? "+" : ""}${(x.quality_score - f.quality_score).toFixed(0)}pts`,
              g: x.quality_score > f.quality_score,
              t: "Change in composite quality score. Driven by staffing, technology, physician alignment, and care management investments.",
            },
            {
              l: "Share Δ",
              v: `${x.market_share > f.market_share ? "+" : ""}${((x.market_share - f.market_share) * 100).toFixed(1)}pp`,
              g: x.market_share > f.market_share,
              t: "Change in local market share. Grows with quality, satisfaction, and strategic investment. Shrinks with poor quality or aggressive pricing.",
            },
            {
              l: "Readmissions",
              v: `${(x.readmission_rate * 100).toFixed(1)}%`,
              g: x.readmission_rate < f.readmission_rate,
              t: "Final year 30-day readmission rate. Below 13% avoids CMS penalties. Lower is better — indicates effective care management.",
            },
            {
              l: "Satisfaction",
              v: `${Math.round(x.patient_satisfaction)}/100`,
              g: x.patient_satisfaction > 60,
              t: "Final year patient satisfaction (HCAHPS proxy). Above 70 earns revenue bonuses. Driven by staffing, facilities, and care coordination.",
            },
          ].map(({ l, v, g: gd, t }) => (
            <div key={l} style={{ textAlign: "center", padding: "8px 0" }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  fontFamily: F.d,
                  color: gd ? C.good : C.bad,
                }}
              >
                {v}
              </div>
              <Tip text={t}>
                <div
                  style={{ fontSize: 9.5, color: C.textMuted, marginTop: 1 }}
                >
                  {l}
                </div>
              </Tip>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "12px 14px",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.textDim,
            marginBottom: 8,
          }}
        >
          Decisions & Consequences
        </div>
        {log.map((e, i) => (
          <div
            key={i}
            style={{
              padding: "8px 0",
              borderBottom:
                i < log.length - 1 ? `1px solid ${C.border}` : "none",
            }}
          >
            <div
              style={{ display: "flex", gap: 8, fontSize: 12, marginBottom: 3 }}
            >
              <span style={{ color: C.accent, fontWeight: 700, minWidth: 48 }}>
                {e.phase}
              </span>
              <span style={{ color: C.textDim }}>{e.decision}:</span>
              <span style={{ fontWeight: 600 }}>{e.choice}</span>
            </div>
            {snaps[i] && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  paddingLeft: 56,
                }}
              >
                {snaps[i]
                  .filter((s) => Math.abs(s.after - s.before) > 0.001)
                  .slice(0, 8)
                  .map((s) => {
                    const d = s.after - s.before,
                      up = d > 0,
                      m = MM[s.key],
                      good = m
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
                      <span
                        key={s.key}
                        style={{
                          fontSize: 9.5,
                          padding: "1px 7px",
                          borderRadius: 5,
                          background: `${col}12`,
                          color: col,
                          fontWeight: 600,
                        }}
                      >
                        {s.label} {up ? "+" : ""}
                        {fmtKey(s.key, d)}
                      </span>
                    );
                  })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
