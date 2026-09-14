import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import ConnectReferencesModal from '@/components/modals/ConnectReferencesModal';
import DictionaryEditorModal from '@/components/modals/DictionaryEditorModal';
import EntityEditorModal from '@/components/modals/EntityEditorModal';
import ImportContentModal from '@/components/modals/ImportContentModal';
import LinkToLibraryModal from '@/components/modals/LinkToLibraryModal';
import type { LibraryPick } from '@/components/modals/AddFromLibraryModal';
import { parseDictionaryImport } from '@/lib/dictionaryFile';
import { withEntityLocations } from '@/lib/entityPresence';
import { importCharacterFile } from '@/lib/entityFile';
import { parseJsonText } from '@/lib/jsonFileWorkerUtils';
import type { LiveWorld } from '@/lib/componentUpdateRun';
import { useComponentUpdates } from '@/lib/useComponentUpdates';
import {
  contentMatchesSource, linkToSource, syncWorldContent, unlink,
  type LibrarySource, type LinkableContent,
} from '@/lib/linkedContent';
import {
  kindOf, libraryItemData, loadLinkedSources, saveCopyToLibrary, type LibraryKind,
} from '@/lib/librarySources';
import {
  adoptBookPlaceholders, adoptEntityPlaceholders, remapBookChips, remapEntityChips,
} from '@/lib/placeholderHomes';
import {
  planConnections, suggestedChoices, unresolvedReferences,
  type ConnectionPlan, type ReferenceChoices, type ReferenceRow,
} from '@/lib/worldReferences';
import type { Dictionary, Entity, GameLocation, Placeholder } from '@/types';

/** One entry in the selected item's dropdown. */
export interface LinkMenuItem {
  label: string;
  onClick: () => void;
}

/** What the selected item's split button shows and does, for the state the item is in. */
export interface SelectedContentControl {
  faceLabel: string;
  faceTip: string;
  onFace: () => void;
  menu: LinkMenuItem[];
}

/** What the editor supplies so the flow can put content into the world it is editing. */
interface LibraryLinkingOptions {
  /** The world being edited, which an update review names among the worlds a source reaches. */
  worldId: string;
  worldName: string;
  entities: Entity[];
  dictionaries: Dictionary[];
  /** The world's combined placeholder pool, which the copies' chips currently point at. */
  placeholders: Placeholder[];
  /** The world's shared list on its own — what an arriving copy's world-owned references resolve against. */
  worldPlaceholders: Placeholder[];
  locations: GameLocation[];
  updateEntity: (entity: Entity) => void;
  updateDictionary: (book: Dictionary) => void;
  setEntities: (entities: Entity[]) => void;
  setDictionaries: (dictionaries: Dictionary[]) => void;
  /** Place a copy whose references are already resolved, and select it. The editor owns where it lands. */
  addEntityToWorld: (entity: Entity) => void;
  addBookToWorld: (book: Dictionary) => void;
  addPlaceholder: (placeholder: Placeholder) => void;
  addLocation: (location: GameLocation) => void;
  /** Reopen the library picker on the picks the author already made, for Back out of the connection step. */
  reopenPicker: (kind: LibraryKind) => void;
  /** Export the selected item through the editor's existing file flow. */
  exportEntity: (entity: Entity) => void;
  exportDictionary: (book: Dictionary) => void;
}

/** One copy waiting on the connection step, with the library item it follows where it kept a link. */
interface PendingAdd {
  kind: LibraryKind;
  item: LinkableContent;
  source?: LibrarySource;
}

/** The connection step in flight: adding new content, or repairing a copy the world already holds. */
interface ConnectFlow {
  rows: ReferenceRow[];
  /** Adding: the copies waiting to go in. */
  pending: PendingAdd[];
  /** Repairing: the world's copy, and the library item it follows. */
  repair?: { copy: LinkableContent; source: LinkableContent };
}

/**
 * The World Editor's local library links: saving a copy out to the library, adding copies back in with or
 * without a link, reconnecting an independent copy, unlinking, and taking the author's own library saves
 * into the world's linked copies.
 *
 * A link made here is committed by the next world save, which is what `pending` reports until then.
 */
