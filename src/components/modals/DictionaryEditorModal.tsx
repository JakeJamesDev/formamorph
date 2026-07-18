import { useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ListDetail } from '@/components/ui/list-detail';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Save, Upload } from 'lucide-react';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { DictionaryStoreProvider, useDictionaryStoreState } from '@/contexts/DictionaryStoreContext';
import DictionaryTree from '@/managers/DictionaryTree';
import DictionaryBookManager from '@/managers/DictionaryBookManager';
import DictionaryManager from '@/managers/DictionaryManager';
import PlaceholderEditor from '@/managers/PlaceholderEditor';
import { placeholderStore, PlaceholderStoreProvider } from '@/contexts/PlaceholderStoreContext';
import { buildDictionaryFile } from '@/lib/dictionaryFile';
import { downloadBlob } from '@/lib/downloadBlob';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import type { Dictionary, Placeholder } from '@/types';

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
  const [tab, setTab] = useState<'dictionary' | 'placeholders'>('dictionary');
  const [showUnsaved, setShowUnsaved] = useState(false);
  const baselineRef = useRef('');
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

  const hasUnsavedChanges = book != null && JSON.stringify(dictionaries) !== baselineRef.current;
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

  const handleSave = async () => {
    const current = dictionaries[0];
    if (!current) return;
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
    } catch {
      toast.error('Could not save dictionary.');
    }
  };

  const handleDownload = () => {
    const current = dictionaries[0];
    if (!current) return;
    const blob = new Blob([JSON.stringify(buildDictionaryFile(current), null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${current.name || 'Dictionary'}.json`);
  };

  const attemptClose = () => { if (hasUnsavedChanges) setShowUnsaved(true); else onClose(); };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) attemptClose(); }}>
        <DialogContent className="max-w-[1100px] w-[95vw] h-[85dvh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b shrink-0 flex-row items-center gap-3">
            <DialogTitle className="truncate flex-1">{book?.name || 'Dictionary'}</DialogTitle>
            {book && (
              <Tabs value={tab} onValueChange={(v) => setTab(v as 'dictionary' | 'placeholders')}>
                <TabsList>
                  <TabsTrigger value="dictionary">Dictionary</TabsTrigger>
                  <TabsTrigger value="placeholders">Placeholders</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <div className="flex-1" />
          </DialogHeader>
          {!book ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <DictionaryStoreProvider value={store}>
              {tab === 'placeholders' ? (
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
                      <DictionaryManager key={selectedEntry.id} entry={selectedEntry} placeholders={bookPlaceholders} />
                    ) : (
                      <p className="text-sm text-muted-foreground">Select the dictionary or an entry to edit it.</p>
                    )}
                  </div>
                }
              />
              )}
              <div className="px-4 py-3 border-t shrink-0 flex justify-between gap-2">
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
                <div className="flex gap-2">
                  {onPublish && (
                    // Publishes what's on screen, saved or not — the same book Save would write.
                    <Button variant="outline" size="sm" onClick={() => dictionaries[0] && onPublish(dictionaries[0])}>
                      <Upload className="h-4 w-4 mr-2" /> Publish
                    </Button>
                  )}
                  <Button size="sm" onClick={handleSave} disabled={!hasUnsavedChanges}>
                    <Save className="h-4 w-4 mr-2" /> Save
                  </Button>
                </div>
              </div>
            </DictionaryStoreProvider>
          )}
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog
        open={showUnsaved}
        onOpenChange={setShowUnsaved}
        onSave={async () => { await handleSave(); onClose(); }}
        onExit={onClose}
      />
    </>
  );
};

export default DictionaryEditorModal;
