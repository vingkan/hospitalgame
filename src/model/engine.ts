import type { GameNode, V } from "./types";

export function evaluate(nodes: GameNode[], inputs: V) {
  const vals: V = {},
    formulas: Record<string, string> = {};
  for (const node of nodes) {
    if (!node.deps) {
      vals[node.id] = inputs[node.id] ?? 0;
      continue;
    }
    const args: V = {};
    for (const d of node.deps) args[d] = vals[d];
    vals[node.id] = node.fn!(args);
    if (node.show) formulas[node.id] = node.show(args);
  }
  return { vals, formulas };
}

export function evaluateFast(nodes: GameNode[], inputs: V): V {
  const vals: V = {};
  for (const node of nodes) {
    if (!node.deps) {
      vals[node.id] = inputs[node.id] ?? 0;
      continue;
    }
    const args: V = {};
    for (const d of node.deps) args[d] = vals[d];
    vals[node.id] = node.fn!(args);
  }
  return vals;
}
