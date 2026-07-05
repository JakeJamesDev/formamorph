import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Download, Save } from 'lucide-react';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { DictionaryStoreProvider, useDictionaryStoreState } from '@/contexts/DictionaryStoreContext';
import DictionaryTree from '@/managers/DictionaryTree';
import DictionaryBookManager from '@/managers/DictionaryBookManager';
import DictionaryManager from '@/managers/DictionaryManager';
import { buildDictionaryFile } from '@/lib/dictionaryFile';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import type { Dictionary } from '@/types';

/**
 * Edit a single library dictionary in place. Reuses the World Editor's dictionary widgets, but binds them
 * to an ISOLATED `DictionaryStore` (this one book) so editing never touches the app's world store. Open ⇔
 * `dictionaryId !== null`; saves back to `DictionaryStorageService`.
 */
const DictionaryEditorModal = ({ dictionaryId, draft, onClose }: { dictionaryId: string | null; draft?: Dictionary | null; onClose: () => void }) => {
  const store = useDictionaryStoreState([]);
  const { dictionaries, setDictionaries } = store;
  const [book, setBook] = useState<Dictionary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const dirty = book != null && JSON.stringify(dictionaries) !== baselineRef.current;
  const selectedBook = dictionaries.find((b) => b.id === selectedId);
  const selectedEntry = dictionaries.flatMap((b) => b.entries).find((e) => e.id === selectedId);

  const handleSave = async () => {
    const current = dictionaries[0];
    if (!current) return;
    // Normalize the book id back to the record id (a delete-reseed can change it) so the record isn't orphaned.
    const recordId = dictionaryId ?? current.id;
    const normalized: Dictionary[] = dictionaries.map((b, i) => (i === 0 ? { ...b, id: recordId } : b));
    try {
      await DictionaryStorageService.storeDictionary({ id: recordId, name: normalized[0].name, data: normalized[0] });
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
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${current.name || 'Dictionary'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };

  const attemptClose = () => { if (dirty) setShowUnsaved(true); else onClose(); };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) attemptClose(); }}>
        <DialogContent className="max-w-[1100px] w-[95vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="truncate">{book?.name || 'Dictionary'}</DialogTitle>
          </DialogHeader>
          {!book ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <DictionaryStoreProvider value={store}>
              <div className="flex-1 min-h-0 flex">
                <ScrollArea className="w-1/2 min-w-0 border-r">
                  <div className="p-2">
                    <DictionaryTree selectedId={selectedId} onSelect={setSelectedId} />
                  </div>
                </ScrollArea>
                <ScrollArea className="w-1/2 min-w-0">
                  <div className="p-4">
                    {selectedBook ? (
                      <DictionaryBookManager key={selectedBook.id} book={selectedBook} />
                    ) : selectedEntry ? (
                      <DictionaryManager key={selectedEntry.id} entry={selectedEntry} />
                    ) : (
                      <p className="text-sm text-muted-foreground">Select the dictionary or an entry on the left to edit it.</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
              <div className="px-4 py-3 border-t shrink-0 flex justify-between">
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!dirty}>
                  <Save className="h-4 w-4 mr-2" /> Save
                </Button>
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
