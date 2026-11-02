import type { HostedState } from './hostedState';
import type { HostedPresetState } from './refusals';

/** DEV: the canned usage a state shows without a server. */
export type DevHostedSample = Pick<HostedState, 'tier' | 'percentUsed' | 'turnsLeft' | 'resetAt' | 'warnThresholds' | 'breakdown' | 'breakdownThreshold'>;

const RESET_AT = '2026-11-09T00:00:00.000Z';
const WARN_THRESHOLDS = [75, 90];

export const DEV_HOSTED_SAMPLES: Partial<Record<HostedPresetState, DevHostedSample>> = {
  ready: {
    tier: 'supporter_plus', percentUsed: 32, turnsLeft: 41, resetAt: RESET_AT, warnThresholds: WARN_THRESHOLDS, breakdownThreshold: 10,
    breakdown: { narration: 48.3, thinking: 11.6, director: 3.1, choices: 8.4, statUpdates: 12.2, timePassed: 1.5, inventory: 4.9, summary: 6.7, help: 3.0, other: 1.8 },
  },
  warned: {
    tier: 'supporter_plus', percentUsed: 78, turnsLeft: 9, resetAt: RESET_AT, warnThresholds: WARN_THRESHOLDS, breakdownThreshold: 10,
    breakdown: { narration: 52.0, thinking: 14.0, choices: 9.0, statUpdates: 16.5, inventory: 3.5, summary: 5.0 },
  },
  exhausted: {
    tier: 'supporter_plus', percentUsed: 100, turnsLeft: 0, resetAt: RESET_AT, warnThresholds: WARN_THRESHOLDS, breakdownThreshold: 10,
    breakdown: { narration: 60.0, thinking: 20.0, choices: 20.0 },
  },
};

/** One `allowance=…` dev route: the state it shows and, where the state's own sample won't do, its usage. */
export interface DevAllowanceRoute {
  state: HostedPresetState;
  sample?: DevHostedSample;
}

/** The `allowance=…` values on the game view: every preset state, plus the warned state past the top threshold. */
export const DEV_ALLOWANCE_ROUTES: Record<string, DevAllowanceRoute> = {
  ready: { state: 'ready' },
  warned: { state: 'warned' },
  'warned-high': { state: 'warned', sample: { ...DEV_HOSTED_SAMPLES.warned!, percentUsed: 93, turnsLeft: 3 } },
  exhausted: { state: 'exhausted' },
  paused: { state: 'paused' },
  locked: { state: 'locked' },
  'signed-out': { state: 'signed-out' },
  'privacy-required': { state: 'privacy-required' },
  suspended: { state: 'suspended' },
  'age-gate': { state: 'age-gate' },
  outdated: { state: 'outdated' },
  unavailable: { state: 'unavailable' },
};
