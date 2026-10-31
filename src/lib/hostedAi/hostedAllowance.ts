import type { HostedState } from './hostedState';

/** The highest threshold the account has crossed and not yet acknowledged this month, or null. */
export function pendingWarning(
  hosted: HostedState | null,
  alsoSeen: ReadonlySet<number> = new Set(),
): number | null {
  if (hosted?.percentUsed == null || !hosted.warnThresholds) return null;
  const percent = hosted.percentUsed;
  const open = hosted.warnThresholds.filter((t) => percent >= t && percent < 100 && !hosted.acknowledged.includes(t) && !alsoSeen.has(t));
  return open.length > 0 ? Math.max(...open) : null;
}

/** Whether the month's allowance is spent. */
export const isSpent = (hosted: HostedState | null): boolean =>
  hosted?.state === 'exhausted' || (hosted?.percentUsed ?? 0) >= 100;

/** The reset instant as a calendar date, in UTC because the allowance resets on the 1st (UTC). */
export function formatResetDate(resetAt: string | null): string | null {
  if (!resetAt) return null;
  const date = new Date(resetAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** What the device remembers about Formamorph AI, kept apart from the preset list. */
export interface HostedDeviceRecord {
  /** The one-time switch ran on this device. */
  switched: boolean;
  /** The preset to return to; null means Demo AI. */
  previousPresetId: string | null;
}

export const HOSTED_DEVICE_KEY = 'FORMAMORPH_hostedAiDevice';
const EMPTY: HostedDeviceRecord = { switched: false, previousPresetId: null };

export function readHostedDevice(): HostedDeviceRecord {
  try {
    const raw = localStorage.getItem(HOSTED_DEVICE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed === null || typeof parsed !== 'object') return EMPTY;
    const { switched, previousPresetId } = parsed as Record<string, unknown>;
    return { switched: switched === true, previousPresetId: typeof previousPresetId === 'string' ? previousPresetId : null };
  } catch {
    return EMPTY;
  }
}

export function writeHostedDevice(record: HostedDeviceRecord): void {
  try {
    localStorage.setItem(HOSTED_DEVICE_KEY, JSON.stringify(record));
  } catch {
    // A full or blocked store leaves the switch to run again next launch; nothing else depends on it.
  }
}

/** Whether the one-time switch should run now: the account has a tier, the preset can run, the device never switched. */
export function shouldSwitchOnce(hosted: HostedState | null, device: HostedDeviceRecord): boolean {
  if (device.switched || !hosted?.tier) return false;
  return hosted.state === 'ready' || hosted.state === 'warned';
}
