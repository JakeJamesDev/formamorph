import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { useTraitStore } from '@/contexts/TraitStoreContext';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PlaceholderField, { PlaceholderNameField } from '@/components/prompt/PlaceholderField';
import { updateOwnedGroup } from '@/lib/ownedTraits';
import type { TraitGroup } from '@/types';
import { ListDetailFirstRow } from '@/components/ui/list-detail';
import { Hint } from '@/components/ui/typography';

type PickPreset = 'any' | 'exactlyOne' | 'upToOne' | 'custom';

const PRESETS: Record<Exclude<PickPreset, 'custom'>, Pick<TraitGroup, 'minPicks' | 'maxPicks'>> = {
  any: { minPicks: undefined, maxPicks: undefined },
  exactlyOne: { minPicks: 1, maxPicks: 1 },
  upToOne: { minPicks: undefined, maxPicks: 1 },
};

/** The preset a group's counts match; custom when none does. */
function presetOf({ minPicks, maxPicks }: TraitGroup): PickPreset {
  const min = minPicks ?? 0;
  if (maxPicks === undefined) return min === 0 ? 'any' : 'custom';
  if (maxPicks === 1) return min === 0 ? 'upToOne' : min === 1 ? 'exactlyOne' : 'custom';
  return 'custom';
}

/** A count field's value: blank is absent, anything else a whole number of at least 0. */
const countOf = (text: string): number | undefined =>
  (text.trim() === '' ? undefined : Math.max(0, Math.round(Number(text) || 0)));

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
  const { draft: editingGroup, setField: handleChange, apply } = useEditingDraft(group, write);
  const traitField = useMemo(() => ({ owned: !!ownerId }), [ownerId]);
  // Custom stays picked for this group even when its counts match a preset.
  const [customFor, setCustomFor] = useState<string | null>(null);

  if (!editingGroup) return null;
  const preset = customFor === editingGroup.id ? 'custom' : presetOf(editingGroup);

  const nameField = (
    <div className="space-y-2">
      <Label>Group Name</Label>
      <PlaceholderNameField
        trait={traitField}
        value={editingGroup.name || ''}
        onChange={(v) => handleChange('name', v)}
        placeholders={placeholders}
        ariaLabel="Group Name"
        readOnly={readOnly}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {detailsHeader ? (
        <>
          <ListDetailFirstRow align="center">{detailsHeader}</ListDetailFirstRow>
          {nameField}
        </>
      ) : <ListDetailFirstRow>{nameField}</ListDetailFirstRow>}
      <PlaceholderField
        trait={traitField}
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
        trait={traitField}
        label="AI-Facing Description"
        value={editingGroup.aiDescription || ''}
        onChange={(v) => handleChange('aiDescription', v)}
        placeholders={placeholders}
        readOnly={readOnly}
        resizable
      />
      <div className="space-y-2">
        <Label htmlFor={`pick-count-${editingGroup.id}`}>Pick Count</Label>
        <Select
          disabled={readOnly}
          value={preset}
          onValueChange={(value) => {
            const next = value as PickPreset;
            setCustomFor(next === 'custom' ? editingGroup.id : null);
            if (next !== 'custom') apply(PRESETS[next]);
          }}
        >
          <SelectTrigger id={`pick-count-${editingGroup.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="exactlyOne">Exactly One</SelectItem>
            <SelectItem value="upToOne">Up to One</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor={`pick-min-${editingGroup.id}`} className="text-meta text-muted-foreground">At Least</Label>
              <Input
                id={`pick-min-${editingGroup.id}`}
                type="number"
                min={0}
                step={1}
                placeholder="0"
                disabled={readOnly}
                value={editingGroup.minPicks ?? ''}
                onChange={(e) => handleChange('minPicks', countOf(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`pick-max-${editingGroup.id}`} className="text-meta text-muted-foreground">At Most</Label>
              <Input
                id={`pick-max-${editingGroup.id}`}
                type="number"
                min={0}
                step={1}
                placeholder="No limit"
                disabled={readOnly}
                value={editingGroup.maxPicks ?? ''}
                onChange={(e) => handleChange('maxPicks', countOf(e.target.value))}
              />
            </div>
          </div>
        )}
        <Hint>Counts only the traits placed directly in this group</Hint>
      </div>
      {detailsFooter}
    </div>
  );
};

export default GroupManager;
