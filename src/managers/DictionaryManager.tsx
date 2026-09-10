import { useEffect, type ReactNode } from 'react';
import { useDictionaryStore } from '@/contexts/DictionaryStoreContext';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PanelTabsList } from "@/components/ui/panel-tabs";
import { KeywordChips } from "@/components/KeywordChips";
import { Hint } from "@/components/ui/typography";
import { HintInfo } from "@/components/SettingsRows";
import PlaceholderField, { PlaceholderNameField } from "@/components/prompt/PlaceholderField";
import { useEditorMode } from '@/lib/editorMode';
import {
  dictionaryPanelTabsFor, dictionaryTabForField, type DictionaryPanelTab,
} from '@/views/dictionaryPanelTabs';
import type { DictionaryEntry, FocusFieldHint, Placeholder } from '@/types';

/** The long form behind the Trigger Keywords ⓘ: the chip editor's own controls, which the field does not
 *  label. The line under the chips carries only what the keywords do. */
const KEYWORDS_INFO = `**Trigger Keywords** activate this entry. When a message contains one, the Value is injected into the prompt.

- Press Enter after each keyword.
- Tap or double-click a chip to edit it.
- Drag a chip to reorder. Click its × to remove it.`;

/** The long form behind the Activation ⓘ: one definition per switch. */
const ACTIVATION_INFO = `**Always Inject** — the Value is injected into every prompt. No keyword match is needed.

**Regex** — each keyword is matched as a regular expression.

**Recursive** — an injected Value from another entry can activate this one.`;

/** A compact labeled checkbox for the entry panel's switch rows. */
function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-label">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      {label}
    </label>
  );
}

/**
 * Right-panel editor for one dictionary entry: its fields split across Details and Matching.
 *
 * Both hosts mount this one panel — the World Editor and the library's dictionary editor — so the chosen tab
 * arrives as a prop and each host holds it for as long as its own session lasts. Matching is Advanced only,
 * which leaves Simple mode a single tab and so no strip at all.
 *
 * `focusField` is the search target the find bar just navigated to. A hit on a tab that isn't showing has no
 * field to mark, so the panel opens the owning tab; the same hint the other four panels take. The library
 * editor has no Find and passes none.
 */
