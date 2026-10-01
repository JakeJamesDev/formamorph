import { useEffect } from 'react';
import { Hint } from '@/components/ui/typography';
import { PanelTabContent, PanelTabs } from '@/components/ui/panel-tabs';
import { useEditorMode } from '@/lib/editorMode';
import {
  dictionaryBookPanelTabsFor, dictionaryBookTabForField, type DictionaryBookPanelTab,
} from '@/views/dictionaryBookPanelTabs';
import type { Dictionary, FocusFieldHint } from '@/types';
import DictionaryBookFields from './DictionaryBookFields';
import ScopedPlaceholdersSection from './ScopedPlaceholdersSection';

/** Right-panel editor for a selected book (dictionary): its own fields on Details, its scoped placeholders
 *  on Placeholders. Entry editing is the DictionaryManager's job; add/delete entries from the tree on the left.
 *
 *  The panel remounts per book, so the chosen tab and the open placeholder are the editor's to hold and
 *  arrive as props. Placeholders is Advanced only, so Simple mode leaves one tab and no strip.
 *
 *  `focusField` is the Find hit the editor just navigated to. The panel opens the tab that holds it. */
const DictionaryBookManager = ({
  book, tab, onTabChange, placeholderId, onPlaceholderIdChange, onOpenWorldPlaceholder, focusField,
}: {
  book: Dictionary;
  tab: DictionaryBookPanelTab;
  onTabChange: (tab: DictionaryBookPanelTab) => void;
  /** The Placeholders tab's open row; null shows its list. */
  placeholderId: string | null;
  onPlaceholderIdChange: (id: string | null) => void;
  /** Opens a world placeholder on the editor's Placeholders tab. */
  onOpenWorldPlaceholder: (id: string) => void;
  focusField?: FocusFieldHint | null;
}) => {
  const { advanced } = useEditorMode();
  const tabs = dictionaryBookPanelTabsFor(advanced);

  // Before the reveal, which is a timer behind this render: the field it looks for has to be mounting by then.
  useEffect(() => {
    const owning = focusField ? dictionaryBookTabForField(focusField.fieldKey) : null;
    if (owning) onTabChange(owning);
  }, [focusField, onTabChange]);

  const detailsPanel = (
    <>
      <DictionaryBookFields book={book} />
      <Hint>
        {book.entries.length} {book.entries.length === 1 ? 'entry' : 'entries'}. Add one with the + on this
        dictionary, then select it to edit.
      </Hint>
    </>
  );

  return (
    <PanelTabs tabs={tabs} value={tab} onValueChange={onTabChange} stripLabel="Dictionary Fields" surfaceTabs="worldEditorBook">
      <PanelTabContent value="details">{detailsPanel}</PanelTabContent>
      <PanelTabContent value="placeholders" fill>
        <ScopedPlaceholdersSection
          kind="dictionary"
          ownerId={book.id}
          selectedId={placeholderId}
          onSelect={onPlaceholderIdChange}
          onOpenWorldPlaceholder={onOpenWorldPlaceholder}
        />
      </PanelTabContent>
    </PanelTabs>
  );
};

export default DictionaryBookManager;
