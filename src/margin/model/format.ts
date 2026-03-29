import type { GameNode } from "./types";

export function fv(fmt: string, v: number | null | undefined): string {
  if (v == null) return "\u2014";
  switch (fmt) {
    case "$": {
      const a = Math.abs(v),
        s = v < 0 ? "-" : "";
      return a >= 1e9
        ? `${s}$${(a / 1e9).toFixed(1)}B`
        : a >= 1e6
          ? `${s}$${(a / 1e6).toFixed(1)}M`
          : a >= 1e3
            ? `${s}$${(a / 1e3).toFixed(0)}K`
            : `${s}$${a.toFixed(0)}`;
    }
    case "%":
      return `${(v * 100).toFixed(1)}%`;
    case "%p":
      return `${v.toFixed(1)}%`;
    case "i":
      return Math.round(v).toLocaleString();
    case "s":
      return `${Math.round(v)}/100`;
    case "d":
      return v.toFixed(2);
    case "dy":
      return `${v.toFixed(1)}d`;
    case "x":
      return `${v.toFixed(3)}\u00d7`;
    default:
      return String(v);
  }
}

export function fmtNode(node: GameNode, v: number) {
  return fv(node.fmt, v);
}
