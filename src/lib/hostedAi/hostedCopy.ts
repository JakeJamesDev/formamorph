import { formatResetTime } from '@/lib/resetTime';
import type { HostedState } from './hostedState';
import type { HostedPresetState } from './refusals';

/** What a state's action does. */
export type HostedAction = 'signIn' | 'privacy' | 'ageGate' | 'patreon' | 'update' | 'recheck' | 'switchBack';

export interface HostedStateAction { kind: HostedAction; label: string }

/** The reason and actions a preset state shows; null for a state that shows nothing. */
export interface HostedStateCopy {
  reason: string;
  /** The main action. */
  action: HostedStateAction | null;
  /** A second action, shown after the first. */
  extra?: HostedStateAction;
}

export const HOSTED_SUPPORT_LABEL = 'Support on Patreon';
export const HOSTED_SWITCH_BACK_LABEL = 'Switch Back';

const COPY: Record<HostedPresetState, HostedStateCopy | null> = {
  ready: null,
  warned: null,
  'signed-out': { reason: 'Sign in to use Formamorph AI', action: { kind: 'signIn', label: 'Sign In' } },
  'privacy-required': {
    reason: 'Accept the current Privacy Policy to use Formamorph AI',
    action: { kind: 'privacy', label: 'Review Policy' },
  },
  suspended: { reason: "Your account is suspended, so you can't use Formamorph AI", action: null },
  'age-gate': { reason: "Confirm that you're 18 or older to use Formamorph AI", action: { kind: 'ageGate', label: 'Confirm Age' } },
  locked: { reason: 'Formamorph AI is for Patreon Supporters', action: { kind: 'patreon', label: HOSTED_SUPPORT_LABEL } },
  exhausted: {
    reason: "You've used this week's Formamorph AI allowance",
    action: { kind: 'switchBack', label: HOSTED_SWITCH_BACK_LABEL },
    extra: { kind: 'patreon', label: HOSTED_SUPPORT_LABEL },
  },
  paused: {
    reason: "Formamorph AI is paused for everyone right now. This doesn't use your allowance.",
    action: { kind: 'recheck', label: 'Check Again' },
  },
  outdated: { reason: 'Update Formamorph to keep using Formamorph AI', action: { kind: 'update', label: 'Update' } },
  unavailable: {
    reason: "Formamorph AI can't report your allowance right now. Your turns still send.",
    action: { kind: 'recheck', label: 'Check Again' },
  },
};

/** The copy of a state. `resetAt` adds the local reset time to the exhausted reason. */
export function hostedStateCopy(state: HostedPresetState, resetAt?: string | null): HostedStateCopy | null {
  const copy = COPY[state];
  if (state !== 'exhausted' || !copy) return copy;
  const date = formatResetTime(resetAt ?? null);
  return date ? { ...copy, reason: `${copy.reason}. It comes back ${date}.` } : copy;
}

/** The allowance lines in AI settings; null when the state holds no usage. */
export interface HostedUsageCopy {
  tier: string;
  used: string;
  turnsLeft: string | null;
  resets: string | null;
}

export function hostedUsageCopy(hosted: HostedState | null, tierLabel: string | null): HostedUsageCopy | null {
  if (!hosted || hosted.percentUsed === null || !tierLabel) return null;
  const date = formatResetTime(hosted.resetAt);
  return {
    tier: tierLabel,
    used: `${Math.min(100, Math.round(hosted.percentUsed))}% used`,
    turnsLeft: hosted.turnsLeft === null || hosted.percentUsed >= 100 ? null : `About ${Math.max(0, Math.floor(hosted.turnsLeft))} turns left`,
    resets: date ? `Resets ${date}` : null,
  };
}

/** The help line under the usage display. */
export const HOSTED_USAGE_HELP = 'Counts turns on every device and resets every week';

/** A threshold notice's text. */
export function hostedWarningText(threshold: number, hosted: HostedState | null): string {
  const date = formatResetTime(hosted?.resetAt ?? null);
  return `You've used ${threshold}% of this week's Formamorph AI allowance.${date ? ` It resets ${date}.` : ''}`;
}
