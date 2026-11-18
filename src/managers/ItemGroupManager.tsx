import { useEditingDraft } from '@/lib/useEditingDraft';
import { useGameDataActions } from '@/contexts/GameDataContext';
import { Label } from '@/components/ui/label';
import type { ItemGroup } from '@/types';
import { ListDetailFirstRow } from '@/components/ui/list-detail';
import { WorldInput } from '@/components/editor/WorldField';
import { fieldFrame } from '@/lib/historyField';
import { Hint } from '@/components/ui/typography';

/** Right-panel editor for an item group: a name only. */
const ItemGroupManager = ({ group }: { group: ItemGroup }) => {
  const { updateItemGroup } = useGameDataActions();
  const { draft: editingGroup, setField } = useEditingDraft(group, updateItemGroup);

  if (!editingGroup) return null;

  return (
    <div className="space-y-4">
      <ListDetailFirstRow>
        <div className="space-y-2" {...fieldFrame('name')}>
          <Label>Group Name</Label>
          <WorldInput value={editingGroup.name || ''} onChange={(e) => setField('name', e.target.value)} />
        </div>
      </ListDetailFirstRow>
      <Hint>Organizes items in the editor only. The AI and the player never see groups.</Hint>
    </div>
  );
};

export default ItemGroupManager;
