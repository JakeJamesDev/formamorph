import { useEffect, useState } from 'react';
import { useAgeGate } from '@/contexts/AgeGateContext';
import { useSettings } from '@/contexts/SettingsContext';
import { hostedSession } from '@/lib/hostedAi/hostedSession';
import { HOSTED_STATE_URL } from '@/lib/hostedAi/hostedUrls';
import { readHostedDevice, shouldSwitchOnce, writeHostedDevice } from '@/lib/hostedAi/hostedAllowance';
import { FORMAMORPH_AI_PRESET_ID } from '@/lib/textEndpointPresets';
import AuthService from '@/services/AuthService';

/**
 * The one-time switch to Formamorph AI. Once the age gate is answered, a device that never switched reads
 * the hosted state, and the first time it shows a usable tier the preset changes. It sits inside the age
 * gate because that gate decides whether the community server is asked anything at boot.
 */
export function HostedAiAutoSwitch() {
  const { attested } = useAgeGate();
  const { hostedAi, selectTextEndpointPreset } = useSettings();
  const [switched, setSwitched] = useState(() => readHostedDevice().switched);

  useEffect(() => {
    if (switched || !attested || !HOSTED_STATE_URL) return;
    void hostedSession.refresh();
    // The session drops the old account's state itself; this reads the new one's.
    return AuthService.onSessionChanged(() => { void hostedSession.refresh(); });
  }, [switched, attested]);

  useEffect(() => {
    if (!attested || !shouldSwitchOnce(hostedAi.hosted, readHostedDevice())) return;
    // The selection records the preset it replaces; the flag joins that record.
    selectTextEndpointPreset(FORMAMORPH_AI_PRESET_ID);
    writeHostedDevice({ ...readHostedDevice(), switched: true });
    setSwitched(true);
  }, [attested, hostedAi.hosted, selectTextEndpointPreset]);

  return null;
}
