import { randomUUID } from "@/lib/uuid";
import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useGameDataOptional } from "@/contexts/GameDataContext";
import { useStatEditorWorld } from "@/lib/useStatEditorWorld";
import { useEditingDraft } from "@/lib/useEditingDraft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hint } from "@/components/ui/typography";
import { Checkbox } from "@/components/ui/checkbox";
import { PanelTabContent, PanelTabs } from "@/components/ui/panel-tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HelpButton } from "@/components/HelpButton";
import { HintInfo } from "@/components/SettingsRows";
import { statCodeName } from "@/lib/statCodeNames";
import { useRenameField } from "@/lib/useCodeRename";
import { ScriptsSection } from "./ScriptsSection";
import { useScriptBoxContext } from "./useScriptBoxContext";
import { newScript, noFocus, scriptRow } from "@/lib/scriptRows";
import { statPanelHome, type ScriptBoxWorld } from "@/lib/scriptBoxHome";
import { MultiSelect } from "@/components/ui/multi-select";
import { PlaceholderNameField } from "@/components/prompt/PlaceholderField";
import { useBodyMorphSources, useOwnerMorphSources, type MorphOwner } from "@/lib/useBodyMorphNames";
import { boundMorphNamesExcluding, buildMorphGroups } from "@/lib/bodyMorphs";
import { clamp } from "@/lib/utils";
import { useEditorMode } from '@/lib/editorMode';
import { StatDescriptorsSection, type DescriptorFieldValue } from './StatDescriptorsSection';
import { statPanelTabsFor, statTabForField, type StatPanelTab } from '@/views/statPanelTabs';
import { registerScriptInsert, reportScriptInsert } from "@/lib/formaquestion/scriptInsert";
import { labelPlaceholders } from "@/lib/placementLetters";
import { targetAttribute } from "@/lib/surface/surfaceTargets";
import { useLanding } from "@/lib/surface/useLanding";
import { useCodeUseReveal } from "@/lib/codeUseReveal";
import type { FocusFieldHint, RegenUnit, ScriptTiming, Stat, StatDescriptor, StatLinkFields, StatType, ThresholdUnit } from "@/types";
import { REGEN_UNIT_LABELS, REGEN_UNITS, regenPer, regenPerHour, regenUnitOf } from "@/lib/regenUnits";
import { FieldReset, LabelRow } from '@/components/editor/BlueprintReset';
import { WorldInput } from '@/components/editor/WorldField';
import { fieldFrame } from '@/lib/historyField';

export const AVAILABILITY_INFO = `**Enabled** keeps the stat active. Uncheck it and the stat stays inactive until a trait enables it. An inactive stat isn't shown to the player or sent to the AI, and its Regen and Code don't run.

**Hidden** hides the stat from the player. It's still sent to the AI, and its Regen and Code run. Use it for dice rolls, cooldowns, and other bookkeeping.`;

/** What the stat editor reads and writes besides the world: the stats beside the open one, and its write. */
export interface StatEditorStore {
  stats: Stat[];
  updateStat: (stat: Stat) => void;
  /** The id of the entity that owns these stats: `owner` in their code. */
  ownerId: string;
  /** The owner whose model the Body Sliders picker lists. Absent = the world's player models. */
  morphOwner?: MorphOwner;
  /** What the script boxes read with no world loaded, as in the library: the entity and its links' stats. */
  offWorld?: ScriptBoxWorld;
}

/** A link's edit of the stat it brings: which fields it overrides, which of those the Blueprint changed since,
 *  and the field Reset. The name stays the Blueprint's. `header` sits above the fields. */
export interface StatLinkEdit {
  linkId: string;
  /** The stat the link brings, whose id its scripts run under. */
  originalId: string;
  overridden: readonly (keyof StatLinkFields)[];
  stale: readonly (keyof StatLinkFields)[];
  reset: (field: keyof StatLinkFields) => void;
  header: ReactNode;
}

/** The stat being edited — a loose, partial Stat while fields are filled in. */
type EditingStat = Partial<Stat>;

/** Draft shape for an incoming stat: default a blank type so the editor controls stay bound. */
const normalizeStat = (stat: EditingStat): EditingStat => ({
  ...(stat ?? {}),
  type: stat?.type || "number",
});

