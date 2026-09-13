import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import { UpdateAvailableDialog } from '@/components/modals/UpdateAvailableDialog';
import { affectedCopies, type LiveWorld } from '@/lib/componentUpdateRun';
import type { UpdateRow } from '@/lib/componentUpdates';
import { libraryItemData, libraryItems, type LibraryKind } from '@/lib/librarySources';
import type { LibrarySource, LinkableContent } from '@/lib/linkedContent';

/** One review in progress: the item checked, its content, and the worlds behind it. */
interface Review {
  source: LibrarySource;
  sourceData: LinkableContent | null;
  rows: UpdateRow[];
}

/**
 * Check for Updates, and the review it opens.
 *
 * The check compares one library item's revision against every world copy that follows it. A check that
 * finds nothing says so and opens nothing; a check that finds something opens the review, where the
 * player answers per world.
 *
 * @param live - Worlds held in memory, whose copies the review reads and writes there
 */
export function useComponentUpdates(live?: LiveWorld[]) {
  const [review, setReview] = useState<Review | null>(null);

  // The editor rebuilds `live` on every keystroke, so the check reads it rather than depending on it.
  const liveRef = useRef(live);
  useEffect(() => { liveRef.current = live; });

  const checkForUpdates = useCallback(async (kind: LibraryKind, libraryId: string) => {
    try {
      const item = (await libraryItems(kind)).find((row) => row.id === libraryId);
      if (!item) {
        toast.error('The library item this copy follows is gone, so there is nothing to check.');
        return;
      }
      const rows = await affectedCopies(item, liveRef.current);
      if (!rows.length) {
        toast.info(`"${item.name}" is up to date.`);
        return;
      }
      setReview({ source: item, sourceData: await libraryItemData(kind, libraryId), rows });
    } catch (error) {
      toast.error((error as Error).message || 'Formamorph could not check for updates.');
    }
  }, []);

  const updateDialog: ReactNode = (
    <UpdateAvailableDialog
      source={review?.source ?? null}
      sourceData={review?.sourceData ?? null}
      rows={review?.rows ?? []}
      live={live}
      onClose={() => setReview(null)}
    />
  );

  return { checkForUpdates, updateDialog };
}
