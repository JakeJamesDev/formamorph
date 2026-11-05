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

/** One tier's window, weekly budget and fallback cost per turn, all dollars where money. */
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
export interface HostedUsageDay {
  day: string;
  calls: number;
  turns: number;
  accounts: number;
  costMicros: number;
  providerMicros: number | null;
}

/** One prompt type's sums. A speed figure is null when the type has no timed call in the range. */
export interface HostedPromptTypeUsage {
  promptType: string | null;
  calls: number;
  costMicros: number;
  avgPromptTokens: number | null;
  avgOutputTokens: number | null;
  cachedShare: number | null;
  firstTokenP50Ms: number | null;
  tokensPerSecondP50: number | null;
  maxGapP90Ms: number | null;
  failed: number;
}

/** Sums and call timings for a range of UTC days. It names no account. */
export interface HostedUsageReport {
  since: string;
  totals: { calls: number; turns: number; accounts: number; costMicros: number; failed: number; providerMicros: number; cachedShare: number | null };
  days: HostedUsageDay[];
  promptTypes: HostedPromptTypeUsage[];
  endings: { status: string; calls: number }[];
  failures: { failure: string; calls: number }[];
  tiers: { tier: SupporterTier; entitled: number; active: number; turns: number; costMicros: number; topBudgetShare: number | null }[];
  slowest: { startedAt: string; promptType: string | null; firstTokenMs: number | null; maxGapMs: number | null; tokensPerSecond: number | null; status: string; failure: string | null }[];
  heaviest: { tier: SupporterTier; turns: number; costMicros: number; budgetShare: number | null }[];
  offer: { step: string; count: number }[];
}

/** The admin surface of Formamorph AI: the setting, grants, the pause and the usage report. */
export interface HostedAiAdminApi {
  fetchSettings(): Promise<HostedAiSettings>;
  saveSettings(value: HostedAiSettings): Promise<HostedAiSettings>;
  listGrants(): Promise<HostedGrant[]>;
  createGrant(input: { userId: string; tier: SupporterTier; endsAt: string }): Promise<HostedGrant>;
  revokeGrant(id: number): Promise<HostedGrant>;
  fetchPause(): Promise<HostedPause>;
  liftPause(): Promise<HostedPause>;
  fetchUsageReport(days: number): Promise<HostedUsageReport>;
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

  async fetchUsageReport(days: number): Promise<HostedUsageReport> {
    const response = await fetch(`${this.base}/hosted-ai/admin/usage-report?days=${days}`, { headers: authHeaders() });
    return (await unwrap<{ data: HostedUsageReport }>(response, 'Failed to read the usage report')).data;
  }
}

export default new HostedAiAdminService();
