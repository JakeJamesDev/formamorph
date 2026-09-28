import { useCallback, type ReactNode } from 'react';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { useTraitStore } from '@/contexts/TraitStoreContext';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import PlaceholderField, { PlaceholderNameField } from '@/components/prompt/PlaceholderField';
import { updateOwnedGroup } from '@/lib/ownedTraits';
import type { TraitGroup } from '@/types';

/** Right-panel editor for a trait group: name + audience-split descriptions (blank-friendly). An `ownerId`
 *  makes it that entity's group, and edits write to the entity. A link shows its original here `readOnly`,
 *  with its own lines in `detailsHeader` and `detailsFooter`. */
const GroupManager = ({ group, ownerId, readOnly = false, detailsHeader, detailsFooter }: {
  group: TraitGroup;
  ownerId?: string;
  readOnly?: boolean;
  detailsHeader?: ReactNode;
  detailsFooter?: ReactNode;
}) => {
  const { updateTraitGroup, editEntity, placeholders } = useTraitStore();
  const write = useCallback(
    (next: TraitGroup) => (ownerId ? editEntity(ownerId, (e) => updateOwnedGroup(e, next)) : updateTraitGroup(next)),
    [ownerId, editEntity, updateTraitGroup],
  );
  const { draft: editingGroup, setField: handleChange } = useEditingDraft(group, write);

  if (!editingGroup) return null;

  return (
    <div className="space-y-4">
      {detailsHeader}
      <div className="space-y-2">
        <Label>Group Name</Label>
        <PlaceholderNameField
          value={editingGroup.name || ''}
          onChange={(v) => handleChange('name', v)}
          placeholders={placeholders}
          ariaLabel="Group Name"
          readOnly={readOnly}
        />
      </div>
      <PlaceholderField
        label="Player-Facing Description"
        value={editingGroup.playerDescription || ''}
        onChange={(v) => handleChange('playerDescription', v)}
        placeholders={placeholders}
        markdown
        placeholder="Shown above this group's choices in World Setup. Supports markdown."
        readOnly={readOnly}
        resizable
      />
      <PlaceholderField
        label="AI-Facing Description"
        value={editingGroup.aiDescription || ''}
        onChange={(v) => handleChange('aiDescription', v)}
        placeholders={placeholders}
        readOnly={readOnly}
        resizable
      />
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          disabled={readOnly}
          checked={!!editingGroup.exclusive}
          onCheckedChange={(c) => handleChange('exclusive', c === true)}
        />
        <span>Exclusive</span>
        <span className="text-meta text-muted-foreground">Shows as radio buttons, so the player picks at most one trait here</span>
      </label>
      {detailsFooter}
    </div>
  );
};

export default GroupManager;
