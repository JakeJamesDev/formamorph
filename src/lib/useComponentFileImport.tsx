import { useCallback, useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import ConnectReferencesModal from '@/components/modals/ConnectReferencesModal';
import { ImportComponentModal } from '@/components/modals/ImportComponentModal';
import { addCopyToStoredWorld, storedWorldReferences } from '@/lib/addToStoredWorld';
import { associationRows, heldLibraryItem, type AssociationRow } from '@/lib/componentImport';
import type { ComponentFileLinks } from '@/lib/componentFileLinks';
import type { LibrarySource, LinkableContent } from '@/lib/linkedContent';
import {
  libraryItems, saveCopyToLibrary, saveDownloadToLibrary, type LibraryKind,
} from '@/lib/librarySources';
import { carriedPlaceholders } from '@/lib/placeholderHomes';
import { useComponentUpdates } from '@/lib/useComponentUpdates';
import {
  planConnections, suggestedChoices,
  type ConnectionPlan, type ReferenceChoices, type ReferenceRow,
} from '@/lib/worldReferences';
import WorldStorageService from '@/services/WorldStorageService';
import type { LibraryDetails } from '@/types';

/** What the host supplies so the review can hand a world off to Community Creations. */
export interface ComponentFileImportOptions {
  /** Open Community Creations on one world listing, where the ordinary download flow takes over. */
  onFindWorld: (listingId: string) => void;
  /** A component landed in the library, so the host can refresh its grid. */
  onImported: (kind: LibraryKind) => void;
}

/** The file under review, with what it says about where it came from. */
interface PendingImport {
  kind: LibraryKind;
  content: LinkableContent;
  links: ComponentFileLinks;
  rows: AssociationRow[];
  libraryDetails?: LibraryDetails;
}

/** One world still waiting for its copy, once the library item exists. */
interface PendingWorld {
  worldId: string;
  worldName: string;
}

/** The connection step in flight, for the one world it is about. */
interface ConnectFlow extends PendingWorld {
  rows: ReferenceRow[];
}

/** An empty plan: every reference the world already answers, and nothing to create. */
const NOTHING_TO_CONNECT: ConnectionPlan = {
  placeholders: {}, locations: {}, newLocations: [], newPlaceholders: [],
};

/**
 * Importing one component file into the library, with the worlds it says it suits.
 *
 * The file's associations are claims, not links. A world is linked because the player ticked it here, and
 * a world this machine has not got is downloaded through Community Creations rather than from the file.
 * A file whose source already has a library item is not a new component at all: it opens that item's
 * update review with the file as the incoming revision.
 */
export function useComponentFileImport({ onFindWorld, onImported }: ComponentFileImportOptions) {
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [connect, setConnect] = useState<ConnectFlow | null>(null);
  const [choices, setChoices] = useState<ReferenceChoices>({});
  const { reviewImportedFile, updateDialog } = useComponentUpdates();

  // What the remaining worlds need, held outside render because the connection step walks them one by one.
  const queue = useRef<PendingWorld[]>([]);
  const placing = useRef<{ content: LinkableContent; source: LibrarySource } | null>(null);

  /** Write one world's copy, reporting a world that could not take it without stopping the rest. */
  const place = useCallback(async (world: PendingWorld, plan: ConnectionPlan) => {
    const held = placing.current;
    if (!held) return;
    try {
      await addCopyToStoredWorld(world.worldId, held.content, held.source, plan);
    } catch (error) {
      console.error('Could not add the imported component to a world:', error);
      toast.error(`Could not add "${held.source.name}" to ${world.worldName}.`);
    }
  }, []);

  /** Take the next world off the queue: straight in where it answers everything, else ask. */
  const advance = useCallback(async () => {
    const held = placing.current;
    for (;;) {
      const next = queue.current.shift();
      if (!next || !held) {
        placing.current = null;
        setConnect(null);
        setChoices({});
        return;
      }
      let rows: ReferenceRow[] = [];
      try {
        rows = await storedWorldReferences(next.worldId, held.content);
      } catch (error) {
        console.error('Could not read what a world already answers:', error);
      }
      if (!rows.length) {
        await place(next, NOTHING_TO_CONNECT);
        continue;
      }
      setChoices(suggestedChoices(rows));
      setConnect({ ...next, rows });
      return;
    }
  }, [place]);

  /** Review one component file. */
  const reviewFile = useCallback(async (
    kind: LibraryKind, content: LinkableContent, links: ComponentFileLinks, libraryDetails?: LibraryDetails,
  ) => {
    const library = await libraryItems(kind).catch(() => []);
    const item = heldLibraryItem(links.source, library);
    if (item) {
      // Not a new component: the player already holds its source, so this is a revision of it.
      await reviewImportedFile(kind, item.id, content, libraryDetails);
      onImported(kind);
      return;
    }
    const worlds = await WorldStorageService.getWorldMetadata().catch(() => []);
    setSelected([]);
    setPending({ kind, content, links, libraryDetails, rows: associationRows(links.associations ?? [], worlds) });
  }, [onImported, reviewImportedFile]);

  /**
   * Put one file's content in the library.
   *
   * A file that names a listing lands as a copy of that listing, so a later check can tell it is behind
   * and a second import of the same listing refreshes the copy rather than leaving two rows of one name.
   * One with no listing behind it is simply the player's own item.
   *
   * @param kind - Which library the file belongs to
   * @param content - The file's content
   * @param links - What the file says about where it came from
   * @returns The library item, as the copies that follow it name it
   */
  const storeFile = useCallback(async (
    kind: LibraryKind, content: LinkableContent, links: ComponentFileLinks, libraryDetails?: LibraryDetails,
  ): Promise<LibrarySource> => {
    const listing = links.source?.sourceId;
    if (!listing) return saveCopyToLibrary(content, carriedPlaceholders(content), [], libraryDetails);
    const installed = await saveDownloadToLibrary(kind, content, {
      sourceId: listing,
      ...(links.source?.sourceName ? { name: links.source.sourceName } : {}),
    }, libraryDetails);
    return {
      id: installed.libraryId,
      name: installed.name,
      revision: installed.revision,
      owned: false,
      sourceId: installed.sourceId,
    };
  }, []);

  /** Store the reviewed file, then give each ticked world its copy. */
  const confirmImport = useCallback(async () => {
    const review = pending;
    setPending(null);
    if (!review) return;
    const { kind, content, links, rows, libraryDetails } = review;

    let source: LibrarySource;
    try {
      source = await storeFile(kind, content, links, libraryDetails);
    } catch (error) {
      toast.error((error as Error).message || 'Could not add this file to your library.');
      return;
    }

    onImported(kind);
    toast.success(`“${source.name}” is saved to your library.`);

    const chosen = new Set(selected);
    queue.current = rows
      .filter((row) => row.worldId && chosen.has(row.listingId))
      .map((row) => ({ worldId: row.worldId!, worldName: row.worldName ?? row.name }));
    if (!queue.current.length) return;
    placing.current = { content, source };
    await advance();
  }, [advance, onImported, pending, selected, storeFile]);

  const dialogs: ReactNode = (
    <>
      <ImportComponentModal
        kind={pending?.kind ?? null}
        name={pending?.content.name ?? ''}
        rows={pending?.rows ?? []}
        selected={selected}
        offline={typeof navigator !== 'undefined' && navigator.onLine === false}
        onToggle={(listingId, on) => setSelected((held) => (
          on ? [...held.filter((id) => id !== listingId), listingId] : held.filter((id) => id !== listingId)
        ))}
        onFind={(listingId) => { setPending(null); onFindWorld(listingId); }}
        onCancel={() => setPending(null)}
        onConfirm={() => { void confirmImport(); }}
      />
      <ConnectReferencesModal
        rows={connect?.rows ?? null}
        choices={choices}
        confirmLabel="Connect & Add"
        onChoose={(key, value) => setChoices((held) => ({ ...held, [key]: value }))}
        onCancel={() => {
          // Backing out leaves this world without the copy; the rest of the queue still runs.
          setConnect(null);
          setChoices({});
          void advance();
        }}
        onConfirm={() => {
          const flow = connect;
          setConnect(null);
          void (async () => {
            if (flow) await place(flow, planConnections(flow.rows, choices));
            setChoices({});
            await advance();
          })();
        }}
      />
      {updateDialog}
    </>
  );

  return { reviewFile, storeFile, dialogs };
}
