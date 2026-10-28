import { useSyncExternalStore } from 'react';
import { supporterContent, type SupporterContentSnapshot } from './index';

/** The app's Supporter content state, as the module last published it. */
export function useSupporterContent(): SupporterContentSnapshot {
  return useSyncExternalStore(supporterContent.subscribe, supporterContent.getSnapshot);
}
