import type { HostedState } from './hostedState';

/** The highest threshold, when crossed and not yet acknowledged this week; a lower one raises no notice. Else null. */
export function pendingWarning(
  hosted: HostedState | null,
  alsoSeen: ReadonlySet<number> = new Set(),
): number | null {
  if (hosted?.percentUsed == null || !hosted.warnThresholds) return null;
  const percent = hosted.percentUsed;
  const top = Math.max(...hosted.warnThresholds);
  const open = percent >= top && percent < 100 && !hosted.acknowledged.includes(top) && !alsoSeen.has(top);
  return open ? top : null;
}

/** Whether the week's allowance is spent. */
export const isSpent = (hosted: HostedState | null): boolean =>
  hosted?.state === 'exhausted' || (hosted?.percentUsed ?? 0) >= 100;

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
