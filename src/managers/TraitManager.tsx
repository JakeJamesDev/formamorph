import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useTraitStore } from '@/contexts/TraitStoreContext';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, User } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PanelTabsList } from "@/components/ui/panel-tabs";
import PlaceholderField, { PlaceholderNameField } from '@/components/prompt/PlaceholderField';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { PlaceholderPinRows } from '@/components/editor/PlaceholderPinRows';
import { bearerPlaceholderNames } from '@/lib/placeholderPins';
import { TraitRequiresField } from '@/components/editor/TraitRequiresField';
import { useRenameField } from '@/lib/useCodeRename';
import { statCodeName } from '@/lib/statCodeNames';
import { labelPlaceholders } from '@/lib/placementLetters';
import { traitConflicts, type TraitConflict } from '@/lib/traitEffects';
import { updateOwnedTrait } from '@/lib/ownedTraits';
import { useEditorMode } from '@/lib/editorMode';
import { HelpButton } from '@/components/HelpButton';
import { Hint, Meta } from '@/components/ui/typography';
import { traitPanelTabsFor, traitTabForField, type TraitPanelTab } from '@/views/traitPanelTabs';
import type { Entity, FocusFieldHint, Placeholder, PlaceholderPin, Trait, StatChange, TraitRequirement, TraitStatToggle } from '@/types';

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
    <Meta as="p" className="pl-1">
      Also set by {conflict.others.map((t, i) => (
        <span key={t.id}>{i > 0 && ', '}{link(t)}</span>
      ))}. The lowest in the trait list wins: {winner ? link(winner) : 'this trait'}.
    </Meta>
  );
};

/**
 * Right-panel editor for one trait: its fields split across Details, Stats and Pins.
 *
 * The panel remounts per trait, so the chosen tab is the editor's to hold and arrives as a prop. Pins is
 * Advanced only, which leaves Simple mode two tabs and a strip either way.
 *
 * `focusField` is the search target the find bar just navigated to. A hit on a tab that isn't showing has no
 * field to mark, so the panel opens the owning tab; the same hint the other three panels take.
 *
 * `onOpenTrait` also takes a trait group's id, which the Traits tab selects the same way.
 *
 * An `owner` makes it that entity's trait: edits write to the entity, and the stat sections are gone. Its
 * "Owned by" line goes with `ownerLine` off, for a host whose heading already names the entity.
 * A link shows its original here, with its own lines in `detailsHeader` and `detailsFooter`.
 */
