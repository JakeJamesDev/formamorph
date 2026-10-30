import { CLIENT_UPDATE_REQUIRED } from '@/lib/clientIdentity';
import { PRIVACY_REQUIRED } from '@/services/PolicyService';
import { recordOf } from './hostedState';

/** The proxy's own refusal codes and the status each answers with. */
export const HOSTED_REFUSALS = {
  invalid_request: 400,
  age_gate_required: 403,
  not_entitled: 403,
  service_paused: 503,
  rate_limited: 429,
  turn_expired: 409,
  budget_exhausted: 402,
  window_exceeded: 413,
  image_not_supported: 400,
  upstream_error: 502,
} as const;

/** Every state the Formamorph AI preset can be in. */
export const HOSTED_PRESET_STATES = [
  'signed-out', 'privacy-required', 'suspended', 'age-gate', 'locked',
  'ready', 'warned', 'exhausted', 'paused', 'outdated', 'unavailable',
] as const;

export type HostedPresetState = (typeof HOSTED_PRESET_STATES)[number];

/** Whether a call may be sent in this state. The server stays the authority while the state is unknown. */
export function hostedStateSends(state: HostedPresetState): boolean {
  return state === 'ready' || state === 'warned' || state === 'unavailable';
}

/** What the server refused, read from its status and body. */
export interface HostedRefusal {
  status: number;
  /** The proxy's code, a `protect` code, or null where the body named none. */
  code: string | null;
  /** The server's own message, or '' where it sent none. */
  message: string;
  /** The preset state this refusal puts the preset in; null leaves the state as it is. */
  presetState: HostedPresetState | null;
  /** `window_exceeded`: the window the server holds. */
  window?: number;
  /** `budget_exhausted`: when the allowance comes back. */
  resetAt?: string;
}

const PRESET_STATE_BY_CODE: Partial<Record<string, HostedPresetState>> = {
  not_entitled: 'locked',
  age_gate_required: 'age-gate',
  service_paused: 'paused',
  budget_exhausted: 'exhausted',
  [PRIVACY_REQUIRED]: 'privacy-required',
  [CLIENT_UPDATE_REQUIRED]: 'outdated',
};

/** Reads one refused response body into a refusal. A body that is not JSON keeps only the status. */
export function readHostedRefusal(status: number, body: unknown): HostedRefusal {
  const record = recordOf(body) ?? {};
  const code = typeof record.code === 'string' ? record.code : null;
  const message = typeof record.error === 'string' ? record.error : '';
  return {
    status,
    code,
    message,
    presetState: presetStateOf(status, code, record),
    ...(code === 'window_exceeded' && typeof record.window === 'number' && { window: record.window }),
    ...(code === 'budget_exhausted' && typeof record.resetAt === 'string' && { resetAt: record.resetAt }),
  };
}

function presetStateOf(status: number, code: string | null, record: Record<string, unknown>): HostedPresetState | null {
  if (status === 401) return 'signed-out';
  if (status === 426) return 'outdated';
  if (code !== null) return PRESET_STATE_BY_CODE[code] ?? null;
  // The suspended refusal is the one 403 with no code; its end date names it.
  return status === 403 && 'suspendedUntil' in record ? 'suspended' : null;
}
