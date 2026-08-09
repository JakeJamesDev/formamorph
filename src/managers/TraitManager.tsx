import { useId } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PlaceholderField, { PlaceholderNameField } from '@/components/prompt/PlaceholderField';
import { describePlaceholders } from '@/lib/placeholders';
import { traitConflicts, type TraitConflict } from '@/lib/traitEffects';
import { useEditorMode } from '@/lib/editorMode';
import type { Trait, StatChange, TraitStatToggle, TraitPlaceholderPin } from '@/types';

/** Names another trait that claims the same target, and says which way the tie falls. Silent when nothing
 *  else claims it — the common case, where an extra line would just be noise. */
const ConflictNote = ({ conflict }: { conflict?: TraitConflict }) => {
  if (!conflict) return null;
  const others = conflict.others.join(', ');
  return (
    <p className="text-meta text-muted-foreground pl-1">
      Also set by {others}. {conflict.winsHere ? 'This trait' : others} wins — the lower trait in the list does.
    </p>
  );
};

const TraitManager = ({ trait }: { trait: Trait }) => {
  const { updateTrait, stats, placeholders, traits, traitGroups } = useGameData();
  const { draft: editingTrait, apply, setField: handleChange } = useEditingDraft<Trait>(trait, updateTrait);
  // One datalist per pinned placeholder row, suggesting that placeholder's authored values.
  const pinListId = useId();

  const handleStatChangeAdd = () => {
    apply({ statChanges: [...editingTrait.statChanges, { statId: '', value: 0, type: 'min' } as StatChange] });
  };

  const handleStatChangeUpdate = (index: number, field: string, value: string | number) => {
    const updatedStatChanges = [...editingTrait.statChanges];
    updatedStatChanges[index] = { ...updatedStatChanges[index], [field]: value } as StatChange;
    apply({ statChanges: updatedStatChanges });
  };

  const handleStatChangeRemove = (index: number) => {
    const updatedStatChanges = [...editingTrait.statChanges];
    updatedStatChanges.splice(index, 1);
    apply({ statChanges: updatedStatChanges });
  };

  const statToggles = editingTrait.statToggles ?? [];
  const setStatToggles = (next: TraitStatToggle[]) => apply({ statToggles: next.length ? next : undefined });
  const updateStatToggle = (index: number, patch: Partial<TraitStatToggle>) =>
    setStatToggles(statToggles.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  // Computed off the saved world (edits write through on every keystroke), so the note follows a drag or a
  // change in another trait without any extra plumbing.
  const conflicts = traitConflicts(editingTrait, traits, traitGroups);

  const pins = editingTrait.placeholderPins ?? [];
  const setPins = (next: TraitPlaceholderPin[]) => apply({ placeholderPins: next.length ? next : undefined });
  const updatePin = (index: number, patch: Partial<TraitPlaceholderPin>) =>
    setPins(pins.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const { advanced } = useEditorMode();

  if (!editingTrait) return null;

  return (
    <div className="space-y-4">
       <div className="space-y-2">
        <Label>Name</Label>
        <PlaceholderNameField
          value={editingTrait.name || ''}
          onChange={(v) => handleChange('name', v)}
          placeholders={placeholders}
          ariaLabel="Name"
        />
      </div>
      <PlaceholderField
        label="Player-Facing Description"
        value={editingTrait.playerDescription || ''}
        onChange={(v) => handleChange('playerDescription', v)}
        placeholders={placeholders}
        resizable
      />
      <PlaceholderField
        label="AI-Facing Description"
        value={editingTrait.aiDescription || ''}
        onChange={(v) => handleChange('aiDescription', v)}
        placeholders={placeholders}
        resizable
      />
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={!!editingTrait.isDefault}
          onCheckedChange={(c) => handleChange('isDefault', c === true)}
        />
        <span>Enabled by Default</span>
        <span className="text-meta text-muted-foreground">(pre-checked in the trait-selection screen)</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={!!editingTrait.playerToggle}
          onCheckedChange={(c) => handleChange('playerToggle', c === true)}
        />
        <span>Player Can Toggle In-Game</span>
        <span className="text-meta text-muted-foreground">(switchable from the Traits panel during play)</span>
      </label>
      <div className="space-y-2">
        {/* block so the Add button below always wraps to its own line, even with no rows yet */}
        <Label className="block">Stat Changes</Label>
        {editingTrait.statChanges.map((statChange, index) => (
          <div key={index} className="flex space-x-2">
            <Select
              value={statChange.statId}
              onValueChange={(value) => handleStatChangeUpdate(index, 'statId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select stat" />
              </SelectTrigger>
              <SelectContent>
                {stats.map((stat) => (
                  <SelectItem key={stat.id} value={stat.id}>
                    {describePlaceholders(stat.name, placeholders)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={statChange.value}
              onChange={(e) => handleStatChangeUpdate(index, 'value', Number(e.target.value))}
            />
            <Select
              value={statChange.type}
              onValueChange={(value) => handleStatChangeUpdate(index, 'type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="min">Min</SelectItem>
                <SelectItem value="max">Max</SelectItem>
                <SelectItem value="starting">Starting Value</SelectItem>
                <SelectItem value="regen">Regen</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleStatChangeRemove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button onClick={handleStatChangeAdd}>Add Stat Change</Button>
      </div>

      {advanced && (
      <div className="space-y-2">
        <Label className="block">Stat Availability</Label>
        <p className="text-meta text-muted-foreground">
          Switches a stat on or off while this trait is active, overriding the stat&apos;s own default. A stat that
          is off is hidden from the player and the AI, and its regen and code pause.
        </p>
        {statToggles.map((toggle, index) => (
          <div key={index} className="space-y-1">
          <div className="flex space-x-2">
            <Select value={toggle.statId} onValueChange={(v) => updateStatToggle(index, { statId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select stat" />
              </SelectTrigger>
              <SelectContent>
                {stats.map((stat) => (
                  <SelectItem key={stat.id} value={stat.id}>{describePlaceholders(stat.name, placeholders)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={toggle.enabled ? 'on' : 'off'}
              onValueChange={(v) => updateStatToggle(index, { enabled: v === 'on' })}
            >
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="on">Enable</SelectItem>
                <SelectItem value="off">Disable</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setStatToggles(statToggles.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <ConflictNote conflict={conflicts.stats[toggle.statId]} />
          </div>
        ))}
        <Button onClick={() => setStatToggles([...statToggles, { statId: '', enabled: true }])}>
          Add Stat Availability
        </Button>
      </div>
      )}

      {advanced && (
      <div className="space-y-2">
        <Label className="block">Placeholder Pins</Label>
        <p className="text-meta text-muted-foreground">
          Holds a placeholder at a fixed value while this trait is active. The playthrough&apos;s own roll is kept
          underneath and returns if the trait is switched off.
        </p>
        {pins.map((pin, index) => (
          <div key={index} className="space-y-1">
          <div className="flex space-x-2">
            <Select value={pin.placeholderId} onValueChange={(v) => updatePin(index, { placeholderId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select placeholder" />
              </SelectTrigger>
              <SelectContent>
                {placeholders.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Free text with the placeholder's authored values suggested — a trait may pin a value the
                list doesn't carry (a "Redhead" trait naming a shade nobody else rolls). */}
            <Input
              value={pin.value}
              list={`${pinListId}-${index}`}
              placeholder="Pinned value"
              onChange={(e) => updatePin(index, { value: e.target.value })}
            />
            <datalist id={`${pinListId}-${index}`}>
              {placeholders.find((p) => p.id === pin.placeholderId)?.values.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPins(pins.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <ConflictNote conflict={conflicts.placeholders[pin.placeholderId]} />
          </div>
        ))}
        <Button onClick={() => setPins([...pins, { placeholderId: '', value: '' }])}>Add Placeholder Pin</Button>
      </div>
      )}
    </div>
  );
};

export default TraitManager;
