import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Hint, Meta } from '@/components/ui/typography';
import { HostedBreakdown } from '@/components/modals/HostedBreakdown';
import { PATREON_PAGE_URL } from '@/components/PatreonSection';
import { requestClientUpdate } from '@/components/modals/UpdateRequiredDialog';
import { useAgeGate } from '@/contexts/AgeGateContext';
import { usePrivacyPolicy } from '@/contexts/PrivacyPolicyContext';
import { useSettings } from '@/contexts/SettingsContext';
import { hostedStateCopy, hostedUsageCopy, HOSTED_USAGE_HELP, type HostedAction } from '@/lib/hostedAi/hostedCopy';
import type { HostedState } from '@/lib/hostedAi/hostedState';
import type { HostedPresetState } from '@/lib/hostedAi/refusals';
import { openExternal } from '@/lib/openExternal';
import { requestSignIn } from '@/lib/signInStore';
import { flairTier } from '@/lib/supporterFlair';
import { useTierName } from '@/lib/tierNames';

/** The dev route's canned usage, so `fixture=fai-<state>` shows the allowance lines without a server. */
const DEV_SAMPLE: Partial<Record<HostedPresetState, Pick<HostedState, 'tier' | 'percentUsed' | 'turnsLeft' | 'resetAt' | 'breakdown' | 'breakdownThreshold'>>> = {
  ready: {
    tier: 'supporter_plus', percentUsed: 32, turnsLeft: 41, resetAt: '2026-11-09T00:00:00.000Z', breakdownThreshold: 10,
    breakdown: { narration: 48.3, thinking: 11.6, director: 3.1, choices: 8.4, statUpdates: 12.2, timePassed: 1.5, inventory: 4.9, summary: 6.7, help: 3.0, other: 1.8 },
  },
  warned: {
    tier: 'supporter_plus', percentUsed: 78, turnsLeft: 9, resetAt: '2026-11-09T00:00:00.000Z', breakdownThreshold: 10,
    breakdown: { narration: 52.0, thinking: 14.0, choices: 9.0, statUpdates: 16.5, inventory: 3.5, summary: 5.0 },
  },
  exhausted: {
    tier: 'supporter_plus', percentUsed: 100, turnsLeft: 0, resetAt: '2026-11-09T00:00:00.000Z', breakdownThreshold: 10,
    breakdown: { narration: 60.0, thinking: 20.0, choices: 20.0 },
  },
};

/** Formamorph AI's state in place of the connection fields: its allowance, its reason and its actions. `state` overrides the live one. */
export function HostedPresetStatus({ state }: { state?: HostedPresetState }) {
  const { hostedAi, refreshHostedState, switchBackFromHostedAi } = useSettings();
  const { requireAttestation } = useAgeGate();
  const { checkNow } = usePrivacyPolicy();
  const tierNameOf = useTierName();
  const shown = state ?? hostedAi.presetState;

  // This surface shows only with Formamorph AI selected, so the read costs nobody else a request.
  useEffect(() => {
    if (!state) void refreshHostedState();
  }, [state, refreshHostedState]);
  const sample = import.meta.env.DEV && state ? DEV_SAMPLE[state] : undefined;
  const hosted = sample ? ({ ...hostedAi.hosted, ...sample } as HostedState) : hostedAi.hosted;
  const copy = hostedStateCopy(shown, hosted?.resetAt);
  const knownTier = flairTier(hosted?.tier ? { tier: hosted.tier } : null);
  const tierLabel = knownTier ? tierNameOf(knownTier) : null;
  const usage = shown === 'ready' || shown === 'warned' || shown === 'exhausted' ? hostedUsageCopy(hosted, tierLabel) : null;

  const run: Record<HostedAction, () => void> = {
    signIn: () => requestSignIn({ onSignedIn: () => { void refreshHostedState(); } }),
    privacy: () => { void checkNow(); },
    ageGate: () => requireAttestation(),
    patreon: () => openExternal(PATREON_PAGE_URL),
    update: () => requestClientUpdate({ feature: 'Formamorph AI', minVersion: '' }),
    recheck: () => { void refreshHostedState(); },
    switchBack: () => { if (!state) switchBackFromHostedAi(); },
  };

  return (
    <div className="flex flex-col items-start gap-3 py-4" data-hosted-state={shown}>
      {usage && (
        <div className="flex flex-col gap-1" data-hosted-usage>
          <Meta>{[usage.tier, usage.used, usage.turnsLeft, usage.resets].filter(Boolean).join(' · ')}</Meta>
          <Hint>{HOSTED_USAGE_HELP}</Hint>
          {hosted?.breakdown && (
            <div className="mt-3 w-full max-w-sm">
              <HostedBreakdown breakdown={hosted.breakdown} threshold={hosted.breakdownThreshold} />
            </div>
          )}
        </div>
      )}
      {copy && <Hint>{copy.reason}</Hint>}
      {copy?.action && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={run[copy.action.kind]}>{copy.action.label}</Button>
          {copy.extra && <Button variant="outline" onClick={run[copy.extra.kind]}>{copy.extra.label}</Button>}
        </div>
      )}
    </div>
  );
}
