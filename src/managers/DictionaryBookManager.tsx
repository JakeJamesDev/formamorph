import { useGameData } from '@/contexts/GameDataContext';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { Dictionary } from '@/types';

/** Right-panel editor for a selected book (dictionary): rename + enable toggle. Entry editing is the
 *  DictionaryManager's job; add/delete entries from the tree on the left. */
const DictionaryBookManager = ({ book }: { book: Dictionary }) => {
  const { updateDictionary } = useGameData();
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Dictionary Name</Label>
        <Input value={book.name} onChange={(e) => updateDictionary({ ...book, name: e.target.value })} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={book.enabled !== false}
          onCheckedChange={(v) => updateDictionary({ ...book, enabled: v === true })}
        />
        Enabled — inject entries from this dictionary
      </label>
      <p className="text-xs text-muted-foreground">
        {book.entries.length} {book.entries.length === 1 ? 'entry' : 'entries'}. Use the + on this dictionary
        (left) to add one, then select an entry to edit it. Disabling mutes every entry in this book at once.
      </p>
    </div>
  );
};

export default DictionaryBookManager;
