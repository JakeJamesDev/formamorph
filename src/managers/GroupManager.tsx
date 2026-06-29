import { useState, useEffect } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { TraitGroup } from '@/types';

/** Right-panel editor for a trait group: name + audience-split descriptions (blank-friendly). */
const GroupManager = ({ group }: { group: TraitGroup }) => {
  const { updateTraitGroup } = useGameData();
  const [editingGroup, setEditingGroup] = useState<TraitGroup>(group);

  useEffect(() => {
    setEditingGroup(group);
  }, [group]);

  const handleChange = (field: keyof TraitGroup, value: string) => {
    const updated = { ...editingGroup, [field]: value };
    setEditingGroup(updated);
    updateTraitGroup(updated);
  };

  if (!editingGroup) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Group Name</Label>
        <Input
          value={editingGroup.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Player-Facing Description</Label>
        <Textarea
          value={editingGroup.playerDescription || ''}
          onChange={(e) => handleChange('playerDescription', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>AI-Facing Description</Label>
        <Textarea
          value={editingGroup.aiDescription || ''}
          onChange={(e) => handleChange('aiDescription', e.target.value)}
        />
      </div>
    </div>
  );
};

export default GroupManager;
