import { createContext, useContext } from 'react';
import { openWorldBlock, type SupporterCopyAction } from '@/lib/supporterCopy';
import type { SupporterCopyMarker } from '@/types';

const SupporterCopyContext = createContext<SupporterCopyMarker | null | undefined>(null);

/** Gives the controls inside an editor the marker of the world it edits: undefined while unread. Absent reads as a plain world. */
export const SupporterCopyProvider = SupporterCopyContext.Provider;

/** Why `action` is blocked on the world this control sits in, or null when it is allowed. */
export function useSupporterCopyBlock(action: SupporterCopyAction): string | null {
  return openWorldBlock(useContext(SupporterCopyContext), action);
}
