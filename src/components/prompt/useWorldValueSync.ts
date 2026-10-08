import { useCallback } from 'react';
import { HISTORIC_TAG, HISTORY_MERGE_TAG } from 'lexical';
import { useWorldHistoryMovesOptional } from '@/contexts/worldRecorder';

/** Tags a rebuild to a world restore: no history entry, and the field's own stacks end there. */
export const WORLD_RESTORE_TAG = 'world-restore';
const RESTORE_TAGS = [HISTORY_MERGE_TAG, WORLD_RESTORE_TAG];

/** A Lexical field's value sync, in the world history: both calls do nothing outside an open world. */
export function useWorldValueSync() {
  const moves = useWorldHistoryMovesOptional();
  /** Marks the write that follows as the field's own undo or redo when the update came from its history. */
  const markWrite = useCallback((tags: ReadonlySet<string>) => {
    if (tags.has(HISTORIC_TAG)) moves?.markFieldHistory();
  }, [moves]);
  /** The tags for a rebuild to a new value, when the value is a world restore. */
  const restoreTags = useCallback(
    (value: string) => (moves?.isRestoredText(value) ? RESTORE_TAGS : undefined),
    [moves],
  );
  return { markWrite, restoreTags };
}
