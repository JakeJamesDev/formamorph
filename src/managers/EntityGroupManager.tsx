import { useState, useEffect } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EntityGroup } from '@/types';

/** Right-panel editor for an entity group: just a name — groups are editor-only folders with no AI fields. */
const EntityGroupManager = ({ group }: { group: EntityGroup }) => {
  const { updateEntityGroup } = useGameData();
  const [editingGroup, setEditingGroup] = useState<EntityGroup>(group);

  useEffect(() => {
    setEditingGroup(group);
  }, [group]);

  const handleChange = (value: string) => {
    const updated = { ...editingGroup, name: value };
    setEditingGroup(updated);
    updateEntityGroup(updated);
  };

  if (!editingGroup) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Group Name</Label>
        <Input value={editingGroup.name || ''} onChange={(e) => handleChange(e.target.value)} />
      </div>
      <p className="text-sm text-muted-foreground">
        Groups are just folders for organizing entities in the editor. They are never sent to the AI.
      </p>
    </div>
  );
};

export default EntityGroupManager;
