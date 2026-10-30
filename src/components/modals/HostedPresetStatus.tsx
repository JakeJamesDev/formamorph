import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/typography';
import { PATREON_PAGE_URL } from '@/components/PatreonSection';
import { requestClientUpdate } from '@/components/modals/UpdateRequiredDialog';
import { useAgeGate } from '@/contexts/AgeGateContext';
import { usePrivacyPolicy } from '@/contexts/PrivacyPolicyContext';
import { useSettings } from '@/contexts/SettingsContext';
import { hostedStateCopy, type HostedAction } from '@/lib/hostedAi/hostedCopy';
import type { HostedPresetState } from '@/lib/hostedAi/refusals';
import { openExternal } from '@/lib/openExternal';
import { requestSignIn } from '@/lib/signInStore';

/** Formamorph AI's state in place of the connection fields: its reason and its one action. `state` overrides the live one. */
export function HostedPresetStatus({ state }: { state?: HostedPresetState }) {
  const { hostedAi, refreshHostedState } = useSettings();
  const { requireAttestation } = useAgeGate();
  const { checkNow } = usePrivacyPolicy();
  const shown = state ?? hostedAi.presetState;
  const copy = hostedStateCopy(shown);

  const run: Record<HostedAction, () => void> = {
    signIn: () => requestSignIn({ onSignedIn: () => { void refreshHostedState(); } }),
    privacy: () => { void checkNow(); },
    ageGate: () => requireAttestation(),
    patreon: () => openExternal(PATREON_PAGE_URL),
    update: () => requestClientUpdate({ feature: 'Formamorph AI', minVersion: '' }),
    recheck: () => { void refreshHostedState(); },
  };

  return (
    <div className="flex flex-col items-start gap-3 py-4" data-hosted-state={shown}>
      {copy && <Hint>{copy.reason}</Hint>}
      {copy?.action && (
        <Button variant="outline" onClick={run[copy.action.kind]}>{copy.action.label}</Button>
      )}
    </div>
  );
}
