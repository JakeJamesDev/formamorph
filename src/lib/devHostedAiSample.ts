import type {
  HostedAiAdminApi, HostedAiSettings, HostedGrant, HostedPause, HostedSpendDay,
} from '@/services/HostedAiAdminService';

/**
 * DEV: an in-memory stand-in for the hosted AI admin routes (`#dev?modal=adminPanel&tab=serverSettings&fixture=hostedAi`).
 *
 * Every figure is a placeholder to make the panel render; none is a real window, price or budget.
 */
export function createDevHostedAiApi(): HostedAiAdminApi {
  let settings: HostedAiSettings = {
    models: [
      {
        id: 'sample-a', model: 'vendor/sample-a', prices: { prompt: 1, completion: 2 },
        capabilities: { tools: true, reasoning: 'openai', budget: false, efforts: ['low', 'high'] },
      },
      { id: 'sample-b', model: 'vendor/sample-b', prices: { prompt: 1, completion: 2 }, capabilities: { tools: false, reasoning: null } },
    ],
    activeModel: 'sample-a',
    tiers: {
      supporter: { window: 1000, budget: 1, turnCost: 0.01 },
      supporter_plus: { window: 2000, budget: 2, turnCost: 0.01 },
      supporter_top: { window: 3000, budget: 3, turnCost: 0.01 },
    },
    maxTokensCap: 100, idleLimitSeconds: 30, tokenRatio: 3.5, tokenMargin: 10, turnLimitSeconds: 600, turnCallCap: 20,
    retentionDays: 30, warnThresholds: [75, 90], turnSample: { recent: 20, min: 3 }, parallelLimit: 4, perMinuteLimit: 20,
    dailyCeiling: 10, balanceThreshold: 5,
  };
  let pause: HostedPause = { paused: true, pausedAt: '2026-01-01T09:30:00.000Z', liftedAt: null, until: '2026-01-02T00:00:00.000Z' };
  let nextGrant = 3;
  let grants: HostedGrant[] = [
    { id: 2, userId: 'u2', username: 'sample-tester', tier: 'supporter_plus', endsAt: '2099-01-01T23:59:59.000Z', createdAt: '2026-01-01T00:00:00.000Z', revokedAt: null, subject: 'grant:2' },
    { id: 1, userId: 'u1', username: 'sample-winner', tier: 'supporter', endsAt: '2099-01-01T23:59:59.000Z', createdAt: '2026-01-01T00:00:00.000Z', revokedAt: '2026-01-02T00:00:00.000Z', subject: 'grant:1' },
  ];
  const report: HostedSpendDay[] = [
    { day: '2026-01-01', calls: 120, costMicros: 1_500_000, providerMicros: 1_600_000 },
    { day: '2026-01-02', calls: 80, costMicros: 900_000, providerMicros: null },
  ];

  return {
    fetchSettings: async () => structuredClone(settings),
    saveSettings: async (value) => { settings = structuredClone(value); return structuredClone(settings); },
    listGrants: async () => structuredClone(grants),
    createGrant: async ({ userId, tier, endsAt }) => {
      const grant: HostedGrant = { id: nextGrant, userId, username: userId, tier, endsAt, createdAt: new Date().toISOString(), revokedAt: null, subject: `grant:${nextGrant}` };
      nextGrant += 1;
      grants = [grant, ...grants];
      return grant;
    },
    revokeGrant: async (id) => {
      const target = grants.find((grant) => grant.id === id);
      if (!target) throw new Error('No such grant');
      const revoked = { ...target, revokedAt: new Date().toISOString() };
      grants = grants.map((grant) => (grant.id === id ? revoked : grant));
      return revoked;
    },
    fetchPause: async () => ({ ...pause }),
    liftPause: async () => { pause = { ...pause, paused: false, liftedAt: new Date().toISOString() }; return { ...pause }; },
    fetchSpendReport: async () => structuredClone(report),
  };
}
