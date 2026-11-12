import { FUNNEL_SOURCES, FUNNEL_SOURCE_STAGES, FUNNEL_STAGES, type FunnelSource, type FunnelStage } from '@/lib/funnel';
import { REQUEST_LABELS } from '@/lib/promptGroups';
import type { HostedPromptTypeUsage, HostedUsageDay } from '@/services/HostedAiAdminService';

/** Shown where a figure has no value. */
export const NO_VALUE = '—';

/** Dollars, with the extra places a small amount needs to read as more than zero. */
export function money(micros: number | null): string {
  if (micros === null) return NO_VALUE;
  const dollars = micros / 1_000_000;
  return `$${dollars.toFixed(dollars > 0 && dollars < 1 ? 4 : 2)}`;
}

export const whole = (value: number | null): string => (value === null ? NO_VALUE : Math.round(value).toLocaleString('en-US'));

/** A whole percent. A small share never rounds down to a false zero. */
export function percent(share: number | null): string {
  if (share === null) return NO_VALUE;
  return share > 0 && share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`;
}

export const seconds = (ms: number | null): string => (ms === null ? NO_VALUE : `${(ms / 1000).toFixed(1)} s`);

/** `2026-11-03` as `Nov 3`, in UTC so the day cannot shift with the reader's zone. */
export function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** An instant as `Nov 3, 18:44`, in UTC. */
export function instantLabel(iso: string): string {
  return `${dayLabel(iso.slice(0, 10))}, ${iso.slice(11, 16)}`;
}

/** The prompt's own name where the app has one, else its id spaced out. A null type has none recorded. */
export function promptTypeLabel(type: string | null): string {
  if (type === null) return 'Not Recorded';
  const known = (REQUEST_LABELS as Record<string, string | undefined>)[type];
  if (known) return known;
  const spaced = type.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const ENDING_LABELS: Record<string, string> = {
  ok: 'Completed', aborted: 'Player Left', error: 'Failed', swept: 'Never Settled', open: 'In Progress',
};

export const endingLabel = (status: string): string => ENDING_LABELS[status] ?? status;

const FAILURE_LABELS: Record<string, string> = {
  idle_limit: 'Idle Limit', upstream_reply: 'Provider Reply', thinking: 'Stray Thinking', empty: 'Empty Reply', network: 'Network', other: 'Other',
};

export function failureLabel(failure: string): string {
  const status = /^status_(\d+)$/.exec(failure);
  return status ? `Provider Error ${status[1]}` : FAILURE_LABELS[failure] ?? failure;
}

/** The funnel table's columns, one per stage in funnel order. */
export const FUNNEL_COLUMN_LABELS: Record<FunnelStage, string> = {
  offer_shown: 'Shown', see_levels: 'See Levels', patreon_click: 'Patreon', checklist_finished: 'Checklist',
};

const FUNNEL_SOURCE_LABELS: Record<FunnelSource, string> = {
  setup: 'AI Setup', demo: 'Demo AI Card', engine: 'Built-In Engine Card', notice: 'Demo AI Notice', locked: 'Locked Preset Panel',
};

/** A null count is a stage the source does not report. A rate is null over a zero base, and `ranked` is false on a row's first count. */
export interface FunnelCell { count: number | null; rate: number | null; ranked: boolean }
/** `cells` follow `FUNNEL_STAGES`. */
export interface FunnelRow { key: string; label: string; cells: readonly FunnelCell[] }

/** One row per source in report order, then the older-build totals. A step the report omits counts zero. */
export function funnelRows(offer: readonly { step: string; count: number }[]): FunnelRow[] {
  const counts = new Map(offer.map((row) => [row.step, row.count]));
  const rowOf = (key: string, label: string, steps: ReadonlyMap<FunnelStage, string>): FunnelRow => {
    let previous: number | null = null;
    const cells = FUNNEL_STAGES.map((stage): FunnelCell => {
      const step = steps.get(stage);
      if (step === undefined) return { count: null, rate: null, ranked: false };
      const count = counts.get(step) ?? 0;
      const cell = { count, rate: previous === null ? null : share(count, previous), ranked: previous !== null };
      previous = count;
      return cell;
    });
    return { key, label, cells };
  };
  const stepsOf = (source: FunnelSource) => new Map(FUNNEL_SOURCE_STAGES[source].map((stage): [FunnelStage, string] => [stage, `${source}_${stage}`]));
  return [
    ...FUNNEL_SOURCES.map((source) => rowOf(source, FUNNEL_SOURCE_LABELS[source], stepsOf(source))),
    rowOf('older', 'Older Builds', new Map(FUNNEL_STAGES.map((stage): [FunnelStage, string] => [stage, stage]))),
  ];
}

/** `12 (40%)`; a rate with no base reads `12 (—)`, a row's first count is bare, and an unreported stage is the empty value. */
export function funnelCellLabel(cell: FunnelCell): string {
  if (cell.count === null) return NO_VALUE;
  return cell.ranked ? `${whole(cell.count)} (${percent(cell.rate)})` : whole(cell.count);
}

const REFUSAL_LABELS: Record<string, string> = {
  invalid_request: 'Invalid Request', age_gate_required: 'Age Check Needed', not_entitled: 'Not Entitled',
  pledge_unconfirmed: 'Pledge Unconfirmed', service_paused: 'Service Paused', rate_limited: 'Rate Limited',
  turn_expired: 'Turn Expired', budget_exhausted: 'Budget Used Up', window_exceeded: 'Prompt Too Long',
  image_not_supported: 'Image Not Supported',
};

export const refusalLabel = (code: string): string => REFUSAL_LABELS[code] ?? code;

const PLATFORM_LABELS: Record<string, string> = { web: 'Web', windows: 'Windows', linux: 'Linux', mac: 'Mac', android: 'Android' };

export const platformLabel = (platform: string): string => PLATFORM_LABELS[platform] ?? platform;

/** One count over another, or null where the base is missing or zero. */
export const share = (part: number, base: number | null): number | null => (base ? part / base : null);

/** A null version is a call with no readable client header. */
export const clientLabel = (version: string | null): string => version ?? 'No Header';

const BYTE_UNITS = ['KB', 'MB', 'GB', 'TB'] as const;

/** Decimal bytes (1 GB is 1,000,000,000) in the largest unit that keeps the value at 1 or more, up to TB. */
export function bytes(value: number | null): string {
  if (value === null) return NO_VALUE;
  if (Math.abs(value) < 1000) return `${Math.round(value)} B`;
  let unit = 0;
  let scaled = value / 1000;
  // Steps up when rounding would print 1000.0 of the smaller unit.
  while (unit < BYTE_UNITS.length - 1 && Math.abs(Math.round(scaled * 10) / 10) >= 1000) {
    scaled /= 1000;
    unit += 1;
  }
  return `${scaled.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${BYTE_UNITS[unit]}`;
}

/** The next round axis top at or above a value: 1, 2 or 5 times a power of ten. Zero data still gets an axis. */
export function axisTop(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((candidate) => value <= candidate * power) ?? 10;
  return step * power;
}

function csv(rows: readonly (readonly (string | number | null)[])[]): string {
  const cell = (value: string | number | null) => {
    if (value === null) return '';
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `${rows.map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`;
}

const dollarCell = (micros: number | null) => (micros === null ? null : micros / 1_000_000);

/** Plain numbers rather than display text, so a spreadsheet can sum the columns. */
export function daysCsv(days: readonly HostedUsageDay[]): string {
  return csv([
    ['Day', 'Calls', 'Turns', 'AI Users', 'Active Installs', 'Recorded Dollars', 'Provider Dollars'],
    ...days.map((day) => [day.day, day.calls, day.turns, day.accounts, day.installs, dollarCell(day.costMicros), dollarCell(day.providerMicros)]),
  ]);
}

export function promptTypesCsv(rows: readonly HostedPromptTypeUsage[]): string {
  return csv([
    ['Type', 'Calls', 'Dollars', 'Avg Prompt Tokens', 'Avg Output Tokens', 'Cached Share', 'First Token Ms', 'Tokens Per Second', 'Longest Gap Ms', 'Failed'],
    ...rows.map((row) => [
      promptTypeLabel(row.promptType), row.calls, dollarCell(row.costMicros), row.avgPromptTokens, row.avgOutputTokens, row.cachedShare,
      row.firstTokenP50Ms, row.tokensPerSecondP50, row.maxGapP90Ms, row.failed,
    ]),
  ]);
}
