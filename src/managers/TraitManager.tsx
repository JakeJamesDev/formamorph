import { useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { Input } from "@/components/ui/input";
import { TokenAutocomplete } from '@/components/TokenAutocomplete';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PlaceholderField, { PlaceholderNameField } from '@/components/prompt/PlaceholderField';
import { describePlaceholders, lonePlaceholderToken, placeholderValueLine } from '@/lib/placeholders';
import { placeholderVocabulary } from '@/lib/chipVocabulary';
import { traitConflicts, withPinnedValue, type TraitConflict } from '@/lib/traitEffects';
import { useEditorMode } from '@/lib/editorMode';
import { HelpButton } from '@/components/HelpButton';
import type { Trait, StatChange, TraitStatToggle, TraitPlaceholderPin } from '@/types';

/** Names another trait that claims the same target, and says which way the tie falls. Silent when nothing
 *  else claims it — the common case, where an extra line would just be noise. */
const ConflictNote = ({ conflict, onOpen }: { conflict?: TraitConflict; onOpen: (id: string) => void }) => {
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
      {t.name}
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
  const { updateTrait, stats, placeholders, traits, traitGroups } = useGameData();
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
  const setPins = (next: TraitPlaceholderPin[]) => apply({ placeholderPins: next.length ? next : undefined });
  // The pin's text goes through the writer that names the value by id when the list carries it, so picking
  // "Red" survives the author re-spelling it and typing a shade nobody rolls stays free text.
  const setPinValue = (index: number, value: string) =>
    setPins(pins.map((p, i) => (i === index ? withPinnedValue(p, value, placeholders) : p)));
  const pinVocab = useMemo(() => placeholderVocabulary(placeholders), [placeholders]);
  /** A value as the pin picker shows it. A value that is exactly one chip is a part, so it reads as the part
   *  it names — the same reading the Values field gives it, and the one an author picking a variant is
   *  after. A chip inside longer text is prose, so it reads as what it will resolve to. What the pin stores
   *  is the value itself either way. */
  const describeValue = (value: string) => {
    const lone = lonePlaceholderToken(value);
    if (lone) return pinVocab.label(lone);
    return placeholderValueLine(describePlaceholders(value, placeholders)) || value;
  };

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
          <ConflictNote conflict={conflicts.stats[toggle.statId]} onOpen={onOpenTrait} />
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
        {pins.map((pin, index) => (
          <div key={index} className="space-y-1">
          <div className="flex space-x-2">
            {/* Re-aiming the pin drops the value id with it — the id named a value of the old placeholder. */}
            <Select
              value={pin.placeholderId}
              onValueChange={(v) => setPins(pins.map((p, i) =>
                (i === index ? withPinnedValue({ ...p, placeholderId: v }, p.value, placeholders) : p)))}
            >
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
            {/* w-full to match the SelectTrigger beside it — equal flex bases split the row in half,
                exactly as the plain Input this replaced did. */}
            <div className="w-full min-w-0">
              <TokenAutocomplete
                single
                openOnFocus
                values={pin.value ? [pin.value] : []}
                onChange={(vals) => setPinValue(index, vals[0] ?? '')}
                options={placeholders.find((p) => p.id === pin.placeholderId)?.values.map((v) => v.text) ?? []}
                describe={describeValue}
                ariaLabel="Pinned value"
                placeholder="Pinned value"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPins(pins.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <ConflictNote conflict={conflicts.placeholders[pin.placeholderId]} onOpen={onOpenTrait} />
          </div>
        ))}
        <Button size="sm" onClick={() => setPins([...pins, { placeholderId: '', value: '' }])}>Add Placeholder Pin</Button>
      </div>
      )}
    </div>
  );
};

export default TraitManager;
