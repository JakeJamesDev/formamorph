import { useEditingDraft } from '@/lib/useEditingDraft';
import { useStatEditorWorld } from '@/lib/useStatEditorWorld';
import { Label } from '@/components/ui/label';
import PlaceholderField, { PlaceholderNameField } from '@/components/prompt/PlaceholderField';
import { ListDetailFirstRow } from '@/components/ui/list-detail';
import { fieldFrame } from '@/lib/historyField';
import { GroupAiHeadingField } from '@/components/editor/GroupAiHeadingField';
import type { StatGroup } from '@/types';

/** Right-panel editor for a stat group: a name and a description. The player's stats and each entity's own use
 *  the same panel; `write` says where the edit lands. A group sets no modes, pick counts or gates. */
const StatGroupManager = ({ group, write }: { group: StatGroup; write: (group: StatGroup) => void }) => {
  const { placeholders } = useStatEditorWorld();
  const { draft: editingGroup, setField } = useEditingDraft(group, write);

  if (!editingGroup) return null;

  return (
    <div className="space-y-4">
      <ListDetailFirstRow>
        <div className="space-y-2" {...fieldFrame('name')}>
          <Label>Group Name</Label>
          <PlaceholderNameField
            value={editingGroup.name || ''}
            onChange={(v) => setField('name', v)}
            placeholders={placeholders}
            ariaLabel="Group Name"
          />
        </div>
      </ListDetailFirstRow>
      <PlaceholderField
        label="AI-Facing Description"
        historyField="aiDescription"
        value={editingGroup.aiDescription || ''}
        onChange={(v) => setField('aiDescription', v)}
        placeholders={placeholders}
        resizable
      />
      <GroupAiHeadingField group={editingGroup} members="stats" onChange={(v) => setField('aiVisible', v)} />
    </div>
  );
};

export default StatGroupManager;
