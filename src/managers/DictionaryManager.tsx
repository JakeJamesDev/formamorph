import { useDictionaryStore } from '@/contexts/DictionaryStoreContext';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { KeywordChips } from "@/components/KeywordChips";
import PlaceholderField, { PlaceholderNameField } from "@/components/prompt/PlaceholderField";
import { useEditorMode } from '@/lib/editorMode';
import type { DictionaryEntry, Placeholder } from '@/types';

/** A compact labeled checkbox for the lorebook options grid. */
function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      {label}
    </label>
  );
}

const DictionaryManager = ({ entry, placeholders = [] }: { entry: DictionaryEntry; placeholders?: Placeholder[] }) => {
  const { updateDictionaryEntry } = useDictionaryStore();
  const { draft: editingEntry, setField: handleChange } = useEditingDraft<DictionaryEntry>(entry, updateDictionaryEntry);
  const { advanced } = useEditorMode();

  // Store a numeric field, clearing it (undefined) when the input is blank or not a number.
  const handleNumber = (field: 'scanDepth', raw: string) => {
    const n = raw === '' ? undefined : Number(raw);
    handleChange(field, n != null && Number.isFinite(n) ? n : undefined);
  };

  if (!editingEntry) return null;

  // A regex keyword uses braces as quantifiers (`\d{2}`), so the `{` typeahead would fire mid-pattern.
  // Regex entries keep literal keyword fields; a pattern built out of a placeholder isn't a combination
  // worth trading that for.
  const chipPlaceholders = editingEntry.useRegex ? undefined : placeholders;
  const keywords = editingEntry.key ?? [];
  // Secondary keywords share the trigger-keyword chip UI and the same array shape; empty clears the field.
  const secondaryKeywords = editingEntry.secondaryKeys ?? [];
  const handleSecondaryChange = (arr: string[]) => handleChange('secondaryKeys', arr.length ? arr : undefined);

  // Plain-English summary of the secondary-keyword gate for the four any/all × require/exclude modes.
  const secondaryHint = secondaryKeywords.length === 0
    ? 'Optional: also require (or exclude) these before activating.'
    : editingEntry.secondaryExclude
      ? (editingEntry.secondaryAll
        ? 'Fires when a keyword appears and not all secondaries do.'
        : 'Fires when a keyword appears and none of the secondaries do.')
      : (editingEntry.secondaryAll
        ? 'Fires when a keyword and all secondaries appear.'
        : 'Fires when a keyword and at least one secondary appear.');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <PlaceholderNameField
          value={editingEntry.name ?? ''}
          onChange={(v) => handleChange('name', v)}
          placeholders={placeholders}
          placeholder="e.g. Hostile Forces"
          ariaLabel="Name"
        />
        <p className="text-xs text-muted-foreground">
          Labels this entry in the list, and prefixes its value in the AI prompt. Falls back to the first
          keyword when blank.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Trigger Keywords (Key)</Label>
        <KeywordChips keywords={keywords} onChange={(key) => handleChange('key', key)} placeholders={chipPlaceholders} offerCommaSplit={!editingEntry.useRegex} />
        <p className="text-xs text-muted-foreground">
          Type a keyword and press Enter to add it. Tap (or double-click) to edit, drag to reorder, click the × to remove.
          The value below is injected into the AI prompt only when one of these appears in play.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Options</Label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {advanced && (
            <>
              <CheckRow label="Always inject" checked={!!editingEntry.constant} onChange={(v) => handleChange('constant', v)} />
              <CheckRow label="Regex" checked={!!editingEntry.useRegex} onChange={(v) => handleChange('useRegex', v)} />
            </>
          )}
          <CheckRow label="Whole words" checked={!!editingEntry.matchWholeWords} onChange={(v) => handleChange('matchWholeWords', v)} />
          <CheckRow label="Case-sensitive" checked={!!editingEntry.caseSensitive} onChange={(v) => handleChange('caseSensitive', v)} />
          {advanced && (
            <CheckRow label="Recursive" checked={!!editingEntry.recursive} onChange={(v) => handleChange('recursive', v)} />
          )}
        </div>
        {advanced && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Scan depth (messages)</Label>
          <Input type="number" min={0} value={editingEntry.scanDepth ?? ''} onChange={(e) => handleNumber('scanDepth', e.target.value)} placeholder="all history" />
        </div>
        )}
        {advanced && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Secondary Keywords</Label>
          <KeywordChips keywords={secondaryKeywords} onChange={handleSecondaryChange} placeholders={chipPlaceholders} placeholder="e.g. red" offerCommaSplit={!editingEntry.useRegex} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            <CheckRow label="Require all" checked={!!editingEntry.secondaryAll} onChange={(v) => handleChange('secondaryAll', v)} />
            <CheckRow label="Exclude (activate when absent)" checked={!!editingEntry.secondaryExclude} onChange={(v) => handleChange('secondaryExclude', v)} />
          </div>
          <p className="text-[0.7rem] text-muted-foreground">{secondaryHint}</p>
        </div>
        )}
      </div>
      <PlaceholderField
        label="Value (injected on keyword match)"
        value={editingEntry.value || ''}
        onChange={(v) => handleChange('value', v)}
        placeholders={placeholders}
        resizable
      />
    </div>
  );
};

export default DictionaryManager;
