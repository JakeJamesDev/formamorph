import { useEditingDraft } from '@/lib/useEditingDraft';
import { useGameData } from '@/contexts/GameDataContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import PlaceholderField from '@/components/prompt/PlaceholderField';
import type { TraitGroup } from '@/types';

/** Right-panel editor for a trait group: name + audience-split descriptions (blank-friendly). */
const GroupManager = ({ group }: { group: TraitGroup }) => {
  const { updateTraitGroup, placeholders } = useGameData();
  const { draft: editingGroup, setField: handleChange } = useEditingDraft(group, updateTraitGroup);

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
        <PlaceholderField
          value={editingGroup.playerDescription || ''}
          onChange={(v) => handleChange('playerDescription', v)}
          placeholders={placeholders}
          resizable
        />
      </div>
      <div className="space-y-2">
        <Label>AI-Facing Description</Label>
        <PlaceholderField
          value={editingGroup.aiDescription || ''}
          onChange={(v) => handleChange('aiDescription', v)}
          placeholders={placeholders}
          resizable
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={!!editingGroup.exclusive}
          onCheckedChange={(c) => handleChange('exclusive', c === true)}
        />
        <span>Exclusive</span>
        <span className="text-xs text-muted-foreground">(at most one trait here; picked as radio buttons)</span>
      </label>
    </div>
  );
};

export default GroupManager;
