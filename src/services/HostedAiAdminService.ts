import AuthService from './AuthService';
import { authHeaders, unwrap } from './authRequest';
import type { SupporterTier } from '@/types/supporter';
import type { ReasoningDialect } from '@/lib/reasoningDialect';

/** What a model can do, as the hosted state reports it to the client. */
export interface HostedCapabilities {
  tools: boolean;
  reasoning: ReasoningDialect | null;
  budget?: boolean;
  efforts?: string[];
}

/** Dollars per million tokens. `cached` falls back to `prompt` on the server. */
export interface HostedPrices {
  prompt?: number;
  completion?: number;
  cached?: number;
}

/** One approved model. `routing` and `reasoning` are the provider's own option objects. */
export interface HostedModel {
  id: string;
  model: string;
  routing?: Record<string, unknown> | null;
  reasoning?: Record<string, unknown> | null;
  prices?: HostedPrices | null;
  capabilities?: HostedCapabilities | null;
}

/** One tier's window, monthly budget and fallback cost per turn, all dollars where money. */
export interface HostedTier {
  window: number;
  budget: number;
  turnCost?: number | null;
}

/** The `hosted_ai` setting. Every limit is null until an admin writes one. */
export interface HostedAiSettings {
  models: HostedModel[];
  activeModel: string | null;
  tiers: Partial<Record<SupporterTier, HostedTier>>;
  maxTokensCap: number | null;
  idleLimitSeconds: number | null;
  tokenRatio: number | null;
  tokenMargin: number | null;
  turnLimitSeconds: number | null;
  turnCallCap: number | null;
  retentionDays: number | null;
  warnThresholds: number[] | null;
  turnSample: { recent: number; min: number } | null;
  parallelLimit: number | null;
  perMinuteLimit: number | null;
  dailyCeiling: number | null;
  balanceThreshold: number | null;
}

export interface HostedGrant {
  id: number;
  userId: string;
  username: string;
  tier: SupporterTier;
  endsAt: string;
  createdAt: string;
  revokedAt: string | null;
  subject: string;
}

export interface HostedPause {
  paused: boolean;
  pausedAt: string | null;
  liftedAt: string | null;
  until: string | null;
}

/** One UTC day. `providerMicros` is null until the daily provider read has stored that day. */
export interface HostedSpendDay {
  day: string;
  calls: number;
  costMicros: number;
  providerMicros: number | null;
}

/** The admin surface of Formamorph AI: the setting, grants, the pause and the spend report. */
export interface HostedAiAdminApi {
  fetchSettings(): Promise<HostedAiSettings>;
  saveSettings(value: HostedAiSettings): Promise<HostedAiSettings>;
  listGrants(): Promise<HostedGrant[]>;
  createGrant(input: { userId: string; tier: SupporterTier; endsAt: string }): Promise<HostedGrant>;
  revokeGrant(id: number): Promise<HostedGrant>;
  fetchPause(): Promise<HostedPause>;
  liftPause(): Promise<HostedPause>;
  fetchSpendReport(days: number): Promise<HostedSpendDay[]>;
}

/** The server's value, with the lists and objects a form reads always present. */
function withDefaults(raw: Partial<HostedAiSettings> | null | undefined): HostedAiSettings {
  const value = raw ?? {};
  return {
    models: [],
    activeModel: null,
    tiers: {},
    maxTokensCap: null,
    idleLimitSeconds: null,
    tokenRatio: null,
    tokenMargin: null,
    turnLimitSeconds: null,
    turnCallCap: null,
    retentionDays: null,
    warnThresholds: null,
    turnSample: null,
    parallelLimit: null,
    perMinuteLimit: null,
    dailyCeiling: null,
    balanceThreshold: null,
    ...value,
  };
}

/** The admin routes of Formamorph AI. Admin-only ones answer 403 to a moderator. */
class HostedAiAdminService implements HostedAiAdminApi {
  private get base() {
    return AuthService.API_URL;
  }

  async fetchSettings(): Promise<HostedAiSettings> {
    const response = await fetch(`${this.base}/settings/hosted_ai`, { headers: authHeaders() });
    const body = await unwrap<{ data: Partial<HostedAiSettings> | null }>(response, 'Failed to read the hosted AI settings');
    return withDefaults(body.data);
  }

  /** Returns the value the server stored. */
  async saveSettings(value: HostedAiSettings): Promise<HostedAiSettings> {
    const response = await fetch(`${this.base}/settings/hosted_ai`, {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify({ value }),
    });
    const body = await unwrap<{ data: Partial<HostedAiSettings> | null }>(response, 'Failed to save the hosted AI settings');
    return withDefaults(body.data);
  }

  async listGrants(): Promise<HostedGrant[]> {
    const response = await fetch(`${this.base}/hosted-ai/admin/grants`, { headers: authHeaders() });
    return (await unwrap<{ data: HostedGrant[] }>(response, 'Failed to read the grants')).data;
  }

  async createGrant(input: { userId: string; tier: SupporterTier; endsAt: string }): Promise<HostedGrant> {
    const response = await fetch(`${this.base}/hosted-ai/admin/grants`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify(input),
    });
    return (await unwrap<{ data: HostedGrant }>(response, 'Failed to create the grant')).data;
  }

  async revokeGrant(id: number): Promise<HostedGrant> {
    const response = await fetch(`${this.base}/hosted-ai/admin/grants/${id}`, { method: 'DELETE', headers: authHeaders() });
    return (await unwrap<{ data: HostedGrant }>(response, 'Failed to revoke the grant')).data;
  }

  async fetchPause(): Promise<HostedPause> {
    const response = await fetch(`${this.base}/hosted-ai/pause`, { headers: authHeaders() });
    return (await unwrap<{ data: HostedPause }>(response, 'Failed to read the pause')).data;
  }

  async liftPause(): Promise<HostedPause> {
    const response = await fetch(`${this.base}/hosted-ai/pause/lift`, { method: 'POST', headers: authHeaders() });
    return (await unwrap<{ data: HostedPause }>(response, 'Failed to lift the pause')).data;
  }

  async fetchSpendReport(days: number): Promise<HostedSpendDay[]> {
    const response = await fetch(`${this.base}/hosted-ai/admin/spend-report?days=${days}`, { headers: authHeaders() });
    return (await unwrap<{ data: { days: HostedSpendDay[] } }>(response, 'Failed to read the spend report')).data.days;
  }
}

export default new HostedAiAdminService();
