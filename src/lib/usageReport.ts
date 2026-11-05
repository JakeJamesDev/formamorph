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

const OFFER_LABELS: Record<string, string> = {
  offer_shown: 'Offer Shown', see_levels: 'See Levels', patreon_click: 'Patreon Click', checklist_finished: 'Checklist Finished',
};

export const offerLabel = (step: string): string => OFFER_LABELS[step] ?? step;

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
    ['Day', 'Calls', 'Turns', 'Accounts', 'Recorded Dollars', 'Provider Dollars'],
    ...days.map((day) => [day.day, day.calls, day.turns, day.accounts, dollarCell(day.costMicros), dollarCell(day.providerMicros)]),
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