const DictionaryManager = ({ entry, placeholders = [], ownerId, tab, onTabChange, focusField }: {
  entry: DictionaryEntry;
  placeholders?: Placeholder[];
  /** The book this entry belongs to, as the owner of its fields — see `ownerId` on `PlaceholderField`.
   *  World Editor only; a library book owns everything it carries. */
  ownerId?: string;
  tab: DictionaryPanelTab;
  onTabChange: (tab: DictionaryPanelTab) => void;
  focusField?: FocusFieldHint | null;
}) => {
  const { updateDictionaryEntry } = useDictionaryStore();
  const { draft: editingEntry, setField: handleChange } = useEditingDraft<DictionaryEntry>(entry, updateDictionaryEntry);
  const { advanced } = useEditorMode();

  // Store a numeric field, clearing it (undefined) when the input is blank or not a number.
  const handleNumber = (field: 'scanDepth', raw: string) => {
    const n = raw === '' ? undefined : Number(raw);
    handleChange(field, n != null && Number.isFinite(n) ? n : undefined);
  };

  const tabs = dictionaryPanelTabsFor(advanced);

  // Before the reveal, which is a timer behind this render: the field it looks for has to be mounting by
  // then. A key no tab claims leaves the panel where the author put it, and so does a hit on a tab this mode
  // doesn't offer — Simple can find a secondary keyword, and Matching is not there to open.
  useEffect(() => {
    const owning = focusField ? dictionaryTabForField(focusField.fieldKey) : null;
    if (owning && tabs.some((t) => t.value === owning)) onTabChange(owning);
    // Only a new hint moves the panel. `tabs` is left out on purpose: re-running when the mode widens would
    // act on the last hint again and open a tab the author never asked for.
  }, [focusField, onTabChange]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editingEntry) return null;

  // A regex keyword uses braces as quantifiers (`\d{2}`), so the `{` typeahead would fire mid-pattern.
  // Regex entries keep literal keyword fields; a pattern built out of a placeholder isn't a combination
  // worth trading that for.
  const chipPlaceholders = editingEntry.useRegex ? undefined : placeholders;
  const keywords = editingEntry.key ?? [];
  // Secondary keywords share the trigger-keyword chip UI and the same array shape; empty clears the field.
  const secondaryKeywords = editingEntry.secondaryKeys ?? [];
  const handleSecondaryChange = (arr: string[]) => handleChange('secondaryKeys', arr.length ? arr : undefined);

  // One line for the secondary-keyword gate, per any/all × require/exclude mode, in the register's verbs.
  const secondaryHint = secondaryKeywords.length === 0
    ? 'Optional. The entry activates only when these match too, or with Exclude, only when they do not.'
    : editingEntry.secondaryExclude
      ? (editingEntry.secondaryAll
        ? 'Activates when a Trigger Keyword matches and not every Secondary Keyword matches.'
        : 'Activates when a Trigger Keyword matches and no Secondary Keyword matches.')
      : (editingEntry.secondaryAll
        ? 'Activates when a Trigger Keyword matches and every Secondary Keyword matches.'
        : 'Activates when a Trigger Keyword matches and at least one Secondary Keyword matches.');

  const detailsPanel = (
    <>
      <div className="space-y-2">
        <Label>Name</Label>
        <Hint>Names the entry in the list and prefixes the Value in the prompt. Blank uses the first Trigger Keyword.</Hint>
        <PlaceholderNameField
          value={editingEntry.name ?? ''}
          onChange={(v) => handleChange('name', v)}
          placeholders={placeholders}
          ownerId={ownerId}
          placeholder="e.g. Hostile Forces"
          ariaLabel="Name"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Trigger Keywords</Label>
          <HintInfo>{KEYWORDS_INFO}</HintInfo>
        </div>
        <Hint>Press Enter after each keyword. A message that contains one activates the entry.</Hint>
        <KeywordChips keywords={keywords} onChange={(key) => handleChange('key', key)} placeholders={chipPlaceholders} ownerId={ownerId} offerCommaSplit={!editingEntry.useRegex} />
        {/* The two switches that modify these keywords, kept beside them: they are also the only matching
            switches Simple mode shows. */}
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <CheckRow label="Whole Words" checked={!!editingEntry.matchWholeWords} onChange={(v) => handleChange('matchWholeWords', v)} />
          <CheckRow label="Case-Sensitive" checked={!!editingEntry.caseSensitive} onChange={(v) => handleChange('caseSensitive', v)} />
        </div>
      </div>
      <PlaceholderField
        label="Value"
        value={editingEntry.value || ''}
        onChange={(v) => handleChange('value', v)}
        placeholders={placeholders}
        ownerId={ownerId}
        resizable
      />
    </>
  );

  const matchingPanel = (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Activation</Label>
          <HintInfo>{ACTIVATION_INFO}</HintInfo>
        </div>
        <Hint>How this entry activates and how its keywords match.</Hint>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <CheckRow label="Always Inject" checked={!!editingEntry.constant} onChange={(v) => handleChange('constant', v)} />
          <CheckRow label="Regex" checked={!!editingEntry.useRegex} onChange={(v) => handleChange('useRegex', v)} />
          <CheckRow label="Recursive" checked={!!editingEntry.recursive} onChange={(v) => handleChange('recursive', v)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Scan Depth</Label>
        <Hint>How many earlier messages to scan for keywords. Blank scans all of them. 0 scans only the current scene.</Hint>
        <Input type="number" min={0} value={editingEntry.scanDepth ?? ''} onChange={(e) => handleNumber('scanDepth', e.target.value)} placeholder="All history" />
      </div>
      <div className="space-y-2">
        <Label>Secondary Keywords</Label>
        <Hint>{secondaryHint}</Hint>
        <KeywordChips keywords={secondaryKeywords} onChange={handleSecondaryChange} placeholders={chipPlaceholders} ownerId={ownerId} placeholder="e.g. red" offerCommaSplit={!editingEntry.useRegex} />
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <CheckRow label="Require All" checked={!!editingEntry.secondaryAll} onChange={(v) => handleChange('secondaryAll', v)} />
          <CheckRow label="Exclude" checked={!!editingEntry.secondaryExclude} onChange={(v) => handleChange('secondaryExclude', v)} />
        </div>
      </div>
    </>
  );

  const panels: Record<DictionaryPanelTab, ReactNode> = { details: detailsPanel, matching: matchingPanel };

  // One tab is not a choice, so Simple mode gets that tab's body bare rather than a strip of one.
  if (tabs.length === 1) return <div className="space-y-4">{panels[tabs[0].value]}</div>;

  return (
    <Tabs value={tab} onValueChange={(v) => onTabChange(v as DictionaryPanelTab)} className="space-y-4">
      <PanelTabsList tabs={tabs} stripLabel="Entry Fields" />
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="space-y-4">{panels[t.value]}</TabsContent>
      ))}
    </Tabs>
  );
};

export default DictionaryManager;
