import { useEditingDraft } from '@/lib/useEditingDraft';
import { useGameData } from '@/contexts/GameDataContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PlaceholderGroup } from '@/types';

/** Right-panel editor for a placeholder folder: just a name. Folders are editor-only and take no chips, so
 *  the name is a plain input rather than a chip field. */
const PlaceholderGroupManager = ({ group }: { group: PlaceholderGroup }) => {
  const { updatePlaceholderGroup } = useGameData();
  const { draft: editingGroup, setField } = useEditingDraft(group, updatePlaceholderGroup);

  if (!editingGroup) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Group Name</Label>
        <Input value={editingGroup.name || ''} onChange={(e) => setField('name', e.target.value)} />
      </div>
      <p className="text-helper text-muted-foreground">
        Groups are just folders for organizing shared placeholders in the editor. They are never sent to the AI,
        and a placeholder that belongs to an entity or dictionary stays under it.
      </p>
    </div>
  );
};

export default PlaceholderGroupManager;
