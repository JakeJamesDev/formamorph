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
import ScopedPlaceholdersSection from './ScopedPlaceholdersSection';
import { ContentLinkHeader } from '@/components/ContentLinkStatus';

/** Stable empty list, so the rename reader keeps its identity where there is no world. */
const EMPTY_PLACEHOLDERS: Placeholder[] = [];

/** Right-panel editor for a selected book (dictionary): rename + enable toggle. Entry editing is the
 *  DictionaryManager's job; add/delete entries from the tree on the left.
 *
 *  What the book *is*. What it looks like as a listing — its tags and cover — is the library editor's
 *  Overview tab (see DictionaryOverviewManager); those are set once on the way out, these are what you
 *  reach for while writing entries. */
const DictionaryBookManager = ({ book }: { book: Dictionary }) => {
  const { updateDictionary, dictionaries } = useDictionaryStore();
  const { advanced } = useEditorMode();
  // A book that owns placeholders is a node of the `placeholders` map, so renaming it moves the owner
  // segment of every path through it. The map keys that segment through `statCodeName`, so the offer reads
  // the name the same way — the library editor has no world behind it, and there it reads as written.
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
      <ContentLinkHeader link={book.link} />
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
          placeholder="Notes for you. Not injected into the prompt."
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
          <Hint as="span">Off stops every entry in this dictionary from activating.</Hint>
        </label>
      )}
      <Hint>
        {book.entries.length} {book.entries.length === 1 ? 'entry' : 'entries'}. Add one with the + on this
        dictionary, then select it to edit.
      </Hint>
      <ScopedPlaceholdersSection kind="dictionary" ownerId={book.id} />
    </div>
  );
};

export default DictionaryBookManager;
