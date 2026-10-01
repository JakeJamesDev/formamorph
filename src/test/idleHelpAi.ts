import type { HelpAi } from '@/components/formaquestion/useHelpAi';
import { textSnapshot } from './aiTextFixtures';

const ai: HelpAi = { snapshot: textSnapshot(), language: 'English', reachable: true, revalidate: async () => true, readsImages: false };

/**
 * Stands in for `useHelpAi` in a test that mounts Formaquestion and asks no question. The real hook reads
 * the app's settings providers. Use: `vi.mock('<path>/useHelpAi', () => import('@/test/idleHelpAi'))`.
 */
export const useHelpAi = (): HelpAi => ai;
