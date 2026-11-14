import { createContext, useContext } from 'react';
import { openWorldBlock, supporterCopyBlock, type SupporterCopyAction } from '@/lib/supporterCopy';
import type { LibrarySupporterCopyMarker, SupporterCopyMarker } from '@/types';

const SupporterCopyContext = createContext<SupporterCopyMarker | null | undefined>(null);

/** Gives the controls inside an editor the marker of the world it edits: undefined while unread. Absent reads as a plain world. */
export const SupporterCopyProvider = SupporterCopyContext.Provider;

/** Why `action` is blocked on the world this control sits in, or null when it is allowed. */
export function useSupporterCopyBlock(action: SupporterCopyAction): string | null {
  return openWorldBlock(useContext(SupporterCopyContext), action);
}

const OpenWorldIdContext = createContext<string | undefined>(undefined);

/** Gives the library pickers inside a world the id of the world a pick would go into. */
export const OpenWorldIdProvider = OpenWorldIdContext.Provider;

/**
 * Why a library item can't be added to the world this control sits in, or null when it can. A picker outside
 * any world has no id, so a marked item stays blocked there.
 */
export function useLibraryAddBlock(): (item: { supporterCopy?: LibrarySupporterCopyMarker }) => string | null {
  const worldId = useContext(OpenWorldIdContext);
  return (item) => supporterCopyBlock(item, { addToWorld: worldId ?? '' });
}
