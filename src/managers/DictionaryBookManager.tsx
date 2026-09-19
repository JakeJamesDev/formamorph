import { useEffect } from 'react';
import { Hint } from '@/components/ui/typography';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PanelTabsList } from '@/components/ui/panel-tabs';
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
 *  The panel remounts per book, so the chosen tab is the editor's to hold and arrives as a prop. Placeholders
 *  is Advanced only, so Simple mode leaves one tab and no strip.
 *
 *  `focusField` is the Find hit the editor just navigated to. The panel opens the tab that holds it. */
const DictionaryBookManager = ({ book, tab, onTabChange, focusField }: {
  book: Dictionary;
  tab: DictionaryBookPanelTab;
  onTabChange: (tab: DictionaryBookPanelTab) => void;
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

  if (tabs.length === 1) return <div className="space-y-4">{detailsPanel}</div>;

  return (
    <Tabs value={tab} onValueChange={(v) => onTabChange(v as DictionaryBookPanelTab)} className="space-y-4">
      <PanelTabsList tabs={tabs} stripLabel="Dictionary Fields" />
      <TabsContent value="details" className="space-y-4">{detailsPanel}</TabsContent>
      <TabsContent value="placeholders">
        <ScopedPlaceholdersSection kind="dictionary" ownerId={book.id} fill />
      </TabsContent>
    </Tabs>
  );
};

export default DictionaryBookManager;
