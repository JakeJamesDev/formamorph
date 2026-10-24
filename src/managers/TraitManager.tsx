import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { ownerPreview } from '@/lib/ownedTraitsInPlay';
import { useTraitStore } from '@/contexts/TraitStoreContext';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { EntityIcon } from '@/lib/elementIcons';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PanelTabContent, PanelTabs } from "@/components/ui/panel-tabs";
import { globalStatsOf, resolvedEntityStats } from '@/lib/statLinks';
import type { SurfaceLedgerName } from "@/components/ui/surface";
import PlaceholderField, { PlaceholderNameField } from '@/components/prompt/PlaceholderField';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { PlaceholderPinRows } from '@/components/editor/PlaceholderPinRows';
import { TraitRequiresField } from '@/components/editor/TraitRequiresField';
import { TraitAvailabilityRule } from '@/components/editor/TraitAvailabilityRule';
import { useRenameField } from '@/lib/useCodeRename';
import { statCodeName } from '@/lib/statCodeNames';
import { labelPlaceholders } from '@/lib/placementLetters';
import { traitConflicts, type TraitConflict } from '@/lib/traitEffects';
import { updateOwnedTrait } from '@/lib/ownedTraits';
import { statRowSide, type StatRow, type StatRowSide } from '@/lib/traitTree';
import { useEditorMode } from '@/lib/editorMode';
import { HelpButton } from '@/components/HelpButton';
import { Hint, Meta } from '@/components/ui/typography';
import { traitPanelTabsFor, traitTabForField, type TraitPanelTab } from '@/views/traitPanelTabs';
import { FieldReset, LabelRow } from '@/components/editor/BlueprintReset';
import { TraitScripts } from './TraitScripts';
import { offWorldOf, traitPanelHome } from '@/lib/scriptBoxHome';
import { useCodeUseReveal } from '@/lib/codeUseReveal';
import type {
  Entity, FocusFieldHint, Placeholder, PlaceholderPin, Stat, StatGroup, Trait, StatChange, TraitLinkFields, TraitRequirement, TraitRequirementRow, TraitStatToggle,
} from '@/types';
import { WorldInput } from '@/components/editor/WorldField';
import { fieldFrame } from '@/lib/historyField';

/** A link's edit of one trait it brings: which fields it overrides, which of those the blueprint changed
 *  since, and where a whole-trait write and a field reset go. */
export interface TraitLinkEdit {
  ownerId: string;
  linkId: string;
  overridden: readonly (keyof TraitLinkFields)[];
  stale: readonly (keyof TraitLinkFields)[];
  write: (next: Trait) => void;
  reset: (field: keyof TraitLinkFields) => void;
}

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

/** Whose stat each of an owner's trait rows moves, as play routes it. */
const ownerRowSide = (world: { stats: Stat[]; statGroups: StatGroup[] }, owner: Entity) => {
  const own = new Set(resolvedEntityStats(world, owner).map((s) => s.id));
  const global = new Set(globalStatsOf(world.stats, world.statGroups).map((s) => s.id));
  return (row: StatRow) => statRowSide(row, own, global);
};

/** The picker value of a global stat on an owner's trait, kept apart from an own stat with the same id. */
const GLOBAL_ITEM = 'global:';

/** A stat row's picker value: its Global item when it moves a global stat on an owner. */
const pickerValue = (row: StatRow, side: StatRowSide) => (side === 'global' ? GLOBAL_ITEM + row.statId : row.statId);

/** `row` pointed at the stat a picker value names; a Global item takes the global target. */
function pickedRow<R extends StatRow>(row: R, value: string): R {
  const rest = { ...row };
  delete rest.target;
  return value.startsWith(GLOBAL_ITEM)
    ? { ...rest, statId: value.slice(GLOBAL_ITEM.length), target: 'global' }
    : { ...rest, statId: value };
}

/** One labeled list of stats a trait's stat rows can name. */
interface StatChoices {
  label?: string;
  stats: readonly Stat[];
  /** The global stats on an owner's trait, whose items take the global target. */
  global?: boolean;
}

/** The stat options of a trait's stat row, under a heading per list when there is more than one. */
function StatOptions({ choices, label }: { choices: readonly StatChoices[]; label: (name: string) => string }) {
  const items = (choice: StatChoices) => choice.stats.map((stat) => {
    const value = choice.global ? GLOBAL_ITEM + stat.id : stat.id;
    return <SelectItem key={value} value={value}>{label(stat.name)}</SelectItem>;
  });
  if (choices.length === 1) return <>{items(choices[0])}</>;
  return (
    <>
      {choices.map((choice) => (
        <SelectGroup key={choice.label}>
          <SelectLabel>{choice.label}</SelectLabel>
          {items(choice)}
        </SelectGroup>
      ))}
    </>
  );
}

