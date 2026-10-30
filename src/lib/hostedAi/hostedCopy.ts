import type { HostedPresetState } from './refusals';

/** What a state's one action does. */
export type HostedAction = 'signIn' | 'privacy' | 'ageGate' | 'patreon' | 'update' | 'recheck';

/** The reason and action a preset state shows; null for a state that shows nothing. */
export interface HostedStateCopy {
  reason: string;
  action: { kind: HostedAction; label: string } | null;
}

const COPY: Record<HostedPresetState, HostedStateCopy | null> = {
  ready: null,
  warned: null,
  'signed-out': { reason: 'Sign in to use Formamorph AI', action: { kind: 'signIn', label: 'Sign In' } },
  'privacy-required': {
    reason: 'Accept the current Privacy Policy to use Formamorph AI',
    action: { kind: 'privacy', label: 'Review Policy' },
  },
  suspended: { reason: 'Your account is suspended, so Formamorph AI is off', action: null },
  'age-gate': { reason: "Confirm you're 18 or older to use Formamorph AI", action: { kind: 'ageGate', label: 'Confirm Age' } },
  locked: { reason: 'Join as a Supporter on Patreon to use Formamorph AI', action: { kind: 'patreon', label: 'Join on Patreon' } },
  exhausted: { reason: "You've used this month's Formamorph AI allowance", action: { kind: 'patreon', label: 'Upgrade' } },
  paused: {
    reason: "Formamorph AI is paused for everyone right now. Your allowance isn't affected.",
    action: { kind: 'recheck', label: 'Check Again' },
  },
  outdated: { reason: 'Update Formamorph to keep using Formamorph AI', action: { kind: 'update', label: 'Update' } },
  unavailable: {
    reason: "Can't read your Formamorph AI status right now. Your turns still send.",
    action: { kind: 'recheck', label: 'Check Again' },
  },
};

export function hostedStateCopy(state: HostedPresetState): HostedStateCopy | null {
  return COPY[state];
}
