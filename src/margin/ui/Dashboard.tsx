import type { CSSProperties } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { V } from "../model/types";
import { fv } from "../model/format";
import { fmtKey } from "../model/nodes";
import { MM } from "../config/metrics";
import { C } from "./theme";
import { delta } from "./helpers";
import { Tip } from "./Tip";
import { KPI } from "./KPI";

export function Dashboard({
  history,
  projection,
}: {
  history: V[];
  projection: V | null;
}) {
  const c = history[history.length - 1],
    p = history.length > 1 ? history[history.length - 2] : null;
  const cd = history.map((h, i) => ({
    yr: `Y${i + 1}`,
    rev: h.total_revenue / 1e6,
    cost: h.total_costs / 1e6,
  }));
  if (projection)
    cd.push({
      yr: `Y${history.length + 1}`,
      rev: projection.total_revenue / 1e6,
      cost: projection.total_costs / 1e6,
    });

  const ts: CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
  };
  const tdL: CSSProperties = {
    padding: "3px 0",
    color: C.textDim,
    fontSize: 12,
  };
  const tdV: CSSProperties = {
    padding: "3px 0",
    textAlign: "right",
    fontWeight: 600,
    fontFamily: "monospace",
    fontSize: 11.5,
  };
  const tdD: CSSProperties = {
    padding: "3px 0",
    textAlign: "right",
    fontSize: 9.5,
    fontWeight: 600,
    width: 65,
  };

  const TRow = ({
    label,
    tip,
    value,
    d,
    color,
  }: {
    label: string;
    tip: string;
    value: string;
    d: { arrow: string; lbl: string; col: string } | null;
    color?: string;
  }) => (
    <tr>
      <td style={tdL}>
        <Tip text={tip}>
          <span>
            {color && (
              <span
                style={{
                  display: "inline-block",
                  width: 7,
                  height: 7,
                  borderRadius: 2,
                  background: color,
                  marginRight: 6,
                }}
              />
            )}
            {label}
          </span>
        </Tip>
      </td>
      <td style={tdV}>{value}</td>
      <td style={tdD}>
        {d && (
          <span style={{ color: d.col }}>
            {d.arrow} {d.lbl}
          </span>
        )}
      </td>
    </tr>
  );

  return (
    <div>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}
      >
        <KPI k="profit" v={c.profit} pv={p?.profit} icon="💰" />
        <KPI
          k="operating_margin"
          v={c.operating_margin}
          pv={p?.operating_margin}
          icon="📊"
        />
        <KPI
          k="quality_score"
          v={c.quality_score}
          pv={p?.quality_score}
          icon="⭐"
        />
        <KPI
          k="market_share"
          v={c.market_share}
          pv={p?.market_share}
          icon="📈"
        />
      </div>
      {cd.length > 1 && (
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "12px 6px 6px 0",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingLeft: 18,
              marginBottom: 4,
              fontSize: 11,
            }}
          >
            <Tip text="Revenue and costs over time. The gap between lines is your margin.">
              <span style={{ fontWeight: 600, color: C.textDim }}>
                Financial Trend ($M)
              </span>
            </Tip>
            {projection && (
              <span style={{ color: C.textMuted, fontSize: 9.5 }}>
                last point = outlook
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={175}>
            <AreaChart data={cd}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="yr" stroke={C.textMuted} fontSize={10} />
              <YAxis stroke={C.textMuted} fontSize={9} />
              <RTooltip
                contentStyle={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  fontSize: 11,
                }}
                formatter={(v) => `$${Number(v).toFixed(1)}M`}
              />
              <Area
                type="monotone"
                dataKey="rev"
                stroke={C.blue}
                fill="none"
                strokeWidth={2.5}
                name="Revenue"
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke={C.orange}
                fill="none"
                strokeWidth={2.5}
                name="Costs"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "12px 14px",
          }}
        >
          <Tip text="Revenue by source.">
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.textDim,
                display: "block",
                marginBottom: 4,
              }}
            >
              Revenue
            </span>
          </Tip>
          <table style={ts}>
            <tbody>
              {[
                ["rev_commercial", C.good],
                ["rev_medicare", C.blue],
                ["rev_ma", C.purple],
                ["rev_medicaid", C.orange],
                ["rev_self_pay", C.pink],
                ["rev_outpatient", C.accent],
                ["rev_other", C.warn],
              ].map(([k, col]) => (
                <TRow
                  key={k}
                  label={MM[k]?.l}
                  tip={MM[k]?.t}
                  value={fv("$", c[k])}
                  d={p ? delta(k, c[k], p[k]) : null}
                  color={col}
                />
              ))}
              <tr>
                <td
                  colSpan={3}
                  style={{ borderTop: `1px solid ${C.border}`, paddingTop: 3 }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    <span>Total</span>
                    <span style={{ color: C.accent }}>
                      {fv("$", c.total_revenue)}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "12px 14px",
          }}
        >
          <Tip text="Cost breakdown. Labor is 56%.">
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.textDim,
                display: "block",
                marginBottom: 4,
              }}
            >
              Costs
            </span>
          </Tip>
          <table style={ts}>
            <tbody>
              {[
                "cost_labor",
                "cost_supplies",
                "cost_drugs",
                "cost_admin",
                "cost_capital",
                "cost_fixed",
                "cost_revenue_linked",
              ].map((k) => {
                const pt =
                  c.total_costs > 0
                    ? ((c[k] / c.total_costs) * 100).toFixed(0)
                    : "0";
                return (
                  <TRow
                    key={k}
                    label={`${MM[k]?.l} (${pt}%)`}
                    tip={MM[k]?.t}
                    value={fv("$", c[k])}
                    d={p ? delta(k, c[k], p[k]) : null}
                  />
                );
              })}
              <tr>
                <td
                  colSpan={3}
                  style={{ borderTop: `1px solid ${C.border}`, paddingTop: 3 }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    <span>Total</span>
                    <span style={{ color: C.orange }}>
                      {fv("$", c.total_costs)}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "12px 14px",
          }}
        >
          <Tip text="Payer distribution.">
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.textDim,
                display: "block",
                marginBottom: 4,
              }}
            >
              Payer Mix
            </span>
          </Tip>
          <table style={ts}>
            <tbody>
              {[
                ["commercial_share", C.good],
                ["medicare_share", C.blue],
                ["ma_share", C.purple],
                ["medicaid_share", C.orange],
                ["self_pay_share", C.pink],
              ].map(([k, col]) => (
                <TRow
                  key={k}
                  label={MM[k]?.l}
                  tip={MM[k]?.t}
                  value={`${(c[k] * 100).toFixed(1)}%`}
                  d={p ? delta(k, c[k], p[k]) : null}
                  color={col}
                />
              ))}
            </tbody>
          </table>
          <div
            style={{
              display: "flex",
              height: 6,
              borderRadius: 3,
              overflow: "hidden",
              marginTop: 6,
              gap: 1,
            }}
          >
            {[
              c.commercial_share,
              c.medicare_share,
              c.ma_share,
              c.medicaid_share,
              c.self_pay_share,
            ].map((v, i) => (
              <div
                key={i}
                style={{
                  width: `${v * 100}%`,
                  background: [C.good, C.blue, C.purple, C.orange, C.pink][i],
                }}
              />
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
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.textDim,
              display: "block",
              marginBottom: 4,
            }}
          >
            Key Metrics
          </span>
          <table style={ts}>
            <tbody>
              {[
                "beds",
                "admissions",
                "effective_occupancy",
                "cmi",
                "avg_los",
                "readmission_rate",
                "patient_satisfaction",
                "community_benefit",
              ].map((k) => (
                <TRow
                  key={k}
                  label={MM[k]?.l || k}
                  tip={MM[k]?.t}
                  value={fmtKey(k, c[k])}
                  d={p ? delta(k, c[k], p[k]) : null}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