/**
 * Right-panel editor for one trait: its fields split across Details, Availability, Stats, Pins and Scripts.
 *
 * The panel remounts per trait, so the chosen tab is the editor's to hold and arrives as a prop. Pins and
 * Scripts are Advanced only.
 *
 * `focusField` is the search target the find bar just navigated to. A hit on a tab that isn't showing has no
 * field to mark, so the panel opens the owning tab; the same hint the other three panels take.
 *
 * `onOpenTrait` also takes a trait group's id, which the Traits tab selects the same way.
 *
 * An `owner` makes it that entity's trait: edits write to the entity, and the stat sections show on a persona
 * or where the trait already has stat effects. Its "Owned by" line goes with `ownerLine` off, for a host whose
 * heading already names the entity. A host that can open only some requirement targets says which through
 * `requirementOpens`; the rest read as plain chips. A `link` edits the trait as that link reads it:
 * overridable fields write the link's overrides and show a Reset while overridden, and the rest is read-only.
 * Its own lines go in `detailsHeader` and `availabilityFooter`.
 */
const TraitManager = ({
  trait, owner, link, ownerLine = true, detailsHeader, availabilityFooter, onOpenTrait, onOpenEntity, requirementOpens, tab, onTabChange,
  focusField, surfaceTabs, rowId,
}: {
  /** The row the trait's list selects to show this panel: a Link's row for a linked trait. Absent = the trait's id. */
  rowId?: string;
  /** The tab ledger this panel reports under, for a host that has one. */
  surfaceTabs?: SurfaceLedgerName;
  trait: Trait;
  owner?: Entity;
  link?: TraitLinkEdit;
  ownerLine?: boolean;
  detailsHeader?: ReactNode;
  availabilityFooter?: ReactNode;
  onOpenTrait: (id: string) => void;
  onOpenEntity?: (id: string) => void;
  requirementOpens?: (requirement: TraitRequirement) => boolean;
  tab: TraitPanelTab;
  onTabChange: (tab: TraitPanelTab) => void;
  focusField?: FocusFieldHint | null;
}) => {
  const {
    updateTrait, editEntity, stats, statGroups, placeholders, placementLetters, placeholderOwners, traits, traitGroups, pinWorld, entities, entityRoot,
  } = useTraitStore();
  const ownerId = owner?.id;
  // A linked trait's scripts run as the trait it brings, on the link's owner.
  const linkOwnerId = link?.ownerId;
  const linkId = link?.linkId;
  const scriptHome = useMemo(
    () => traitPanelHome(trait.id, ownerId, linkOwnerId && linkId ? { ownerId: linkOwnerId, linkId } : undefined),
    [linkOwnerId, linkId, ownerId, trait.id],
  );
  const scriptOffWorld = useMemo(() => entityRoot && offWorldOf(entityRoot.owner, entityRoot.world), [entityRoot]);
  // A link or an owned trait previews as its owner's text: the owner's name, copies and pins.
  const traitOwner = link ? entities.find((e) => e.id === link.ownerId) : owner;
  const traitOwnerId = traitOwner?.id;
  const preview = useMemo(
    () => (traitOwnerId ? ownerPreview({ traits, traitGroups, entities }, placeholders, placeholders, traitOwnerId, trait.id) ?? undefined : undefined),
    [traitOwnerId, traits, traitGroups, entities, placeholders, trait.id],
  );
  // A link shows its original's text, which the world holds.
  const traitField = useMemo(() => ({ owned: !!owner && !link }), [owner, link]);
  const linkWrite = link?.write;
  const write = useCallback(
    (next: Trait) => (linkWrite ? linkWrite(next) : ownerId ? editEntity(ownerId, (e) => updateOwnedTrait(e, next)) : updateTrait(next)),
    [linkWrite, ownerId, editEntity, updateTrait],
  );
  const readOnly = !!link;
  const resetControl = (field: keyof TraitLinkFields, label: string) => (link?.overridden.includes(field)
    ? <FieldReset field={label} stale={link.stale.includes(field)} onReset={() => link.reset(field)} />
    : null);
  const { draft: editingTrait, apply, setField: handleChange } = useEditingDraft<Trait>(trait, write);
  // Code reaches a trait by its code name, so the rename offer compares the two names the way code reads them.
  const rename = useRenameField({
    root: 'traits',
    value: editingTrait.name ?? '',
    siblings: traits,
    ownId: trait.id,
    codeNameOf: (name) => statCodeName(name, placeholders),
    traitId: trait.id,
  });

  const handleStatChangeAdd = () => {
    apply({ statChanges: [...editingTrait.statChanges, { statId: '', value: 0, type: 'min' } as StatChange] });
  };

  const handleStatChangeUpdate = (index: number, field: string, value: string | number) => {
    const updatedStatChanges = [...editingTrait.statChanges];
    const row = updatedStatChanges[index];
    updatedStatChanges[index] = field === 'statId' ? pickedRow(row, String(value)) : { ...row, [field]: value } as StatChange;
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

  // An owner's rows route to its own stats or the player's; world traits rival only the ones on the player's.
  const statWorld = { stats, statGroups: statGroups ?? [] };
  const rowSide = traitOwner ? ownerRowSide(statWorld, traitOwner) : () => null;
  const globalToggles = traitOwner ? statToggles.filter((toggle) => rowSide(toggle) === 'global') : statToggles;
  // Computed off the saved world (edits write through on every keystroke), so the note follows a drag or a
  // change in another trait without any extra plumbing.
  const conflicts = traitConflicts({ ...editingTrait, statToggles: globalToggles }, traits, traitGroups);

  const pins = editingTrait.placeholderPins ?? [];
  const setPins = (next: PlaceholderPin[]) => apply({ placeholderPins: next.length ? next : undefined });

  const setRequires = (next: TraitRequirementRow[]) => apply({ requires: next.length ? next : undefined });
  const openRequirement = (r: TraitRequirement) => {
    if (r.kind === 'playingAs') onOpenEntity?.(r.id);
    else if (r.kind !== 'time') onOpenTrait(r.id);
  };

  const { advanced } = useEditorMode();

  // A Find All Uses row bound for one of this trait's scripts shows it on the Scripts tab.
  const reveal = useCodeUseReveal(rowId ?? trait.id, traitOwnerId ?? null, 'trait');
  useEffect(() => {
    if (reveal) onTabChange('scripts');
  }, [reveal, onTabChange]);

  // Before the reveal, which is a timer behind this render: the field it looks for has to be mounting by
  // then. A key no tab claims leaves the panel where the author put it.
  useEffect(() => {
    const owning = focusField ? traitTabForField(focusField.fieldKey) : null;
    if (owning) onTabChange(owning);
  }, [focusField, onTabChange]);

  if (!editingTrait) return null;

  const tabs = traitPanelTabsFor(advanced);
  // An owner's trait changes the owner's own stats, and the global stats whoever is played (Q18).
  const statLabel = (name: string) => labelPlaceholders(name, placeholders, { letters: placementLetters, owners: placeholderOwners });
  // An owner's own stats include its links; the global stats leave the Blueprints out.
  const globalStats = traitOwner ? globalStatsOf(stats, statWorld.statGroups) : [];
  const statChoices: StatChoices[] = !traitOwner ? [{ stats }] : [
    { label: statLabel(traitOwner.name), stats: resolvedEntityStats(statWorld, traitOwner) },
    ...(globalStats.length ? [{ label: 'Global', stats: globalStats, global: true }] : []),
  ];
  const shownTab = tabs.some((t) => t.value === tab) ? tab : 'details';

  const detailsPanel = (
    <>
      {detailsHeader}
      {owner && ownerLine && (
        <div className="flex items-start gap-2 rounded-md border border-dashed p-2">
          <EntityIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
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
      <div data-tour-anchor="trait-name" className="space-y-2" {...fieldFrame('name')}>
        <Label>Name</Label>
        <PlaceholderNameField
          value={editingTrait.name || ''}
          onChange={(v) => handleChange('name', v)}
          placeholders={placeholders}
          trait={traitField}
          ariaLabel="Name"
          readOnly={readOnly}
          // Code reaches world traits only, so an owned trait's rename has nothing to rewrite.
          {...(owner || link ? {} : { onFocus: rename.onFocus, onBlur: rename.onBlur, onSubmit: rename.onSubmit })}
        />
      </div>
      <PlaceholderField
        label="Player-Facing Description"
        historyField="playerDescription"
        trait={traitField}
        value={editingTrait.playerDescription || ''}
        onChange={(v) => handleChange('playerDescription', v)}
        placeholders={placeholders}
        ownerName={traitOwner?.name}
        ownerPreview={preview}
        readOnly={readOnly}
        resizable
      />
      <PlaceholderField
        label="AI-Facing Description"
        historyField="aiDescription"
        trait={traitField}
        value={editingTrait.aiDescription || ''}
        onChange={(v) => handleChange('aiDescription', v)}
        placeholders={placeholders}
        ownerName={traitOwner?.name}
        ownerPreview={preview}
        readOnly={readOnly}
        resizable
        tourAnchor="trait-ai-description"
      />
    </>
  );

  const availabilityPanel = (
    <>
      <TraitAvailabilityRule trait={editingTrait} onChange={apply} reset={resetControl} />
      <TraitRequiresField
        trait={editingTrait}
        onChange={setRequires}
        onOpen={openRequirement}
        opens={requirementOpens}
        ownerId={link?.ownerId}
        labelAside={resetControl('requires', 'Requires')}
      />
      {availabilityFooter}
    </>
  );

  const statsPanel = (
    <>
      <div data-tour-anchor="trait-stat-changes" className="space-y-2">
        <LabelRow reset={resetControl('statChanges', 'Stat Changes')}>
          <Label>Stat Changes</Label>
          <HelpButton topicId="worldEditor.statChanges" className="h-6 w-6" />
        </LabelRow>
        {editingTrait.statChanges.map((statChange, index) => (
          <div key={index} className="flex space-x-2">
            <Select
              value={pickerValue(statChange, rowSide(statChange))}
              onValueChange={(value) => handleStatChangeUpdate(index, 'statId', value)}
            >
              <SelectTrigger {...fieldFrame('statChanges', String(index), 'statId')}>
                <SelectValue placeholder="Select stat" />
              </SelectTrigger>
              <SelectContent>
                <StatOptions choices={statChoices} label={statLabel} />
              </SelectContent>
            </Select>
            {/* A stat change has no id, and two can name one stat, so its place in the list names it. */}
            <div className="w-full" {...fieldFrame('statChanges', String(index), 'value')}>
              <WorldInput
                type="number"
                value={statChange.value}
                onChange={(e) => handleStatChangeUpdate(index, 'value', Number(e.target.value))}
              />
            </div>
            <Select
              value={statChange.type}
              onValueChange={(value) => handleStatChangeUpdate(index, 'type', value)}
            >
              <SelectTrigger {...fieldFrame('statChanges', String(index), 'type')}>
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
            <Select
              value={pickerValue(toggle, rowSide(toggle))}
              onValueChange={(v) => setStatToggles(statToggles.map((t, i) => (i === index ? pickedRow(t, v) : t)))}
              disabled={readOnly}
            >
              <SelectTrigger {...fieldFrame('statToggles', String(index), 'statId')}>
                <SelectValue placeholder="Select stat" />
              </SelectTrigger>
              <SelectContent>
                <StatOptions choices={statChoices} label={statLabel} />
              </SelectContent>
            </Select>
            <Select
              value={toggle.enabled ? 'on' : 'off'}
              onValueChange={(v) => updateStatToggle(index, { enabled: v === 'on' })}
              disabled={readOnly}
            >
              <SelectTrigger className="w-32" {...fieldFrame('statToggles', String(index), 'enabled')}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="on">Enable</SelectItem>
                <SelectItem value="off">Disable</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              disabled={readOnly}
              onClick={() => setStatToggles(statToggles.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {globalToggles.includes(toggle) && (
            <ConflictNote conflict={conflicts.stats[toggle.statId]} placeholders={placeholders} onOpen={onOpenTrait} />
          )}
          </div>
        ))}
        {!readOnly && (
          <Button size="sm" onClick={() => setStatToggles([...statToggles, { statId: '', enabled: true }])}>
            Add Stat Availability
          </Button>
        )}
      </div>
      )}
    </>
  );

  const pinsPanel = (
    <div className="space-y-2">
      <LabelRow reset={resetControl('placeholderPins', 'Placeholder Pins')}>
        <Label>Placeholder Pins</Label>
        <HelpButton topicId="worldEditor.placeholderPins" className="h-6 w-6" />
      </LabelRow>
      <PlaceholderPinRows
        pins={pins}
        onChange={setPins}
        source={{ kind: 'trait', id: editingTrait.id }}
        world={pinWorld}
        placeholders={placeholders}
        onOpenTrait={onOpenTrait}
      />
    </div>
  );

  const scriptsPanel = (
    <TraitScripts
      trait={editingTrait}
      home={scriptHome}
      offWorld={scriptOffWorld ?? undefined}
      ownerName={statLabel(editingTrait.name)}
      onChange={(scripts) => apply({ scripts })}
      reset={resetControl('scripts', 'Scripts')}
      reveal={reveal}
    />
  );

  const panels: Record<TraitPanelTab, ReactNode> = {
    details: detailsPanel, availability: availabilityPanel, stats: statsPanel, pins: pinsPanel, scripts: scriptsPanel,
  };

  return (
    <PanelTabs tabs={tabs} value={shownTab} onValueChange={onTabChange} stripLabel="Trait Fields" surfaceTabs={surfaceTabs} focus={{ kind: 'trait', id: trait.id, name: trait.name }}>
      {tabs.map((t) => (
        <PanelTabContent key={t.value} value={t.value}>{panels[t.value]}</PanelTabContent>
      ))}
    </PanelTabs>
  );
};

export default TraitManager;