const TraitManager = ({ trait, owner, ownerLine = true, detailsHeader, detailsFooter, onOpenTrait, onOpenEntity, tab, onTabChange, focusField }: {
  trait: Trait;
  owner?: Entity;
  ownerLine?: boolean;
  detailsHeader?: ReactNode;
  detailsFooter?: ReactNode;
  onOpenTrait: (id: string) => void;
  onOpenEntity?: (id: string) => void;
  tab: TraitPanelTab;
  onTabChange: (tab: TraitPanelTab) => void;
  focusField?: FocusFieldHint | null;
}) => {
  const {
    updateTrait, editEntity, stats, placeholders, placementLetters, placeholderOwners, traits, traitGroups, pinWorld,
  } = useTraitStore();
  const ownerId = owner?.id;
  const bearerNames = useMemo(() => (pinWorld ? bearerPlaceholderNames(pinWorld) : undefined), [pinWorld]);
  const write = useCallback(
    (next: Trait) => (ownerId ? editEntity(ownerId, (e) => updateOwnedTrait(e, next)) : updateTrait(next)),
    [ownerId, editEntity, updateTrait],
  );
  const { draft: editingTrait, apply, setField: handleChange } = useEditingDraft<Trait>(trait, write);
  // Code reaches a trait by its code name, so the rename offer compares the two names the way code reads them.
  const rename = useRenameField({
    root: 'traits',
    value: editingTrait.name ?? '',
    siblings: traits,
    ownId: trait.id,
    codeNameOf: (name) => statCodeName(name, placeholders),
  });

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

  const setRequires = (next: TraitRequirement[]) => apply({ requires: next.length ? next : undefined });
  const openRequirement = (r: TraitRequirement) => {
    if (r.kind === 'playingAs') onOpenEntity?.(r.id);
    else onOpenTrait(r.id);
  };

  const { advanced } = useEditorMode();

  // Before the reveal, which is a timer behind this render: the field it looks for has to be mounting by
  // then. A key no tab claims leaves the panel where the author put it.
  useEffect(() => {
    const owning = focusField ? traitTabForField(focusField.fieldKey) : null;
    if (owning) onTabChange(owning);
  }, [focusField, onTabChange]);

  if (!editingTrait) return null;

  // An owned trait carries no stat effects, so it has no Stats tab.
  const tabs = traitPanelTabsFor(advanced).filter((t) => !owner || t.value !== 'stats');
  const shownTab = tabs.some((t) => t.value === tab) ? tab : 'details';

  const detailsPanel = (
    <>
      {detailsHeader}
      {owner && ownerLine && (
        <div className="flex items-start gap-2 rounded-md border border-dashed p-2">
          <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 space-y-0.5">
            <p className="text-label">
              Owned by{' '}
              <button
                type="button"
                className="font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                onClick={() => onOpenEntity?.(owner.id)}
              >
                <PlaceholderText text={owner.name} placeholders={placeholders} />
              </button>
            </p>
            <Hint>Describes them to the AI, and joins your traits when you play as them</Hint>
          </div>
        </div>
      )}
      <div data-tour-anchor="trait-name" className="space-y-2">
        <Label>Name</Label>
        <PlaceholderNameField
          value={editingTrait.name || ''}
          onChange={(v) => handleChange('name', v)}
          placeholders={placeholders}
          ariaLabel="Name"
          // Code reaches world traits only, so an owned trait's rename has nothing to rewrite.
          {...(owner ? {} : { onFocus: rename.onFocus, onBlur: rename.onBlur, onSubmit: rename.onSubmit })}
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
        tourAnchor="trait-ai-description"
      />
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={!!editingTrait.isDefault}
          onCheckedChange={(c) => handleChange('isDefault', c === true)}
        />
        <span>Enabled by Default</span>
        <Hint as="span">Selected when a new game starts</Hint>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={!!editingTrait.playerToggle}
          onCheckedChange={(c) => handleChange('playerToggle', c === true)}
        />
        <span>Player Can Toggle In-Game</span>
        <Hint as="span">The player can turn it on or off from the Traits tab during play</Hint>
      </label>
      <TraitRequiresField trait={editingTrait} onChange={setRequires} onOpen={openRequirement} />
      {detailsFooter}
    </>
  );

  const statsPanel = (
    <>
      <div data-tour-anchor="trait-stat-changes" className="space-y-2">
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
                    {labelPlaceholders(stat.name, placeholders, { letters: placementLetters, owners: placeholderOwners })}
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
                  <SelectItem key={stat.id} value={stat.id}>{labelPlaceholders(stat.name, placeholders, { letters: placementLetters, owners: placeholderOwners })}</SelectItem>
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
    </>
  );

  const pinsPanel = (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>Placeholder Pins</Label>
        <HelpButton topicId="worldEditor.placeholderPins" className="h-6 w-6" />
      </div>
      <PlaceholderPinRows
        pins={pins}
        onChange={setPins}
        source={{ kind: 'trait', id: editingTrait.id }}
        world={pinWorld}
        placeholders={placeholders}
        bearerNames={bearerNames}
        onOpenTrait={onOpenTrait}
      />
    </div>
  );

  const panels: Record<TraitPanelTab, ReactNode> = { details: detailsPanel, stats: statsPanel, pins: pinsPanel };

  return (
    <Tabs value={shownTab} onValueChange={(v) => onTabChange(v as TraitPanelTab)} className="space-y-4">
      <PanelTabsList tabs={tabs} stripLabel="Trait Fields" />
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="space-y-4">{panels[t.value]}</TabsContent>
      ))}
    </Tabs>
  );
};

export default TraitManager;