/**
 * Right-panel editor for one stat: its fields split across Details, Descriptors and Code.
 *
 * The panel remounts per stat, so the chosen tab is the editor's to hold and arrives as a prop. Simple mode
 * leaves Details alone, and a single tab is no choice, so the strip goes away and that body renders bare.
 *
 * `focusField` is the search target the find bar just navigated to. A hit on a tab that isn't showing has no
 * field to mark, so the panel opens the owning tab; the same hint the entity and location panels take.
 */
const StatManager = ({ stat, tab, onTabChange, focusField, store, link }: {
  stat: Stat;
  tab: StatPanelTab;
  onTabChange: (tab: StatPanelTab) => void;
  focusField?: FocusFieldHint | null;
  /** The stats this one sits among and where its writes go: an entity's own. Absent = the world's. */
  store?: StatEditorStore;
  /** Edits the stat as an entity's link reads it: writes go to the link's overrides. */
  link?: StatLinkEdit;
}) => {
  const { placeholders, placeholderOwners, placementLetters } = useStatEditorWorld();
  // A store carries an owner's own stats; only a world stat reads the world, which an owned stat's editor may not have.
  const world = useGameDataOptional();
  if (!store && !world) throw new Error('StatManager needs a store or a world');
  // A global stat's code reads the global stats; a Blueprint's own code reads the world list it sits in.
  const stats = store?.stats ?? (world!.playStats.some((s) => s.id === stat.id) ? world!.playStats : world!.stats);
  const updateStat = store?.updateStat ?? world!.updateStat;
  const [newDescriptor, setNewDescriptor] = useState<{ threshold: number | string; description: string }>({
    threshold: "",
    description: "",
  });
  const writeStat = useCallback((next: EditingStat) => updateStat(next as Stat), [updateStat]);
  const { draft: editingStat, apply } = useEditingDraft<EditingStat>(stat, writeStat, normalizeStat);

  // Body sliders available to this stat: the owner's model's shape keys, or for a world stat every model's
  // (grouped by model), minus those already owned by another stat (each slider binds to a single stat).
  // Loaded lazily when the picker opens.
  const worldMorphs = useBodyMorphSources();
  const ownerMorphs = useOwnerMorphSources(store?.morphOwner);
  const { sources: morphSources, loading: morphsLoading, load: loadMorphs } = store?.morphOwner ? ownerMorphs : worldMorphs;
  // The owner's model offers nothing to bind; a binding already on the stat stays removable.
  let ownerMorphsEmpty: string | undefined;
  if (store?.morphOwner && !morphSources.length) {
    ownerMorphsEmpty = store.morphOwner.model?.data
      ? "This entity's 3D model has no body sliders"
      : "This entity has no 3D model. Add one to bind its body sliders.";
  }
  const morphGroups = useMemo(() => {
    const taken = boundMorphNamesExcluding(stats, stat.id);
    return buildMorphGroups(morphSources, taken);
  }, [morphSources, stats, stat.id]);

  // Code reaches a stat by its code name, so the rename offer compares the two names the way code reads them.
  const nameRename = useRenameField({
    root: 'stats',
    value: editingStat.name ?? '',
    siblings: stats,
    ownId: stat.id,
    codeNameOf: (name) => statCodeName(name, placeholders),
    stat: { id: stat.id, entityId: store?.ownerId },
  });
  // A link's name stays the Blueprint's, so its field never renames.
  const rename = link ? undefined : nameRename;
  // A linked stat's scripts run as the stat it brings, under the original id.
  const ownerId = store?.ownerId;
  const linkId = link?.linkId;
  const originalId = link?.originalId;
  const scriptHome = useMemo(
    () => statPanelHome(stat.id, ownerId, linkId && originalId ? { linkId, originalId } : undefined),
    [ownerId, linkId, originalId, stat.id],
  );
  const codeContext = useScriptBoxContext(scriptHome, store?.offWorld);

  const resetControl = (field: keyof StatLinkFields, label: string) => (link?.overridden.includes(field)
    ? <FieldReset field={label} stale={link.stale.includes(field)} onReset={() => link.reset(field)} />
    : undefined);
  /** A field's label, ending in its Reset while a link overrides it. */
  const fieldLabel = (field: keyof StatLinkFields, label: string) => {
    const reset = resetControl(field, label);
    return reset ? <LabelRow reset={reset}><Label>{label}</Label></LabelRow> : <Label>{label}</Label>;
  };

  const handleChange = (field: string, value: unknown) => {
    apply({ [field]: value } as EditingStat);
  };

  const handleTypeChange = (value: StatType) => {
    const raw = typeof editingStat.value === "number" ? editingStat.value : 0;
    // Percentage stats are pinned to 0–100: clamp the value and force the bounds so display and math agree.
    if (value === "percentage") {
      apply({ type: value, value: clamp(raw, 0, 100), min: 0, max: 100 });
      return;
    }
    apply({ type: value, value: raw });
  };

  // Ascending by threshold; stable so equal thresholds keep authored order. Band lookup expects this order.
  const sortDescriptors = (descriptors: StatDescriptor[]) =>
    [...descriptors].sort((a, b) => Number(a.threshold) - Number(b.threshold));

  const handleDescriptorChange = (index: number, field: string, value: DescriptorFieldValue) => {
    const updatedDescriptors = [...(editingStat.descriptors || [])];
    updatedDescriptors[index] = {
      ...updatedDescriptors[index],
      [field]: value,
    } as StatDescriptor;
    handleChange("descriptors", updatedDescriptors);
  };

  // Re-sort on blur, not on each keystroke, so a row doesn't jump out from under the cursor mid-type.
  const handleDescriptorBlur = () => {
    handleChange("descriptors", sortDescriptors(editingStat.descriptors || []));
  };

  const handleAddDescriptor = () => {
    if (newDescriptor.threshold !== "" && newDescriptor.description) {
      const updatedDescriptors = sortDescriptors([
        ...(editingStat.descriptors || []),
        { ...newDescriptor, threshold: Number(newDescriptor.threshold), id: randomUUID() },
      ]);
      handleChange("descriptors", updatedDescriptors);
      setNewDescriptor({ threshold: "", description: "" });
    }
  };

  // One write: a second `apply` would merge into the draft this one was built from and undo it.
  const handleUnitChange = (thresholdUnit: ThresholdUnit, descriptors: StatDescriptor[]) => {
    apply({ thresholdUnit, descriptors });
  };

  const handleRemoveDescriptor = (descriptorId: string | number) => {
    const updatedDescriptors = (editingStat.descriptors || []).filter(
      (desc) => desc.id !== descriptorId,
    );
    handleChange("descriptors", updatedDescriptors);
  };

  const { advanced } = useEditorMode();

  // Before the reveal, which is a timer behind this render: the field it looks for has to be mounting by
  // then. A key no tab claims leaves the panel where the author put it.
  useEffect(() => {
    const owning = focusField ? statTabForField(focusField.fieldKey) : null;
    if (owning) onTabChange(owning);
  }, [focusField, onTabChange]);

  // A Find All Uses row bound for one of this stat's scripts shows it on the Scripts tab.
  const reveal = useCodeUseReveal(stat.id, store?.ownerId ?? null);
  useEffect(() => {
    if (reveal) onTabChange('code');
  }, [reveal, onTabChange]);

  // The help window's Insert adds a script of its timing, then shows it on the Scripts tab. It overwrites nothing.
  const landOnScript = useLanding(scriptRow, { focus: noFocus });
  const [inserted, setInserted] = useState<string | null>(null);
  // Read at insert time, so the registration does not change with each keystroke.
  const latestStat = useRef(editingStat);
  latestStat.current = editingStat;
  const writeInsert = useCallback((timing: ScriptTiming, code: string) => {
    const script = newScript(timing, code);
    apply({ scripts: [...latestStat.current.scripts ?? [], script] });
    onTabChange('code');
    setInserted(script.id);
    landOnScript(script.id);
  }, [apply, onTabChange, landOnScript]);
  const statName = labelPlaceholders(editingStat.name ?? '', placeholders, { letters: placementLetters, owners: placeholderOwners });
  // Simple mode has no Scripts tab to show the script on.
  useEffect(() => {
    if (!advanced) return;
    return registerScriptInsert({
      homeName: statName,
      insert: (timing, code) => {
        writeInsert(timing, code);
        reportScriptInsert('written');
      },
    });
  }, [advanced, statName, writeInsert]);

  if (!editingStat) return null;

  const statType = editingStat.type?.toLowerCase();
  const isPercentage = statType === "percentage";
  // Percentage stats share every scalar affordance (descriptors, sliders, code, AI-locks) with number stats;
  // they only differ in the range fields and how the value is displayed.
  const isNumeric = statType === "number" || isPercentage;

  // A stat with no numeric value has nothing for code to calculate, so it takes no Code tab rather than an
  // empty one. The shared list stays whole: it is what the dev-router ledger is guarded against.
  const tabs = statPanelTabsFor(advanced).filter((t) => t.value !== 'code' || isNumeric);

  // `regen` stays per hour; the unit only sets the span the number reads in. Picking a unit keeps the number
  // shown, so typing 2 then picking Day means 2 per day.
  const regenUnit = regenUnitOf(editingStat);
  const regenShown = regenPer(editingStat.regen || 0, regenUnit);
  const regenLinkFields = (['regen', 'regenUnit'] as const).filter((f) => link?.overridden.includes(f));
  const regenReset = link && regenLinkFields.length > 0
    ? <FieldReset field="Regen" stale={regenLinkFields.some((f) => link.stale.includes(f))} onReset={() => link.reset('regen')} />
    : undefined;
  const regenField = (
    <div {...fieldFrame('regen')}>
      {regenReset ? <LabelRow reset={regenReset}><Label>Regen</Label></LabelRow> : <Label>Regen</Label>}
      <div className="flex items-center gap-1.5">
        <WorldInput
          type="number"
          className="min-w-0 flex-1"
          aria-label="Regen"
          value={regenShown}
          onChange={(e) => handleChange("regen", regenPerHour(Number(e.target.value), regenUnit))}
        />
        <span className="shrink-0 text-meta text-muted-foreground" aria-hidden="true">per</span>
        <Select
          value={regenUnit}
          onValueChange={(unit: RegenUnit) => apply({ regenUnit: unit, regen: regenPerHour(regenShown, unit) })}
        >
          <SelectTrigger className="w-auto shrink-0 gap-1 px-2" aria-label="Regen Unit">
            {/* Every label stacks invisibly under the value, so the trigger holds the widest one's width.
                `!grid` beats the trigger's `[&>span]:line-clamp-1`, which would lay the labels side by side. */}
            <span className="!grid text-left">
              {REGEN_UNITS.map((unit) => (
                <span key={unit} aria-hidden className="invisible col-start-1 row-start-1">{REGEN_UNIT_LABELS[unit]}</span>
              ))}
              <span className="col-start-1 row-start-1"><SelectValue /></span>
            </span>
          </SelectTrigger>
          <SelectContent>
            {REGEN_UNITS.map((unit) => (
              <SelectItem key={unit} value={unit}>{REGEN_UNIT_LABELS[unit]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const details = (
    <>
      {/* The identity line: the name takes the room it needs and the type select keeps a fixed width, so
          the two read as one row until the pane is too narrow to hold them side by side. */}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <div data-tour-anchor="stat-name" className="space-y-2" {...fieldFrame('name')}>
          <Label>Name</Label>
          <PlaceholderNameField
            value={editingStat.name || ""}
            onChange={(v) => handleChange("name", v)}
            placeholders={placeholders}
            ariaLabel="Name"
            readOnly={!!link}
            onFocus={rename?.onFocus}
            onBlur={rename?.onBlur}
            onSubmit={rename?.onSubmit}
          />
        </div>
        <div className="space-y-2" {...fieldFrame('type')}>
          {fieldLabel('type', 'Type')}
          <Select
            value={editingStat.type || "number"}
            onValueChange={handleTypeChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select stat type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="percentage">Percentage</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div data-tour-anchor="stat-description" className="space-y-2" {...fieldFrame('description')}>
        {fieldLabel('description', 'Description')}
        <PlaceholderNameField
          value={editingStat.description || ""}
          onChange={(v) => handleChange("description", v)}
          placeholders={placeholders}
          ariaLabel="Description"
        />
      </div>
      {isNumeric && (
        <div className="flex flex-col gap-4">
          {/* The stat's range as one line of numbers; two columns where the pane is too narrow for four. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {isPercentage ? (
              <>
                <div {...fieldFrame('value')}>
                  {fieldLabel('value', 'Base Value (%)')}
                  <WorldInput
                    type="number"
                    min={0}
                    max={100}
                    value={(editingStat.value as number) || 0}
                    onChange={(e) => handleChange("value", clamp(Number(e.target.value), 0, 100))}
                  />
                </div>
                <div>
                  <Label>Min</Label>
                  <Input type="number" value={0} readOnly disabled />
                </div>
                <div>
                  <Label>Max</Label>
                  <Input type="number" value={100} readOnly disabled />
                </div>
                {regenField}
              </>
            ) : (
              <>
                <div {...fieldFrame('value')}>
                  {fieldLabel('value', 'Base Value')}
                  <WorldInput
                    type="number"
                    value={(editingStat.value as number) || 0}
                    onChange={(e) => handleChange("value", Number(e.target.value))}
                  />
                </div>
                <div {...fieldFrame('min')}>
                  {fieldLabel('min', 'Min')}
                  <WorldInput
                    type="number"
                    value={editingStat.min || 0}
                    onChange={(e) => handleChange("min", Number(e.target.value))}
                  />
                </div>
                <div {...fieldFrame('max')}>
                  {fieldLabel('max', 'Max')}
                  <WorldInput
                    type="number"
                    value={editingStat.max || 100}
                    onChange={(e) => handleChange("max", Number(e.target.value))}
                  />
                </div>
                {regenField}
              </>
            )}
          </div>
          <div className="space-y-2" {...fieldFrame('morphBindings')}>
            {fieldLabel('morphBindings', 'Body Sliders')}
            <Hint>Binds body sliders to this stat. Its value between Min and Max sets each slider&apos;s position.</Hint>
            <MultiSelect
              key={stat.id}
              options={morphGroups}
              defaultValue={editingStat.morphBindings ?? []}
              onValueChange={(v) => handleChange("morphBindings", v)}
              onOpenChange={(open) => { if (open) loadMorphs(); }}
              placeholder="Select body sliders"
              emptyIndicator={morphsLoading ? "Loading sliders…" : ownerMorphsEmpty}
              maxCount={6}
            />
          </div>
        </div>
      )}
      {advanced && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>Availability</Label>
            <HintInfo>{AVAILABILITY_INFO}</HintInfo>
          </div>
          {/* The line decides; the ⓘ defines. Two paragraphs here cost the panel a screen. */}
          <Hint>Enabled keeps the stat active. Hidden hides it from the player only.</Hint>
          <div className="grid grid-cols-2 gap-2">
            <LabelRow reset={resetControl('enabled', "Enabled")}>
              <label className="flex items-center space-x-2 cursor-pointer" {...fieldFrame('enabled')}>
                <Checkbox
                  checked={editingStat.enabled !== false}
                  onCheckedChange={(c) => handleChange("enabled", c !== false)}
                />
                <span>Enabled</span>
              </label>
            </LabelRow>
            <LabelRow reset={resetControl('hidden', "Hidden")}>
              <label className="flex items-center space-x-2 cursor-pointer" {...fieldFrame('hidden')}>
                <Checkbox
                  checked={editingStat.hidden === true}
                  onCheckedChange={(c) => handleChange("hidden", c === true)}
                />
                <span>Hidden</span>
              </label>
            </LabelRow>
          </div>
        </div>
      )}
      {advanced && (
        <div className="space-y-2">
          <Label>Prevent AI Changes</Label>
          <Hint>Stops the AI from changing this stat in one direction</Hint>
          <div className="grid grid-cols-2 gap-2">
            <LabelRow reset={resetControl('noIncrease', "Don't Increase")}>
              <label className="flex items-center space-x-2 cursor-pointer" {...fieldFrame('noIncrease')}>
                <Checkbox
                  checked={!!editingStat.noIncrease}
                  onCheckedChange={(c) => handleChange("noIncrease", c === true)}
                />
                <span>Don&apos;t Increase</span>
              </label>
            </LabelRow>

            {!isPercentage && (
              <LabelRow reset={resetControl('noIncreaseMax', "Don't Increase Max")}>
                <label className="flex items-center space-x-2 cursor-pointer" {...fieldFrame('noIncreaseMax')}>
                  <Checkbox
                    checked={!!editingStat.noIncreaseMax}
                    onCheckedChange={(c) => handleChange("noIncreaseMax", c === true)}
                  />
                  <span>Don&apos;t Increase Max</span>
                </label>
              </LabelRow>
            )}

            <LabelRow reset={resetControl('noDecrease', "Don't Decrease")}>
              <label className="flex items-center space-x-2 cursor-pointer" {...fieldFrame('noDecrease')}>
                <Checkbox
                  checked={!!editingStat.noDecrease}
                  onCheckedChange={(c) => handleChange("noDecrease", c === true)}
                />
                <span>Don&apos;t Decrease</span>
              </label>
            </LabelRow>

            {!isPercentage && (
              <LabelRow reset={resetControl('noDecreaseMax', "Don't Decrease Max")}>
                <label className="flex items-center space-x-2 cursor-pointer" {...fieldFrame('noDecreaseMax')}>
                  <Checkbox
                    checked={!!editingStat.noDecreaseMax}
                    onCheckedChange={(c) => handleChange("noDecreaseMax", c === true)}
                  />
                  <span>Don&apos;t Decrease Max</span>
                </label>
              </LabelRow>
            )}
          </div>
        </div>
      )}
    </>
  );

  /** The Resets for fields a tab holds without a label row of their own. */
  const tabResets = (fields: [keyof StatLinkFields, string][]) => {
    const shown = fields.filter(([field]) => link?.overridden.includes(field));
    return shown.length > 0 && (
      <div className="space-y-1">
        {shown.map(([field, label]) => (
          <LabelRow key={field} reset={resetControl(field, label)}><Label>{label}</Label></LabelRow>
        ))}
      </div>
    );
  };

  const descriptors = (
    <>
    {tabResets([['descriptors', 'Descriptors'], ['thresholdUnit', 'Threshold Unit']])}
    <StatDescriptorsSection
      stat={editingStat}
      newDescriptor={newDescriptor}
      setNewDescriptor={setNewDescriptor}
      onDescriptorChange={handleDescriptorChange}
      onDescriptorBlur={handleDescriptorBlur}
      onAddDescriptor={handleAddDescriptor}
      onRemoveDescriptor={handleRemoveDescriptor}
      onUnitChange={handleUnitChange}
    />
    </>
  );

  const code = (
    <div className="space-y-4">
      <div className="space-y-2">
        <LabelRow reset={resetControl('scripts', 'Scripts')}>
          <div className="flex items-center gap-2">
            <Label>Scripts</Label>
            <HelpButton topicId="worldEditor.scriptBox" className="h-6 w-6" />
          </div>
        </LabelRow>
        <Hint>Runs code at the timing you select. Code can set this stat&apos;s value, Min, Max, or Regen, pin a placeholder, or switch a trait.</Hint>
        <Hint>Turn order: Before the AI, AI stat changes, Regen, After the AI. An empty script is skipped.</Hint>
      </div>
      <ScriptsSection
        scripts={editingStat.scripts ?? []}
        onChange={(scripts) => apply({ scripts })}
        ownerName={statName}
        context={codeContext}
        reveal={reveal}
        addTarget={targetAttribute('worldEditorStat.code', 'add-script')}
        focusId={inserted}
      />
    </div>
  );

  const panels: Record<StatPanelTab, ReactNode> = { details, descriptors, code };
  const header = link?.header;


  return (
    <>
      {header && <div className="mb-4">{header}</div>}
      <PanelTabs tabs={tabs} value={tab} onValueChange={onTabChange} stripLabel="Stat Fields" surfaceTabs="worldEditorStat" focus={{ kind: 'stat', id: stat.id, name: stat.name }}>
        {tabs.map((t) => (
          <PanelTabContent key={t.value} value={t.value}>{panels[t.value]}</PanelTabContent>
        ))}
      </PanelTabs>
    </>
  );
};

export default StatManager;
