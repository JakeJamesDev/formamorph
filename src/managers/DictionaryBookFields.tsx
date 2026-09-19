import { useDictionaryStore } from '@/contexts/DictionaryStoreContext';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Hint } from '@/components/ui/typography';
import { useEditorMode } from '@/lib/editorMode';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { statCodeName } from '@/lib/statCodeNames';
import { useRenameField } from '@/lib/useCodeRename';
import type { Dictionary, Placeholder } from '@/types';

/** Stable empty list, so the rename reader keeps its identity where there is no world. */
const EMPTY_PLACEHOLDERS: Placeholder[] = [];

/** What a book is: its Name, with the rename offer, its Description, and Enabled in Advanced mode. */
const DictionaryBookFields = ({ book }: { book: Dictionary }) => {
  const { updateDictionary, dictionaries } = useDictionaryStore();
  const { advanced } = useEditorMode();
  // A book that owns placeholders is a node of the `placeholders` map, so a rename moves the owner segment
  // of every path through it. The map keys that segment through `statCodeName`, so the offer reads it so too.
  const placeholders = useGameDataOptional()?.placeholders ?? EMPTY_PLACEHOLDERS;
  const rename = useRenameField({
    root: 'placeholders',
    value: book.name,
    siblings: dictionaries,
    ownId: book.id,
    codeNameOf: (name) => statCodeName(name, placeholders),
    subject: { kind: 'dictionary', id: book.id },
  });
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          value={book.name}
          onChange={(e) => updateDictionary({ ...book, name: e.target.value })}
          aria-label="Name"
          onFocus={rename.onFocus}
          onBlur={rename.onBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') rename.onSubmit(); }}
        />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={book.description ?? ''}
          onChange={(e) => updateDictionary({ ...book, description: e.target.value })}
          placeholder="Notes for you, not injected into the prompt"
          rows={3}
        />
      </div>
      {advanced && (
        <label className="flex items-center gap-2 text-label">
          <Checkbox
            checked={book.enabled !== false}
            onCheckedChange={(v) => updateDictionary({ ...book, enabled: v === true })}
          />
          Enabled
          <Hint as="span">Lets every entry in this dictionary activate</Hint>
        </label>
      )}
    </div>
  );
};

export default DictionaryBookFields;
