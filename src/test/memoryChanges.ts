import type { MemoryNote, MemoryOverrides } from '@/lib/memoryOverrides';
import { foldMemoryChanges, type TextRewrite } from '@/lib/turnTextEdits';

/** Memory changes as the readers take them: memory rewrites, deletions and written memories. */
export const changes = ({ notes, edits, deleted }: {
  edits?: Record<string, TextRewrite>; deleted?: readonly string[]; notes?: MemoryNote[];
}): MemoryOverrides => ({
  textEdits: foldMemoryChanges(undefined, edits, deleted),
  ...(notes ? { notes } : {}),
});

/** A text edit layer holding `edits` and `deleted`. */
export const layerOf = ({ edits, deleted }: { edits?: Record<string, TextRewrite>; deleted?: readonly string[] }) =>
  foldMemoryChanges(undefined, edits, deleted);
