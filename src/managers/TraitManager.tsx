import { useGameData } from '@/contexts/GameDataContext';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PlaceholderField, { PlaceholderNameField } from '@/components/prompt/PlaceholderField';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { PlaceholderPinRows } from '@/components/editor/PlaceholderPinRows';
import { labelPlaceholders } from '@/lib/placementLetters';
import { traitConflicts, type TraitConflict } from '@/lib/traitEffects';
import { useEditorMode } from '@/lib/editorMode';
import { HelpButton } from '@/components/HelpButton';
import type { Placeholder, PlaceholderPin, Trait, StatChange, TraitStatToggle } from '@/types';

/** Names another trait that claims the same target, and says which way the tie falls. Silent when nothing
 *  else claims it — the common case, where an extra line would just be noise. */
const ConflictNote = ({ conflict, placeholders, onOpen }: {
  conflict?: TraitConflict;
  placeholders: Placeholder[];
  onOpen: (id: string) => void;
}) => {
  if (!conflict) return null;
  // The winner is whichever claimant sits lowest in the trait list; `others` is in authored order, so
  // when this trait loses, the last one is the one that beats it.
  const winner = conflict.winsHere ? null : conflict.others[conflict.others.length - 1];
  const link = (t: { id: string; name: string }) => (
    <button
      type="button"
      className="underline underline-offset-2 hover:text-foreground"
      onClick={() => onOpen(t.id)}
    >
      <PlaceholderText text={t.name} placeholders={placeholders} />
    </button>
  );
  return (
    <p className="text-meta text-muted-foreground pl-1">
      Also set by {conflict.others.map((t, i) => (
        <span key={t.id}>{i > 0 && ', '}{link(t)}</span>
      ))}. The lowest in the trait list wins: {winner ? link(winner) : 'this trait'}.
    </p>
  );
};

const TraitManager = ({ trait, onOpenTrait }: { trait: Trait; onOpenTrait: (id: string) => void }) => {
  const world = useGameData();
  const { updateTrait, stats, placeholders, placementLetters, placeholderOwners, traits, traitGroups } = world;
  const { draft: editingTrait, apply, setField: handleChange } = useEditingDraft<Trait>(trait, updateTrait);

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
  const setPins = (next: PlaceholderPin[]) => apply({ placeholderPins: next.length ? next : undefined });

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
        <div className="flex items-center gap-2">
          <Label>Stat Changes</Label>
          <HelpButton topicId="worldEditor.statChanges" className="h-6 w-6" />
        </div>
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
                    {labelPlaceholders(stat.name, placeholders, placementLetters, placeholderOwners)}
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
        <Button size="sm" onClick={handleStatChangeAdd}>Add Stat Change</Button>
      </div>

      {advanced && (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Stat Availability</Label>
          <HelpButton topicId="worldEditor.statAvailability" className="h-6 w-6" />
        </div>
        {statToggles.map((toggle, index) => (
          <div key={index} className="space-y-1">
          <div className="flex space-x-2">
            <Select value={toggle.statId} onValueChange={(v) => updateStatToggle(index, { statId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select stat" />
              </SelectTrigger>
              <SelectContent>
                {stats.map((stat) => (
                  <SelectItem key={stat.id} value={stat.id}>{labelPlaceholders(stat.name, placeholders, placementLetters, placeholderOwners)}</SelectItem>
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
          <ConflictNote conflict={conflicts.stats[toggle.statId]} placeholders={placeholders} onOpen={onOpenTrait} />
          </div>
        ))}
        <Button size="sm" onClick={() => setStatToggles([...statToggles, { statId: '', enabled: true }])}>
          Add Stat Availability
        </Button>
      </div>
      )}

      {advanced && (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Placeholder Pins</Label>
          <HelpButton topicId="worldEditor.placeholderPins" className="h-6 w-6" />
        </div>
        <PlaceholderPinRows
          pins={pins}
          onChange={setPins}
          source={{ kind: 'trait', id: editingTrait.id }}
          world={world}
          placeholders={placeholders}
          onOpenTrait={onOpenTrait}
        />
      </div>
      )}
    </div>
  );
};

export default TraitManager;
