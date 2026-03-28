export type V = Record<string, number>;

export interface GameNode {
  id: string;
  group: string;
  label: string;
  fmt: string;
  deps?: string[];
  fn?: (args: V) => number;
  show?: (args: V) => string;
}

export interface GameEvent {
  yr: number;
  loc?: string[];
  own?: string[];
  text: string;
  fx: Record<string, number | string>;
}

export interface PhaseOption {
  id: string;
  label: string;
  icon: string;
  desc: string;
  effects: Record<string, number | string>;
}

export interface PhaseDecision {
  id: string;
  title: string;
  description: string;
  options: PhaseOption[];
}

export interface Phase {
  phase: number;
  title: string;
  subtitle: string;
  decisions: PhaseDecision[];
}

export type LogEntry = { phase: string; decision: string; choice: string };
export type SnapEntry = {
  key: string;
  label: string;
  before: number;
  after: number;
};

export interface CalibResult {
  location: string;
  ownership: string;
  size: string;
  count: number;
  margin: {
    min: number;
    p25: number;
    med: number;
    avg: number;
    p75: number;
    max: number;
  };
  profit: {
    min: number;
    p25: number;
    med: number;
    avg: number;
    p75: number;
    max: number;
  };
  quality: { min: number; avg: number; max: number };
  share: { min: number; avg: number; max: number };
}
