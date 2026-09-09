import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import DictionaryEditorModal from '@/components/modals/DictionaryEditorModal';
import EntityEditorModal from '@/components/modals/EntityEditorModal';
import ImportContentModal from '@/components/modals/ImportContentModal';
import LinkToLibraryModal from '@/components/modals/LinkToLibraryModal';
import type { LibraryPick } from '@/components/modals/AddFromLibraryModal';
import { parseDictionaryImport } from '@/lib/dictionaryFile';
import { importCharacterFile } from '@/lib/entityFile';
import { parseJsonText } from '@/lib/jsonFileWorkerUtils';
import {
  contentMatchesSource, linkToSource, syncWorldContent, unlink,
  type LibrarySource, type LinkableContent,
} from '@/lib/linkedContent';
import { kindOf, loadLinkedSources, saveCopyToLibrary, type LibraryKind } from '@/lib/librarySources';
import type { Dictionary, Entity, Placeholder } from '@/types';

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
  entities: Entity[];
  dictionaries: Dictionary[];
  /** The world's combined placeholder pool, which the copies' chips currently point at. */
  placeholders: Placeholder[];
  updateEntity: (entity: Entity) => void;
  updateDictionary: (book: Dictionary) => void;
  setEntities: (entities: Entity[]) => void;
  setDictionaries: (dictionaries: Dictionary[]) => void;
  /** Adopt the placeholders, place it, and select it. The editor owns where a new item lands. */
  addEntityToWorld: (entity: Entity) => void;
  addBookToWorld: (book: Dictionary) => void;
  /** Export the selected item through the editor's existing file flow. */
  exportEntity: (entity: Entity) => void;
  exportDictionary: (book: Dictionary) => void;
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
  const { placeholders, updateEntity, updateDictionary, addEntityToWorld, addBookToWorld, exportEntity, exportDictionary } = options;

  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [linkPickerFor, setLinkPickerFor] = useState<LinkableContent | null>(null);
  const [libraryEditor, setLibraryEditor] = useState<{ kind: LibraryKind; id: string } | null>(null);
  const [importReview, setImportReview] = useState<{ kind: LibraryKind; item: LinkableContent } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const importKindRef = useRef<LibraryKind>('entity');

  const latest = useRef(options);
  useEffect(() => { latest.current = options; });

  /** Bring the world's linked copies up to date with the library items their author owns. */
  const syncFromLibrary = useCallback(async () => {
    const current = latest.current;
    const linkedIds = [...current.entities, ...current.dictionaries]
      .map((item) => item.link?.libraryId)
      .filter((id): id is string => !!id);
    if (!linkedIds.length) return;
    const sources = await loadLinkedSources(linkedIds);
    const next = syncWorldContent({ entities: current.entities, dictionaries: current.dictionaries }, sources);
    if (!next.updated) return;
    if (next.entities !== current.entities) current.setEntities(next.entities);
    if (next.dictionaries !== current.dictionaries) current.setDictionaries(next.dictionaries);
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
      const source = await saveCopyToLibrary(item, placeholders);
      applyLink(item, source, false);
      toast.success(`"${source.name}" saved to your library.`);
    } catch (error) {
      toast.error((error as Error).message || 'Could not save to your library.');
    }
  }, [applyLink, placeholders]);

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
        linked
          ? { label: 'Unlink', onClick: () => unlinkItem(item) }
          : { label: 'Link to Library Item…', onClick: () => setLinkPickerFor(item) },
      ],
    };
  }, [exportDictionary, exportEntity, saveToLibrary, unlinkItem]);

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
        const source = await saveCopyToLibrary(item, placeholders);
        linked = { ...item, link: linkToSource(source) };
        setPendingIds((prev) => [...prev, source.id]);
      } catch (error) {
        toast.error((error as Error).message || 'Could not save to your library.');
        return;
      }
    }
    if (kind === 'dictionary') addBookToWorld(linked as Dictionary);
    else addEntityToWorld(linked as Entity);
  }, [addBookToWorld, addEntityToWorld, importReview, placeholders]);

  /** A copy added from the picker with its link kept is pending until the world saves. */
  const notePendingLink = useCallback((libraryId: string) => {
    setPendingIds((prev) => (prev.includes(libraryId) ? prev : [...prev, libraryId]));
  }, []);

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
      <EntityEditorModal
        entityId={libraryEditor?.kind === 'entity' ? libraryEditor.id : null}
        onClose={() => { setLibraryEditor(null); void syncFromLibrary(); }}
      />
      <DictionaryEditorModal
        dictionaryId={libraryEditor?.kind === 'dictionary' ? libraryEditor.id : null}
        onClose={() => { setLibraryEditor(null); void syncFromLibrary(); }}
      />
    </>
  );

  return { controlFor, openImportFile, notePendingLink, clearPendingLinks, pendingLinks: pendingIds, dialogs };
}
