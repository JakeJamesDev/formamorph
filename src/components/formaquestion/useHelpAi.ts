import { useMemo } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import type { AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { useAiSettingsSnapshot } from '@/lib/aiRequest/useAiSettingsSnapshot';
import { useAiReachable } from '@/lib/useAiReachable';

/** What a help question needs from the app's AI settings. */
export interface HelpAi {
  snapshot: AiSettingsSnapshot;
  /** False when the active AI cannot answer, null while the check runs or has not run. */
  reachable: boolean | null;
  /** Checks the active AI again, now. */
  revalidate: () => Promise<boolean>;
}

/**
 * The app's AI settings for Formaquestion. The reachability check runs only while `enabled`. The default
 * cloud endpoint counts as connected and gets no check.
 */
export function useHelpAi(enabled: boolean): HelpAi {
  const snapshot = useAiSettingsSnapshot();
  const { activeTextEndpointIsDemoAI } = useSettings();
  const { reachable, revalidate } = useAiReachable({ enabled: enabled && !activeTextEndpointIsDemoAI });
  return useMemo(
    () => ({ snapshot, reachable: activeTextEndpointIsDemoAI ? true : reachable, revalidate }),
    [snapshot, activeTextEndpointIsDemoAI, reachable, revalidate],
  );
}
