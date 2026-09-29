import { useEditingDraft } from '@/lib/useEditingDraft';
import { useGameData } from '@/contexts/GameDataContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PlaceholderGroup } from '@/types';
import { ListDetailFirstRow } from '@/components/ui/list-detail';

/** Right-panel editor for a placeholder folder: just a name. Folders are editor-only and take no chips, so
 *  the name is a plain input rather than a chip field. The Blueprints group keeps its name. */
const PlaceholderGroupManager = ({ group }: { group: PlaceholderGroup }) => {
  const { updatePlaceholderGroup } = useGameData();
  const { draft: editingGroup, setField } = useEditingDraft(group, updatePlaceholderGroup);

  if (!editingGroup) return null;
  const blueprints = editingGroup.system === 'blueprints';

  return (
    <div className="space-y-4">
      <ListDetailFirstRow>
        <div className="space-y-2">
          <Label htmlFor={`group-name-${editingGroup.id}`}>Group Name</Label>
          <Input
            id={`group-name-${editingGroup.id}`}
            value={editingGroup.name || ''}
            onChange={(e) => setField('name', e.target.value)}
            disabled={blueprints}
          />
        </div>
      </ListDetailFirstRow>
      <p className="text-helper text-muted-foreground">
        {blueprints
          ? 'Holds blueprints. Each entity reads a blueprint through its own copy, which you can change for that entity alone.'
          : 'Organizes shared placeholders in the editor only. Groups are never sent to the AI, and a placeholder that belongs to an entity or dictionary stays under it.'}
      </p>
    </div>
  );
};

export default PlaceholderGroupManager;
