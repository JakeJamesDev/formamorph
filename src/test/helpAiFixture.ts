import type { HelpAi } from '@/components/formaquestion/useHelpAi';
import { textSnapshot, textTarget } from './aiTextFixtures';

/** The AI settings of a help question on an endpoint nothing has probed, connected, with `over` applied. */
export function helpAi(over: Partial<HelpAi> = {}): HelpAi {
  const { reasoning, localEngine, maxTokens } = textTarget();
  return {
    snapshot: textSnapshot(), language: 'English', reachable: true, revalidate: async () => true, readsImages: false,
    answerTarget: { reasoning, localEngine, maxTokens },
    requestSurface: () => {},
    ...over,
  };
}
