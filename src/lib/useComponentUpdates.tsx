import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import { UpdateAvailableDialog, type IncomingFile } from '@/components/modals/UpdateAvailableDialog';
import { affectedCopies, type LiveWorld } from '@/lib/componentUpdateRun';
import type { UpdateRow } from '@/lib/componentUpdates';
import {
  libraryItemData, libraryItems, replaceLibraryItemContent, type LibraryKind,
} from '@/lib/librarySources';
import { contentMatchesSource, type LibrarySource, type LinkableContent } from '@/lib/linkedContent';

/** One review in progress: the item checked, its content, and the worlds behind it. */
interface Review {
  source: LibrarySource;
  sourceData: LinkableContent | null;
  rows: UpdateRow[];
  /** Present when the content under review came from an imported file. */
  incoming?: IncomingFile;
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

  /**
   * Review an imported file against the library item its source already has here.
   *
   * The file is the incoming revision: nothing is written until Apply Updates, which saves it to the
   * library item and then runs each world's answer. A file that matches the item changes nothing, and a
   * file no world holds a copy of is simply saved.
   *
   * @param kind - Which library the item is in
   * @param libraryId - The library item the file's source names here
   * @param content - The file's content
   */
  const reviewImportedFile = useCallback(async (
    kind: LibraryKind, libraryId: string, content: LinkableContent,
  ) => {
    const item = (await libraryItems(kind)).find((row) => row.id === libraryId);
    if (!item) throw new Error('The library item this file follows is gone.');

    const held = await libraryItemData(kind, libraryId);
    if (held && contentMatchesSource(content, held)) {
      toast.info(`"${item.name}" already holds what this file carries.`);
      return;
    }

    // One marker for the whole review, so a retry writes the same revision rather than a second one.
    const revision = new Date().toISOString();
    const commit = () => replaceLibraryItemContent(kind, libraryId, content, revision);
    const source: LibrarySource = { ...item, revision };
    const rows = await affectedCopies(source, liveRef.current);
    if (!rows.length) {
      await commit();
      toast.success(`"${item.name}" updated from the imported file.`);
      return;
    }

    setReview({
      source,
      sourceData: content,
      rows,
      incoming: {
        label: 'File',
        description: `The imported file differs from the library ${kind === 'dictionary' ? 'dictionary' : 'entity'} “${item.name}”. Choose what each world does.`,
        commit,
      },
    });
  }, []);

  const updateDialog: ReactNode = (
    <UpdateAvailableDialog
      source={review?.source ?? null}
      sourceData={review?.sourceData ?? null}
      rows={review?.rows ?? []}
      live={live}
      incoming={review?.incoming}
      onClose={() => setReview(null)}
    />
  );

  return { checkForUpdates, reviewImportedFile, updateDialog };
}
