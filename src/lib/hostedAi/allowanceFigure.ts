import type { HostedSnapshot } from './hostedSession';
import type { HostedPresetState } from './refusals';

/** What the Allowance Ring draws. */
export interface AllowanceFigure {
  /** Percent used, 0 to 100; null for a state with no usage figure, which draws no fill. */
  percent: number | null;
  presetState: HostedPresetState;
  warnThresholds: number[] | null;
}

export type AllowanceTone = 'normal' | 'warning' | 'destructive';

const clampPercent = (percent: number) => Math.min(100, Math.max(0, percent));

/** The figure a snapshot holds right now. */
export function allowanceFigure({ hosted, presetState }: HostedSnapshot): AllowanceFigure {
  const warnThresholds = hosted?.warnThresholds ?? null;
  if (presetState === 'exhausted') return { percent: 100, presetState, warnThresholds };
  const hasUsage = presetState === 'ready' || presetState === 'warned';
  const percent = hasUsage && hosted?.percentUsed != null ? clampPercent(hosted.percentUsed) : null;
  return { percent, presetState, warnThresholds };
}

/** The ring's color: `destructive` from the highest threshold and at the cap, `warning` from any lower one. */
export function allowanceTone(percent: number | null, warnThresholds: number[] | null): AllowanceTone {
  if (percent === null) return 'normal';
  if (percent >= 100) return 'destructive';
  if (!warnThresholds) return 'normal';
  if (percent >= warnThresholds[warnThresholds.length - 1]) return 'destructive';
  return percent >= warnThresholds[0] ? 'warning' : 'normal';
}

/** What decides whether the ring takes the live figure. */
export interface AllowanceHoldInputs {
  busy: boolean;
  readCount: number;
  presetState: HostedPresetState;
}

/** Whether the ring takes the live figure: at a turn's end, or at a read or state change outside a turn. */
export function allowanceFigureMoves(previous: AllowanceHoldInputs, next: AllowanceHoldInputs): boolean {
  if (next.busy) return false;
  return previous.busy || previous.readCount !== next.readCount || previous.presetState !== next.presetState;
}
