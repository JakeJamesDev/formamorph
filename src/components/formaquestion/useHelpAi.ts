import { useEffect, useMemo } from 'react';
import type { ReasoningFieldTarget } from '@/components/modals/promptReasoningField';
import { useSettings } from '@/contexts/SettingsContext';
import type { AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import type { SurfaceRoute } from '@/lib/surface/surfaceRoute';
import { useAiSettingsSnapshot } from '@/lib/aiRequest/useAiSettingsSnapshot';
import { helpRoutes } from '@/lib/formaquestion/helpRoutes';
import type { HelpSettings } from '@/lib/formaquestion/helpSettings';
import { isDemoAI } from '@/lib/textEndpointPresets';
import { useAiReachable } from '@/lib/useAiReachable';
import { useImageAttachments } from '@/lib/useImageAttachments';

/** The owner name of Formaquestion's claim on the bundled engine. */
const ENGINE_OWNER = 'formaquestion';

/** What a help question needs from the app's AI settings, and the window's one way into the app's navigation. */
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
  /** What the Reasoning row reads off the endpoint answers resolve to. */
  answerTarget: ReasoningFieldTarget;
  /** Asks the app to open a surface. */
  requestSurface: (route: SurfaceRoute) => void;
}

/**
 * The app's AI settings for Formaquestion. The reachability check runs only while `enabled`, on the endpoint
 * answers resolve to. The default cloud endpoint counts as connected and gets no check. While the answer or
 * search route, the Intent Classifier route while it is on, or the Create route while Creation is on, resolves to
 * the bundled engine, the engine is wanted.
 */
export function useHelpAi(enabled: boolean, settings: Pick<HelpSettings, 'answerEndpoint' | 'pickEndpoint' | 'intentEndpoint' | 'intentClassifier' | 'createEndpoint' | 'creation'>): HelpAi {
  const snapshot = useAiSettingsSnapshot();
  const { resolveEndpointForKind, claimEngine, language, requestSurface } = useSettings();
  const { answerEndpoint, pickEndpoint, intentEndpoint, intentClassifier, createEndpoint, creation } = settings;
  const routes = useMemo(() => helpRoutes({ answerEndpoint, pickEndpoint, intentEndpoint, createEndpoint }), [answerEndpoint, pickEndpoint, intentEndpoint, createEndpoint]);
  const answer = resolveEndpointForKind('help', routes.answer);
  const onEngine = answer.localEngine || resolveEndpointForKind('help', routes.pick).localEngine
    || (intentClassifier && resolveEndpointForKind('help', routes.intent).localEngine)
    || (intentClassifier && creation && resolveEndpointForKind('help', routes.create).localEngine);
  useEffect(() => claimEngine(ENGINE_OWNER, onEngine), [claimEngine, onEngine]);
  useEffect(() => () => claimEngine(ENGINE_OWNER, false), [claimEngine]);

  const demoAI = isDemoAI(answer);
  const { localEngine, url, apiToken, model, reasoning, maxTokens } = answer;
  const target = useMemo(() => ({ localEngine, url, apiToken, model }), [localEngine, url, apiToken, model]);
  const { reachable, revalidate } = useAiReachable({ enabled: enabled && !demoAI, target });
  const readsImages = useImageAttachments();
  const answerTarget = useMemo(() => ({ reasoning, localEngine, maxTokens }), [reasoning, localEngine, maxTokens]);
  return useMemo(
    () => ({ snapshot, language, reachable: demoAI ? true : reachable, revalidate, readsImages, answerTarget, requestSurface }),
    [snapshot, language, demoAI, reachable, revalidate, readsImages, answerTarget, requestSurface],
  );
}
