import { useEffect, useState } from 'react';
import { useAgeGate } from '@/contexts/AgeGateContext';
import { useSettings } from '@/contexts/SettingsContext';
import { hostedSession } from '@/lib/hostedAi/hostedSession';
import { HOSTED_STATE_URL } from '@/lib/hostedAi/hostedUrls';
import { readHostedDevice, shouldSwitchOnce, writeHostedDevice } from '@/lib/hostedAi/hostedAllowance';
import { FORMAMORPH_AI_PRESET_ID } from '@/lib/textEndpointPresets';
import AuthService from '@/services/AuthService';

/**
 * Every automatic read of the hosted state, and the one-time switch to Formamorph AI. It reads the state while
 * any prompt can send to Formamorph AI, narration is on the Demo AI, or the device never switched, once for
 * each account the age gate has an answer for. The Demo AI read keeps the offer from a pledged player who
 * switched back. The first time a device that never switched sees a usable tier, the preset changes. It sits
 * inside the age gate because that gate decides whether the community server is asked anything at boot.
 */
export function HostedAiStateSync() {
  const { attested, attestedSession } = useAgeGate();
  const { hostedAi, hostedInUse, narrationIsDemoAI, selectTextEndpointPreset } = useSettings();
  const [switched, setSwitched] = useState(() => readHostedDevice().switched);
  const readState = hostedInUse || narrationIsDemoAI || !switched;

  useEffect(() => AuthService.onSessionChanged(() => hostedSession.accountChanged()), []);

  // A new account reads once the gate has its answer.
  useEffect(() => {
    if (!readState || attestedSession === null || !HOSTED_STATE_URL) return;
    void hostedSession.refresh();
  }, [readState, attestedSession]);

  useEffect(() => {
    if (!attested || !shouldSwitchOnce(hostedAi.hosted, readHostedDevice())) return;
    // The selection records the preset it replaces; the flag joins that record.
    selectTextEndpointPreset(FORMAMORPH_AI_PRESET_ID);
    writeHostedDevice({ ...readHostedDevice(), switched: true });
    setSwitched(true);
  }, [attested, hostedAi.hosted, selectTextEndpointPreset]);

  return null;
}
