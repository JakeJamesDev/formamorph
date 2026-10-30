import { Button } from '@/components/ui/button';
import { Hint, Meta } from '@/components/ui/typography';
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
import { SUPPORTER_LABELS } from '@/lib/supporterFlair';
import type { SupporterTier } from '@/types/supporter';

/** The dev route's canned usage, so `fixture=fai-<state>` shows the allowance lines without a server. */
const DEV_SAMPLE: Partial<Record<HostedPresetState, Pick<HostedState, 'tier' | 'percentUsed' | 'turnsLeft' | 'resetAt'>>> = {
  ready: { tier: 'supporter_plus', percentUsed: 32, turnsLeft: 41, resetAt: '2026-12-01T00:00:00.000Z' },
  warned: { tier: 'supporter_plus', percentUsed: 78, turnsLeft: 9, resetAt: '2026-12-01T00:00:00.000Z' },
  exhausted: { tier: 'supporter_plus', percentUsed: 100, turnsLeft: 0, resetAt: '2026-12-01T00:00:00.000Z' },
};

/** Formamorph AI's state in place of the connection fields: its allowance, its reason and its actions. `state` overrides the live one. */
export function HostedPresetStatus({ state }: { state?: HostedPresetState }) {
  const { hostedAi, refreshHostedState, switchBackFromHostedAi } = useSettings();
  const { requireAttestation } = useAgeGate();
  const { checkNow } = usePrivacyPolicy();
  const shown = state ?? hostedAi.presetState;
  const sample = import.meta.env.DEV && state ? DEV_SAMPLE[state] : undefined;
  const hosted = sample ? ({ ...hostedAi.hosted, ...sample } as HostedState) : hostedAi.hosted;
  const copy = hostedStateCopy(shown, hosted?.resetAt);
  const tierLabel = hosted?.tier ? SUPPORTER_LABELS[hosted.tier as SupporterTier] ?? null : null;
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
