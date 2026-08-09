import { useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import { toast } from 'react-toastify';
import { ListDetail } from '@/components/ui/list-detail';
import { ScrollArea } from '@/components/ui/scroll-area';
import EditorModalShell from './EditorModalShell';
import { DictionaryStoreProvider, useDictionaryStoreState } from '@/contexts/DictionaryStoreContext';
import DictionaryTree from '@/managers/DictionaryTree';
import DictionaryBookManager from '@/managers/DictionaryBookManager';
import DictionaryOverviewManager from '@/managers/DictionaryOverviewManager';
import DictionaryManager from '@/managers/DictionaryManager';
import PlaceholderEditor from '@/managers/PlaceholderEditor';
import PlaceholderPaletteBar from '@/components/prompt/PlaceholderPaletteBar';
import { ChipInsertTargetProvider } from '@/components/prompt/ChipInsertTarget';
import { placeholderStore, PlaceholderStoreProvider } from '@/contexts/PlaceholderStoreContext';
import { buildDictionaryFile } from '@/lib/dictionaryFile';
import { downloadBlob } from '@/lib/downloadBlob';
import { memoStringify } from '@/lib/memoStringify';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import type { Dictionary, Placeholder } from '@/types';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'dictionary', label: 'Dictionary' },
  { value: 'placeholders', label: 'Placeholders' },
];

type DictionaryTab = (typeof TABS)[number]['value'];

/**
 * Edit a single library dictionary in place. Reuses the World Editor's dictionary widgets, but binds them
 * to an ISOLATED `DictionaryStore` (this one book) so editing never touches the app's world store. Open ⇔
 * `dictionaryId !== null`; saves back to `DictionaryStorageService`. `onPublish` (when the user is signed
 * in) hands the book up to the publish dialog.
 */
const DictionaryEditorModal = ({ dictionaryId, draft, onClose, onPublish }: {
  dictionaryId: string | null;
  draft?: Dictionary | null;
  onClose: () => void;
  onPublish?: (book: Dictionary) => void;
}) => {
  const store = useDictionaryStoreState([]);
  const { dictionaries, setDictionaries } = store;
  const [book, setBook] = useState<Dictionary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Opens on Dictionary: the entries are the work, the Overview is set once.
  const [tab, setTab] = useState<DictionaryTab>('dictionary');
  const baselineRef = useRef('');
  // Reuses cached serialization for unedited entries on each keystroke; matches the JSON.stringify baseline.
  const stringifyCache = useRef(new WeakMap<object, string>());
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const isOpen = dictionaryId !== null || !!draft;

  // Seed the isolated store from the draft, or load a stored book; clear when closed.
  useEffect(() => {
    const seed = (b: Dictionary) => { setDictionaries([b]); setBook(b); setSelectedId(b.id); baselineRef.current = JSON.stringify([b]); };
    if (draft) { seed(draft); return; }
    if (dictionaryId === null) { setBook(null); return; }
    let cancelled = false;
    DictionaryStorageService.getDictionaryData(dictionaryId)
      .then((b) => { if (!cancelled) seed(b); })
      .catch(() => { if (!cancelled) { toast.error('Could not load dictionary.'); onCloseRef.current(); } });
    return () => { cancelled = true; };
  }, [dictionaryId, draft, setDictionaries]);

  const hasUnsavedChanges = book != null && memoStringify(dictionaries, stringifyCache.current) !== baselineRef.current;
  const selectedBook = dictionaries.find((b) => b.id === selectedId);
  const selectedEntry = dictionaries.flatMap((b) => b.entries).find((e) => e.id === selectedId);
  // The book's carried placeholders live on the sole book (index 0); its entries' chips resolve against them.
  const bookPlaceholders = useMemo(() => dictionaries[0]?.placeholders ?? [], [dictionaries]);
  // Isolated placeholder store backed by the sole book's `placeholders` field (empty ⇒ undefined).
  const phStore = useMemo(() => placeholderStore(bookPlaceholders, (action: SetStateAction<Placeholder[]>) =>
    setDictionaries((prev) => prev.map((b, i) => {
      if (i !== 0) return b;
      const cur = b.placeholders ?? [];
      const next = typeof action === 'function' ? action(cur) : action;
      return { ...b, placeholders: next.length ? next : undefined };
    }))), [bookPlaceholders, setDictionaries]);

  // Returns whether the save succeeded, so a save-and-exit caller only closes on success.
  const handleSave = async (): Promise<boolean> => {
    const current = dictionaries[0];
    if (!current) return true;
    // Normalize the book id back to the record id (a delete-reseed can change it) so the record isn't orphaned.
    const recordId = dictionaryId ?? current.id;
    const normalized: Dictionary[] = dictionaries.map((b, i) => (i === 0 ? { ...b, id: recordId } : b));
    try {
      // A save means this copy diverged from whatever it was downloaded from; the store read-merges the rest.
      await DictionaryStorageService.storeDictionary({
        id: recordId, name: normalized[0].name, data: normalized[0],
        dirty: true, editedAt: new Date().toISOString(),
      });
      setDictionaries(normalized);
      baselineRef.current = JSON.stringify(normalized);
      toast.success('Dictionary saved!');
      return true;
    } catch {
      toast.error('Could not save dictionary.');
      return false;
    }
  };

  const handleExport = () => {
    const current = dictionaries[0];
    if (!current) return;
    const blob = new Blob([JSON.stringify(buildDictionaryFile(current), null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${current.name || 'Dictionary'}.json`);
  };

  return (
    <EditorModalShell
      open={isOpen}
      title={book?.name || 'Dictionary'}
      contentClassName="max-w-[1100px] w-[95vw] h-[85dvh] flex flex-col p-0 gap-0 overflow-hidden"
      loading={!book}
      tabs={TABS}
      tab={tab}
      onTabChange={(v) => setTab(v as DictionaryTab)}
      hasUnsavedChanges={hasUnsavedChanges}
      onSave={handleSave}
      onClose={onClose}
      onExport={handleExport}
      onPublish={onPublish ? () => { if (dictionaries[0]) onPublish(dictionaries[0]); } : undefined}
    >
      <DictionaryStoreProvider value={store}>
        {tab === 'overview' ? (
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4">
              {dictionaries[0] && <DictionaryOverviewManager book={dictionaries[0]} />}
            </div>
          </ScrollArea>
        ) : tab === 'placeholders' ? (
          <PlaceholderStoreProvider value={phStore}>
            <PlaceholderEditor />
          </PlaceholderStoreProvider>
        ) : (
          <ListDetail
            showDetail={!!(selectedBook || selectedEntry)}
            onBack={() => setSelectedId(null)}
            backLabel="Dictionary"
            list={
              <div className="p-2">
                <DictionaryTree selectedId={selectedId} onSelect={setSelectedId} />
              </div>
            }
            detail={
              <div className="p-4">
                {selectedBook ? (
                  <DictionaryBookManager key={selectedBook.id} book={selectedBook} />
                ) : selectedEntry ? (
                  <ChipInsertTargetProvider>
                    <PlaceholderPaletteBar placeholders={bookPlaceholders} />
                    <DictionaryManager key={selectedEntry.id} entry={selectedEntry} placeholders={bookPlaceholders} />
                  </ChipInsertTargetProvider>
                ) : (
                  <p className="text-helper text-muted-foreground">Select the dictionary or an entry to edit it.</p>
                )}
              </div>
            }
          />
        )}
      </DictionaryStoreProvider>
    </EditorModalShell>
  );
};

export default DictionaryEditorModal;
