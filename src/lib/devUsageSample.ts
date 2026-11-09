import type { HostedAiAdminApi, HostedUsageReport } from '@/services/HostedAiAdminService';

const DAY_MS = 86_400_000;
const WAVE = [12, 15, 9, 18, 21, 16, 11, 14, 23, 26, 19, 13, 17, 24, 28, 22, 15, 18, 29, 31, 24, 17, 20, 33, 36, 27, 19, 25, 38, 22];

/**
 * DEV: an in-memory stand-in for the usage report route (`#dev?modal=adminPanel&tab=usage&fixture=usage`).
 *
 * Every figure is a placeholder to make the tab render; none is a real price, budget or count.
 */
export function createDevUsageApi(): Pick<HostedAiAdminApi, 'fetchUsageReport'> {
  return {
    fetchUsageReport: async (count) => {
      const today = Math.floor(Date.now() / DAY_MS) * DAY_MS;
      const days: HostedUsageReport['days'] = Array.from({ length: count }, (_, index) => {
        const wave = WAVE[WAVE.length - count + index] ?? 10;
        const last = index === count - 1;
        return {
          day: new Date(today - (count - 1 - index) * DAY_MS).toISOString().slice(0, 10),
          calls: wave * 20,
          turns: wave * 3,
          accounts: 3 + Math.round(wave / 4),
          costMicros: wave * 100_000,
          providerMicros: last ? null : wave * 103_000,
          installs: 400 + wave * 15,
        };
      });
      const sum = (pick: (day: HostedUsageReport['days'][number]) => number) => days.reduce((total, day) => total + pick(day), 0);
      const costMicros = sum((day) => day.costMicros);
      const calls = sum((day) => day.calls);
      const turns = sum((day) => day.turns);
      const row = (promptType: string | null, share: number, first: number | null) => ({
        promptType,
        calls: Math.round(calls * share),
        costMicros: Math.round(costMicros * share),
        avgPromptTokens: 4000,
        avgOutputTokens: first === null ? null : 120,
        cachedShare: 0.5,
        firstTokenP50Ms: first,
        tokensPerSecondP50: first === null ? null : 50,
        maxGapP90Ms: first === null ? null : first + 500,
        failed: promptType === 'narration' ? 3 : 0,
      });

      const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * DAY_MS;

      return {
        since: `${days[0].day}T00:00:00.000Z`,
        week: { since: new Date(monday).toISOString(), resetAt: new Date(monday + 7 * DAY_MS).toISOString() },
        activeUsers: {
          installs: { today: 610, yesterday: 820, month: 1900, averageDay: 760 },
          accounts: { today: 6, yesterday: 9, month: 18, averageDay: 7.5 },
        },
        totals: { calls, turns, accounts: 16, costMicros, failed: 3, providerMicros: sum((day) => day.providerMicros ?? 0), cachedShare: 0.5 },
        days,
        promptTypes: [row('narration', 0.5, 2100), row('summary', 0.2, 1600), row('choices', 0.15, 1400), row('statUpdates', 0.1, 1300), row('help', 0.04, null), row(null, 0.01, null)],
        endings: [{ status: 'ok', calls: calls - 5 }, { status: 'aborted', calls: 2 }, { status: 'error', calls: 3 }],
        failures: [{ failure: 'thinking', calls: 2 }, { failure: 'status_503', calls: 1 }],
        tiers: [
          { tier: 'supporter', entitled: 6, active: 3, turns: Math.round(turns * 0.2), costMicros: Math.round(costMicros * 0.2), topBudgetShare: 0.3 },
          { tier: 'supporter_plus', entitled: 8, active: 6, turns: Math.round(turns * 0.6), costMicros: Math.round(costMicros * 0.6), topBudgetShare: 0.7 },
          { tier: 'supporter_top', entitled: 2, active: 0, turns: 0, costMicros: 0, topBudgetShare: null },
        ],
        slowest: [
          { startedAt: `${days[days.length - 1].day}T18:44:00.000Z`, promptType: 'narration', firstTokenMs: 38_000, maxGapMs: 31_000, tokensPerSecond: 9, status: 'ok', failure: null },
          { startedAt: `${days[days.length - 1].day}T18:51:00.000Z`, promptType: 'summary', firstTokenMs: 22_000, maxGapMs: 18_000, tokensPerSecond: 14, status: 'ok', failure: null },
          { startedAt: `${days[0].day}T02:16:00.000Z`, promptType: 'narration', firstTokenMs: 19_000, maxGapMs: 30_000, tokensPerSecond: null, status: 'error', failure: 'idle_limit' },
        ],
        heaviest: [
          { tier: 'supporter_plus', turns: Math.round(turns * 0.3), costMicros: Math.round(costMicros * 0.3), budgetShare: 0.7 },
          { tier: 'supporter_plus', turns: Math.round(turns * 0.2), costMicros: Math.round(costMicros * 0.2), budgetShare: 0.5 },
          { tier: 'supporter', turns: Math.round(turns * 0.1), costMicros: Math.round(costMicros * 0.1), budgetShare: null },
        ],
        offer: [
          { step: 'offer_shown', count: count * 30 },
          { step: 'see_levels', count: count * 12 },
          { step: 'patreon_click', count: count * 3 },
          { step: 'checklist_finished', count: count },
        ],
        reservations: {
          overall: { calls: 400, reserveMicros: 4_000_000, costMicros: 1_400_000, ratio: 0.35 },
          promptTypes: [
            { promptType: 'narration', calls: 250, reserveMicros: 3_000_000, costMicros: 1_100_000, ratio: 1.1 / 3 },
            { promptType: 'summary', calls: 150, reserveMicros: 1_000_000, costMicros: 300_000, ratio: 0.3 },
          ],
        },
        clients: [
          { clientVersion: '3.6.2', calls: 900, turns: 160, costMicros: 240_000, turnsWithoutNarration: 2 },
          { clientVersion: '3.6.1', calls: 300, turns: 50, costMicros: 80_000, turnsWithoutNarration: 0 },
          { clientVersion: null, calls: 4, turns: 1, costMicros: 1_000, turnsWithoutNarration: 1 },
        ],
        refusals: {
          days: [],
          tiers: [
            { tier: 'supporter', code: 'budget_exhausted', count: 12, accounts: 2 },
            { tier: null, code: 'not_entitled', count: 30, accounts: 9 },
            { tier: 'supporter_plus', code: 'rate_limited', count: 4, accounts: 1 },
          ],
          budgetExhaustedAccounts: 2,
        },
      };
    },
  };
}
