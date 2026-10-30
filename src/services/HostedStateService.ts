import { API_BASE_URL } from '@/lib/apiBase';
import AuthService from '@/services/AuthService';
import { authHeaders } from '@/services/authRequest';
import { SUPPORTER_TIERS } from '@/lib/supporterFlair';
import type { SupporterTier } from '@/types';

/** The states the server reports. The app adds its own (signed out, outdated and the rest) from refusals. */
const ALLOWANCE_STATES = ['ready', 'warned', 'exhausted', 'paused', 'locked', 'age-gate'] as const;

export type HostedAllowanceState = (typeof ALLOWANCE_STATES)[number];

/** The part of the hosted state the account page shows. Never holds a dollar amount. */
export interface HostedAllowance {
  tier: SupporterTier | null;
  state: HostedAllowanceState;
  percentUsed: number | null;
  turnsLeft: number | null;
  resetAt: string | null;
}

/** A hosted-state read that could not answer. */
export class HostedStateError extends Error {
  constructor(message = 'Couldn’t read your Formamorph AI allowance.') {
    super(message);
    this.name = 'HostedStateError';
  }
}

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const clampPercent = (value: number | null): number | null =>
  value === null ? null : Math.min(100, Math.max(0, Math.round(value)));

/** Read the caller's hosted state. Throws `HostedStateError` on a network failure, a refusal or an unknown shape. */
export async function fetchHostedAllowance(): Promise<HostedAllowance> {
  if (!AuthService.token) throw new HostedStateError();

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/hosted-ai/state`, { headers: authHeaders() });
  } catch {
    throw new HostedStateError();
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== 'object') throw new HostedStateError();

  const data = (payload as { data?: Record<string, unknown> }).data;
  if (!data || !ALLOWANCE_STATES.includes(data.state as HostedAllowanceState)) throw new HostedStateError();

  return {
    tier: SUPPORTER_TIERS.includes(data.tier as SupporterTier) ? (data.tier as SupporterTier) : null,
    state: data.state as HostedAllowanceState,
    percentUsed: clampPercent(numberOrNull(data.percentUsed)),
    turnsLeft: numberOrNull(data.turnsLeft),
    resetAt: typeof data.resetAt === 'string' ? data.resetAt : null,
  };
}
