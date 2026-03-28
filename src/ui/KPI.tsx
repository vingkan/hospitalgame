import { fmtKey } from "../model/nodes";
import { MM } from "../config/metrics";
import { C, F } from "./theme";
import { delta } from "./helpers";
import { Tip } from "./Tip";

export function KPI({
  k,
  v,
  pv,
  icon,
}: {
  k: string;
  v: number;
  pv?: number | null;
  icon: string;
}) {
  const m = MM[k],
    d = pv != null ? delta(k, v, pv) : null;
  const col =
    k === "profit"
      ? v > 0
        ? C.good
        : C.bad
      : k === "operating_margin"
        ? v > 5
          ? C.good
          : v > 0
            ? C.warn
            : C.bad
        : m?.h === "good"
          ? C.good
          : C.blue;
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "12px 14px",
        flex: "1 1 0",
        minWidth: 125,
      }}
    >
      <Tip text={m?.t}>
        <div
          style={{
            fontSize: 10,
            color: C.textMuted,
            marginBottom: 3,
            fontWeight: 600,
          }}
        >
          {icon} {m?.l}
        </div>
      </Tip>
      <div
        style={{ fontSize: 20, fontWeight: 700, color: col, fontFamily: F.d }}
      >
        {fmtKey(k, v)}
      </div>
      {d && (
        <div
          style={{ fontSize: 10, color: d.col, marginTop: 1, fontWeight: 600 }}
        >
          {d.arrow} {d.lbl}
        </div>
      )}
    </div>
  );
}