export function useLibraryLinking(options: LibraryLinkingOptions) {
  // The list state and its setters are read through the ref below, so the synchronization pass can run
  // from an effect without re-running on every edit.
  const { placeholders, locations, updateEntity, updateDictionary, exportEntity, exportDictionary } = options;

  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [linkPickerFor, setLinkPickerFor] = useState<LinkableContent | null>(null);
  const [libraryEditor, setLibraryEditor] = useState<{ kind: LibraryKind; id: string } | null>(null);
  const [importReview, setImportReview] = useState<{ kind: LibraryKind; item: LinkableContent } | null>(null);
  const [connect, setConnect] = useState<ConnectFlow | null>(null);
  const [choices, setChoices] = useState<ReferenceChoices>({});
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const importKindRef = useRef<LibraryKind>('entity');

  const latest = useRef(options);
  useEffect(() => { latest.current = options; });

  // The editor's own world, so an update review reads and writes its copy in memory rather than reaching
  // for what the last world save left in storage.
  const live: LiveWorld = {
    id: options.worldId,
    name: options.worldName,
    entities: options.entities,
    dictionaries: options.dictionaries,
    placeholders: options.worldPlaceholders,
    writeItem: (item) => (kindOf(item) === 'dictionary'
      ? updateDictionary(item as Dictionary)
      : updateEntity(item as Entity)),
    addPlaceholder: (placeholder) => latest.current.addPlaceholder(placeholder),
  };
  const { checkForUpdates, updateDialog } = useComponentUpdates([live]);

  /**
   * Bring the world's linked copies up to date with the library items their author owns, and let go of
   * the items that are gone. Letting go is silent: the player deleted the item, and the copy's own row is
   * where the state change reads.
   */
  const syncFromLibrary = useCallback(async () => {
    const current = latest.current;
    const linkedIds = [...current.entities, ...current.dictionaries]
      .map((item) => item.link?.libraryId)
      .filter((id): id is string => !!id);
    if (!linkedIds.length) return;
    // The lookup is what says an item is gone, so a lookup that failed says nothing and nothing is let go
    // of. Without this, one unreadable library would unlink every copy in the world.
    let sources: LibrarySource[];
    try {
      sources = await loadLinkedSources(linkedIds);
    } catch (error) {
      console.error('Could not read your library:', (error as Error).message);
      return;
    }
    const next = syncWorldContent({
      entities: current.entities, dictionaries: current.dictionaries, placeholders: current.worldPlaceholders,
    }, sources);
    if (!next.updated && !next.unlinked) return;
    if (next.entities !== current.entities) current.setEntities(next.entities);
    if (next.dictionaries !== current.dictionaries) current.setDictionaries(next.dictionaries);
    // A reference the source has newly introduced arrives as a placeholder of its own; Save Connections is
    // where the author points it at one they already have.
    next.toAdd.forEach(current.addPlaceholder);
    if (!next.updated) return;
    toast.info(next.updated === 1
      ? 'Formamorph updated one linked copy from your library.'
      : `Formamorph updated ${next.updated} linked copies from your library.`);
  }, []);

  // Which library items this world follows, as a value an effect can watch. Keyed on the set rather than
  // run once on mount: the world may still be loading when the editor mounts, and a copy linked later
  // brings its own item into the pass. The pass writes the revision it applied, so a second run is a no-op.
  const linkedKey = [...options.entities, ...options.dictionaries]
    .map((item) => item.link?.libraryId)
    .filter(Boolean)
    .sort()
    .join(',');

  useEffect(() => { void syncFromLibrary(); }, [linkedKey, syncFromLibrary]);

  /** Write a new link onto the world's copy and remember that the world has not saved it yet. */
  const applyLink = useCallback((item: LinkableContent, source: LibrarySource, differs: boolean) => {
    const link = linkToSource(source, differs);
    if (kindOf(item) === 'dictionary') updateDictionary({ ...(item as Dictionary), link });
    else updateEntity({ ...(item as Entity), link });
    setPendingIds((prev) => (prev.includes(source.id) ? prev : [...prev, source.id]));
  }, [updateDictionary, updateEntity]);

  const saveToLibrary = useCallback(async (item: LinkableContent) => {
    try {
      const source = await saveCopyToLibrary(item, placeholders, locations);
      applyLink(item, source, false);
      toast.success(`"${source.name}" saved to your library.`);
    } catch (error) {
      toast.error((error as Error).message || 'Could not save to your library.');
    }
  }, [applyLink, locations, placeholders]);

  /** A copy added from the picker with its link kept is pending until the world saves. */
  const notePendingLink = useCallback((libraryId: string) => {
    setPendingIds((prev) => (prev.includes(libraryId) ? prev : [...prev, libraryId]));
  }, []);

  /** The copy carrying what its references resolved to, so a later update reaches the same things. */
  const withConnections = <T extends LinkableContent>(item: T, connections: Record<string, string>): T =>
    (item.link && Object.keys(connections).length
      ? { ...item, link: { ...item.link, connections } }
      : item);

  /** Put every waiting copy into the world, each resolving its references through `plan`. */
  const commitAdds = useCallback((pending: PendingAdd[], plan: ConnectionPlan) => {
    const current = latest.current;
    plan.newLocations.forEach(current.addLocation);
    const placeIds = new Set([...current.locations, ...plan.newLocations].map((l) => l.id));
    // Each copy resolves against the world plus what the copies before it brought in, so two copies
    // expecting the same new reference land on one placeholder rather than two.
    const gained: Placeholder[] = [];
    for (const entry of pending) {
      const shared = [...current.worldPlaceholders, ...gained];
      if (entry.kind === 'dictionary') {
        const adopted = adoptBookPlaceholders(entry.item as Dictionary, shared, plan.placeholders);
        gained.push(...adopted.toAdd);
        current.addBookToWorld(withConnections(adopted.book, adopted.connections));
      } else {
        const adopted = adoptEntityPlaceholders(entry.item as Entity, shared, plan.placeholders);
        gained.push(...adopted.toAdd);
        const { locationRefs = [], ...rest } = adopted.entity;
        const used = Object.fromEntries(locationRefs.flatMap((ref) => {
          const id = plan.locations[ref.id] ?? ref.id;
          return placeIds.has(id) ? [[ref.id, id]] : [];
        }));
        const placed = withEntityLocations(rest as Entity, Object.values(used));
        current.addEntityToWorld(withConnections(placed, { ...adopted.connections, ...used }));
      }
      if (entry.source) notePendingLink(entry.source.id);
    }
    gained.forEach(current.addPlaceholder);
  }, [notePendingLink]);

  /**
   * Start adding copies. Content whose references this world already answers goes straight in; anything
   * else waits on the connection step, which is where the author says what each reference means here.
   */
  const beginAdd = useCallback((pending: PendingAdd[]) => {
    const current = latest.current;
    const world = { placeholders: current.worldPlaceholders, locations: current.locations };
    // Keyed by the source's own id, so two copies from one world share a row and land on one answer.
    const rows = [...new Map(pending
      .flatMap((entry) => unresolvedReferences(entry.item, world, entry.item.link?.connections))
      .map((row) => [row.key, row])).values()];
    if (!rows.length) {
      commitAdds(pending, { placeholders: {}, locations: {}, newLocations: [], newPlaceholders: [] });
      return;
    }
    // Back left the answers behind; coming forward again finds them still made.
    setChoices((prev) => ({
      ...suggestedChoices(rows),
      ...Object.fromEntries(rows.flatMap((row) => (prev[row.key] ? [[row.key, prev[row.key]]] : []))),
    }));
    setConnect({ rows, pending });
  }, [commitAdds]);

  /** Reconnect a copy the world already holds, after the Placeholder it pointed at went away. */
  const repairConnections = useCallback(async (copy: LinkableContent) => {
    const current = latest.current;
    const libraryId = copy.link?.libraryId;
    const source = libraryId ? await libraryItemData(kindOf(copy), libraryId) : null;
    if (!source) {
      toast.error('The library item this copy follows is gone, so there is nothing to connect it to.');
      return;
    }
    const world = { placeholders: current.worldPlaceholders, locations: current.locations };
    const rows = unresolvedReferences(source, world, copy.link?.connections);
    if (!rows.length) {
      toast.info('Every reference this copy needs is already connected.');
      return;
    }
    setChoices(suggestedChoices(rows));
    setConnect({ rows, pending: [], repair: { copy, source } });
  }, []);

  /** Write a repair: the world gains what the author created, and the copy's chips follow its new answers. */
  const commitRepair = useCallback((flow: ConnectFlow, plan: ConnectionPlan) => {
    const current = latest.current;
    const repair = flow.repair;
    if (!repair) return;
    plan.newPlaceholders.forEach(current.addPlaceholder);
    plan.newLocations.forEach(current.addLocation);
    const held = repair.copy.link?.connections ?? {};
    const connections = { ...held, ...plan.placeholders, ...plan.locations };
    // The copy's chips point at what the reference used to resolve to here, so they follow it to the new one.
    const chipMap: Record<string, string> = {};
    for (const row of flow.rows) {
      const before = held[row.key];
      const after = plan.placeholders[row.key];
      if (before && after && row.kind === 'placeholder') chipMap[before] = after;
    }
    const link = { ...repair.copy.link, connections };
    if (kindOf(repair.copy) === 'dictionary') {
      updateDictionary({ ...remapBookChips(repair.copy as Dictionary, chipMap), link });
    } else {
      const entity = remapEntityChips(repair.copy as Entity, chipMap);
      // A location membership the repair re-aimed moves with it; one it did not is left as it stands.
      const moved = (entity.locations ?? []).map((id) => {
        const row = flow.rows.find((r) => r.kind === 'location' && held[r.key] === id);
        return row ? plan.locations[row.key] ?? id : id;
      });
      const fresh = flow.rows
        .filter((r) => r.kind === 'location' && !held[r.key] && plan.locations[r.key])
        .map((r) => plan.locations[r.key]);
      updateEntity({ ...withEntityLocations(entity, [...moved, ...fresh]), link });
    }
  }, [updateDictionary, updateEntity]);

  /** The author answered every row: write the connections, then finish what the step interrupted. */
  const confirmConnections = useCallback(() => {
    const flow = connect;
    setConnect(null);
    setChoices({});
    if (!flow) return;
    if (flow.repair) commitRepair(flow, planConnections(flow.rows, choices, true));
    else commitAdds(flow.pending, planConnections(flow.rows, choices));
  }, [choices, commitAdds, commitRepair, connect]);

  const unlinkItem = useCallback((item: LinkableContent) => {
    const libraryId = item.link?.libraryId;
    if (kindOf(item) === 'dictionary') updateDictionary(unlink(item as Dictionary));
    else updateEntity(unlink(item as Entity));
    setPendingIds((prev) => prev.filter((id) => id !== libraryId));
  }, [updateDictionary, updateEntity]);

  /** Reconnect an independent copy. Nothing is overwritten: content that differs links as a replacement. */
  const linkToPicked = useCallback((pick: LibraryPick) => {
    const item = linkPickerFor;
    setLinkPickerFor(null);
    if (!item) return;
    applyLink(item, pick.source, !contentMatchesSource(item, pick.data));
  }, [applyLink, linkPickerFor]);

  /**
   * Everything the selected item's split button needs, for the state that item is in.
   *
   * Export is Advanced only, the way the footer's own Export button was: handing content out is an
   * Advanced move, while saving it to your own library is offered in both modes.
   */
  const controlFor = useCallback((item: LinkableContent, advanced: boolean): SelectedContentControl => {
    const kind = kindOf(item);
    const noun = kind === 'dictionary' ? 'Dictionary' : 'Entity';
    const exportItem = () => (kind === 'dictionary'
      ? exportDictionary(item as Dictionary)
      : exportEntity(item as Entity));
    const linked = !!(item.link?.libraryId || item.link?.sourceId);
    return {
      faceLabel: linked ? 'Open in Library' : 'Save to Library',
      faceTip: linked
        ? `Open the library ${noun.toLowerCase()} this copy follows`
        : `Save a copy to your library and follow it from this world`,
      onFace: () => {
        if (!linked) { void saveToLibrary(item); return; }
        const id = item.link?.libraryId;
        if (id) setLibraryEditor({ kind, id });
        else toast.error('This copy follows a published source, not a library item.');
      },
      menu: [
        ...(advanced ? [{ label: `Export ${noun}…`, onClick: exportItem }] : []),
        ...(linked
          ? [
            ...(item.link?.libraryId
              ? [{
                label: 'Check for Updates',
                onClick: () => { void checkForUpdates(kind, item.link!.libraryId!); },
              }]
              : []),
            { label: 'Save Connections…', onClick: () => { void repairConnections(item); } },
            { label: 'Unlink', onClick: () => unlinkItem(item) },
          ]
          : [{ label: 'Link to Library Item…', onClick: () => setLinkPickerFor(item) }]),
      ],
    };
  }, [checkForUpdates, exportDictionary, exportEntity, repairConnections, saveToLibrary, unlinkItem]);

  /** Open the file picker for a kind's Import file… action. */
  const openImportFile = useCallback((kind: LibraryKind) => {
    importKindRef.current = kind;
    importInputRef.current?.click();
  }, []);

  const readImportFile = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const kind = importKindRef.current;
    try {
      const item: LinkableContent = kind === 'dictionary'
        ? parseDictionaryImport(await parseJsonText(await file.text()), file.name.replace(/\.[^.]+$/, ''))
        : (await importCharacterFile(file)).entity;
      setImportReview({ kind, item });
    } catch (error) {
      toast.error((error as Error).message || 'Could not read that file.');
    }
  }, []);

  /** Commit a reviewed file: through the library when the author kept the link, else straight in. */
  const confirmImport = useCallback(async (link: boolean) => {
    const review = importReview;
    setImportReview(null);
    if (!review) return;
    const { kind, item } = review;
    let linked = item;
    if (link) {
      try {
        const source = await saveCopyToLibrary(item, placeholders, locations);
        linked = { ...item, link: linkToSource(source) };
        setPendingIds((prev) => [...prev, source.id]);
      } catch (error) {
        toast.error((error as Error).message || 'Could not save to your library.');
        return;
      }
    }
    beginAdd([{ kind, item: linked }]);
  }, [beginAdd, importReview, locations, placeholders]);

  /** The world was saved or rolled back, so nothing is waiting on it any more. */
  const clearPendingLinks = useCallback(() => setPendingIds([]), []);

  const dialogs: ReactNode = (
    <>
      <input
        type="file"
        accept=".json,.png,.webp"
        ref={importInputRef}
        onChange={readImportFile}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
      <LinkToLibraryModal
        open={!!linkPickerFor}
        onOpenChange={(next) => { if (!next) setLinkPickerFor(null); }}
        kind={linkPickerFor ? kindOf(linkPickerFor) : 'entity'}
        onLink={linkToPicked}
      />
      <ImportContentModal
        kind={importReview?.kind ?? null}
        name={importReview?.item.name ?? ''}
        onCancel={() => setImportReview(null)}
        onConfirm={(link) => { void confirmImport(link); }}
      />
      {updateDialog}
      <EntityEditorModal
        entityId={libraryEditor?.kind === 'entity' ? libraryEditor.id : null}
        onClose={() => { setLibraryEditor(null); void syncFromLibrary(); }}
      />
      <DictionaryEditorModal
        dictionaryId={libraryEditor?.kind === 'dictionary' ? libraryEditor.id : null}
        onClose={() => { setLibraryEditor(null); void syncFromLibrary(); }}
      />
      <ConnectReferencesModal
        rows={connect?.rows ?? null}
        choices={choices}
        confirmLabel={connect?.repair ? 'Save Connections' : 'Connect & Add'}
        onChoose={(key, value) => setChoices((prev) => ({ ...prev, [key]: value }))}
        onBack={connect?.repair ? undefined : () => {
          const kind = connect?.pending[0]?.kind ?? 'entity';
          setConnect(null);
          latest.current.reopenPicker(kind);
        }}
        onCancel={() => { setConnect(null); setChoices({}); }}
        onConfirm={confirmConnections}
      />
    </>
  );

  return { controlFor, openImportFile, beginAdd, clearPendingLinks, pendingLinks: pendingIds, dialogs };
}
