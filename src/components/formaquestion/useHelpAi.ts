import { useEffect, useMemo } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import type { AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { useAiSettingsSnapshot } from '@/lib/aiRequest/useAiSettingsSnapshot';
import { helpRoutes } from '@/lib/formaquestion/helpRoutes';
import type { HelpSettings } from '@/lib/formaquestion/helpSettings';
import { isDemoAI } from '@/lib/textEndpointPresets';
import { useAiReachable } from '@/lib/useAiReachable';
import { useImageAttachments } from '@/lib/useImageAttachments';

/** The owner name of Formaquestion's claim on the bundled engine. */
const ENGINE_OWNER = 'formaquestion';

/** What a help question needs from the app's AI settings. */
export interface HelpAi {
  snapshot: AiSettingsSnapshot;
  /** The AI Language setting. */
  language: string;
  /** False when the answer endpoint cannot answer, null while the check runs or has not run. */
  reachable: boolean | null;
  /** Checks the answer endpoint again, now. */
  revalidate: () => Promise<boolean>;
  /** The Image Attachments setting: the player's model reads images. */
  readsImages: boolean;
}

/**
 * The app's AI settings for Formaquestion. The reachability check runs only while `enabled`, on the endpoint
 * answers resolve to. The default cloud endpoint counts as connected and gets no check. While either help
 * route resolves to the bundled engine, the engine is wanted.
 */
export function useHelpAi(enabled: boolean, settings: Pick<HelpSettings, 'answerEndpoint' | 'pickEndpoint'>): HelpAi {
  const snapshot = useAiSettingsSnapshot();
  const { resolveEndpointForKind, claimEngine, language } = useSettings();
  const { answerEndpoint, pickEndpoint } = settings;
  const routes = useMemo(() => helpRoutes({ answerEndpoint, pickEndpoint }), [answerEndpoint, pickEndpoint]);
  const answer = resolveEndpointForKind('help', routes.answer);
  const onEngine = answer.localEngine || resolveEndpointForKind('help', routes.pick).localEngine;
  useEffect(() => claimEngine(ENGINE_OWNER, onEngine), [claimEngine, onEngine]);
  useEffect(() => () => claimEngine(ENGINE_OWNER, false), [claimEngine]);

  const demoAI = isDemoAI(answer);
  const { localEngine, url, apiToken, model } = answer;
  const target = useMemo(() => ({ localEngine, url, apiToken, model }), [localEngine, url, apiToken, model]);
  const { reachable, revalidate } = useAiReachable({ enabled: enabled && !demoAI, target });
  const readsImages = useImageAttachments();
  return useMemo(
    () => ({ snapshot, language, reachable: demoAI ? true : reachable, revalidate, readsImages }),
    [snapshot, language, demoAI, reachable, revalidate, readsImages],
  );
}
