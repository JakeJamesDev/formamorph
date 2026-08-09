import { useDictionaryStore } from '@/contexts/DictionaryStoreContext';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useEditorMode } from '@/lib/editorMode';
import type { Dictionary } from '@/types';

/** Right-panel editor for a selected book (dictionary): rename + enable toggle. Entry editing is the
 *  DictionaryManager's job; add/delete entries from the tree on the left.
 *
 *  What the book *is*. What it looks like as a listing — its tags and cover — is the library editor's
 *  Overview tab (see DictionaryOverviewManager); those are set once on the way out, these are what you
 *  reach for while writing entries. */
const DictionaryBookManager = ({ book }: { book: Dictionary }) => {
  const { updateDictionary } = useDictionaryStore();
  const { advanced } = useEditorMode();
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Dictionary Name</Label>
        <Input value={book.name} onChange={(e) => updateDictionary({ ...book, name: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={book.description ?? ''}
          onChange={(e) => updateDictionary({ ...book, description: e.target.value })}
          placeholder="Notes about this dictionary (not sent to the AI)."
          rows={3}
        />
      </div>
      {advanced && (
        <label className="flex items-center gap-2 text-label">
          <Checkbox
            checked={book.enabled !== false}
            onCheckedChange={(v) => updateDictionary({ ...book, enabled: v === true })}
          />
          Enabled — inject entries from this dictionary
        </label>
      )}
      <p className="text-meta text-muted-foreground">
        {book.entries.length} {book.entries.length === 1 ? 'entry' : 'entries'}. Use the + on this dictionary
        (left) to add one, then select an entry to edit it.
        {advanced && ' Disabling mutes every entry in this book at once.'}
      </p>
    </div>
  );
};

export default DictionaryBookManager;
