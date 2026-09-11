import { randomUUID } from "@/lib/uuid";
import { useState, useMemo, useCallback, useEffect, type ReactNode } from "react";
import { useGameData } from "@/contexts/GameDataContext";
import { useEditingDraft } from "@/lib/useEditingDraft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hint } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Code, LayoutTemplate } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PanelTabsList } from "@/components/ui/panel-tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HelpButton } from "@/components/HelpButton";
import { HintInfo } from "@/components/SettingsRows";
import { CODE_BOUND_FIELDS, executeStatCode, type CodeBoundField } from "@/lib/statCodeExecutor";
import { sandboxPlaceholders } from "@/lib/statCodePlaceholders";
import { sandboxTraits } from "@/lib/statCodeTraits";
import { StatCodeTemplateDialog } from "@/components/modals/StatCodeTemplateDialog";
import { CodeArea } from "@/components/prompt/CodeArea";
import { MultiSelect } from "@/components/ui/multi-select";
import { PlaceholderNameField } from "@/components/prompt/PlaceholderField";
import { useBodyMorphSources } from "@/lib/useBodyMorphNames";
import { boundMorphNamesExcluding, buildMorphGroups } from "@/lib/bodyMorphs";
import { clamp } from "@/lib/utils";
import { useEditorMode } from '@/lib/editorMode';
import { StatDescriptorsSection, type DescriptorFieldValue } from './StatDescriptorsSection';
import { statPanelTabsFor, statTabForField, type StatPanelTab } from '@/views/statPanelTabs';
import type { FocusFieldHint, Stat, StatDescriptor, StatType, ThresholdUnit } from "@/types";

const AVAILABILITY_INFO = `**Enabled** — the stat is active. Off keeps it inactive until a trait enables it. An inactive stat is not shown to the player or sent to the AI, and its Regen and Code do not run.

**Hidden** — the stat is not shown to the player. It is still sent to the AI, and its Regen and Code run. Use it for dice rolls, cooldowns, and other bookkeeping.`;

/** Test Code names each bound a run wrote with its Details field label. */
const BOUND_LABELS: Record<CodeBoundField, string> = { min: "Min", max: "Max", regen: "Regen" };

/** The stat being edited — a loose, partial Stat while fields are filled in. */
type EditingStat = Partial<Stat>;

/** Draft shape for an incoming stat: default a blank type/code so the editor controls stay bound. */
const normalizeStat = (stat: EditingStat): EditingStat => ({
  ...(stat ?? {}),
  type: stat?.type || "number",
  code: stat?.code || "",
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
const StatManager = ({ stat, tab, onTabChange, focusField }: {
  stat: Stat;
  tab: StatPanelTab;
  onTabChange: (tab: StatPanelTab) => void;
  focusField?: FocusFieldHint | null;
}) => {
  const { updateStat, stats, placeholders, placeholderOwners, traits } = useGameData();
  const [newDescriptor, setNewDescriptor] = useState<{ threshold: number | string; description: string }>({
    threshold: "",
    description: "",
  });
  /** What the last Test Code run wrote: the value, each bound, each placeholder, then each trait switch, as
   *  one line. Null when it wrote nothing. */
  const [codeResult, setCodeResult] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  /** The writes the last run made that did nothing: unknown names, and `acquired`. */
  const [codeWarnings, setCodeWarnings] = useState<string[]>([]);
  /** What the editor's own reader found, phrased for the test row. Null when it found nothing. */
  const [codeProblems, setCodeProblems] = useState<string | null>(null);
  const [isTestingCode, setIsTestingCode] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const writeStat = useCallback((next: EditingStat) => updateStat(next as Stat), [updateStat]);
  const { draft: editingStat, apply } = useEditingDraft<EditingStat>(stat, writeStat, normalizeStat);

  // Body sliders available to this stat: every model's morph names (grouped by model) minus those already
  // owned by another stat (each slider binds to a single stat). Loaded lazily when the picker opens.
  const { sources: morphSources, loading: morphsLoading, load: loadMorphs } = useBodyMorphSources();
  const morphGroups = useMemo(() => {
    const taken = boundMorphNamesExcluding(stats, stat.id);
    return buildMorphGroups(morphSources, taken);
  }, [morphSources, stats, stat.id]);

  // What a `stats.find(s => s.name === '…')` lookup can legitimately match, for the code field's
  // string-literal completions.
  const statNames = useMemo(
    () => stats.map(entry => entry.name).filter((name): name is string => !!name),
    [stats],
  );
  const codePlaceholders = useMemo(
    () => ({ list: placeholders, owners: placeholderOwners }),
    [placeholders, placeholderOwners],
  );
  const traitNames = useMemo(() => traits.map((trait) => trait.name), [traits]);

  /** Drop what the last test said. Editing the code makes every part of that report stale together. */
  const clearTestReport = useCallback(() => {
    setCodeResult(null);
    setCodeError(null);
    setCodeWarnings([]);
    setCodeProblems(null);
  }, []);

  const handleChange = (field: string, value: unknown) => {
    apply({ [field]: value } as EditingStat);

    // Reset code test results when code changes
    if (field === "code") {
      setCodeResult(null);
      setCodeError(null);
    }
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

  if (!editingStat) return null;

  const statType = editingStat.type?.toLowerCase();
  const isPercentage = statType === "percentage";
  // Percentage stats share every scalar affordance (descriptors, sliders, code, AI-locks) with number stats;
  // they only differ in the range fields and how the value is displayed.
  const isNumeric = statType === "number" || isPercentage;

  // A stat with no numeric value has nothing for code to calculate, so it takes no Code tab rather than an
  // empty one. The shared list stays whole: it is what the dev-router ledger is guarded against.
  const tabs = statPanelTabsFor(advanced).filter((t) => t.value !== 'code' || isNumeric);

  const details = (
    <>
      {/* The identity line: the name takes the room it needs and the type select keeps a fixed width, so
          the two read as one row until the pane is too narrow to hold them side by side. */}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <div className="space-y-2">
          <Label>Name</Label>
          <PlaceholderNameField
            value={editingStat.name || ""}
            onChange={(v) => handleChange("name", v)}
            placeholders={placeholders}
            ariaLabel="Name"
          />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
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
      <div className="space-y-2">
        <Label>Description</Label>
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
                <div>
                  <Label>Min</Label>
                  <Input type="number" value={0} readOnly disabled />
                </div>
                <div>
                  <Label>Max</Label>
                  <Input type="number" value={100} readOnly disabled />
                </div>
                <div>
                  <Label>Initial Value (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={(editingStat.value as number) || 0}
                    onChange={(e) => handleChange("value", clamp(Number(e.target.value), 0, 100))}
                  />
                </div>
                <div>
                  <Label>Regen</Label>
                  <Input
                    type="number"
                    value={editingStat.regen || 0}
                    onChange={(e) => handleChange("regen", Number(e.target.value))}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label>Min</Label>
                  <Input
                    type="number"
                    value={editingStat.min || 0}
                    onChange={(e) => handleChange("min", Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Max</Label>
                  <Input
                    type="number"
                    value={editingStat.max || 100}
                    onChange={(e) => handleChange("max", Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Initial Value</Label>
                  <Input
                    type="number"
                    value={(editingStat.value as number) || 0}
                    onChange={(e) => handleChange("value", Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Regen</Label>
                  <Input
                    type="number"
                    value={editingStat.regen || 0}
                    onChange={(e) => handleChange("regen", Number(e.target.value))}
                  />
                </div>
              </>
            )}
          </div>
          <div className="space-y-2">
            <Label>Body Sliders</Label>
            <Hint>Body sliders bound to this stat. Its value between Min and Max sets each slider&apos;s position.</Hint>
            <MultiSelect
              key={stat.id}
              options={morphGroups}
              defaultValue={editingStat.morphBindings ?? []}
              onValueChange={(v) => handleChange("morphBindings", v)}
              onOpenChange={(open) => { if (open) loadMorphs(); }}
              placeholder="Select body sliders"
              emptyIndicator={morphsLoading ? "Loading sliders…" : undefined}
              hideSelectAll
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
          <Hint>Enabled makes the stat active. Hidden hides it from the player only.</Hint>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={editingStat.enabled !== false}
                onCheckedChange={(c) => handleChange("enabled", c !== false)}
              />
              <span>Enabled</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={editingStat.hidden === true}
                onCheckedChange={(c) => handleChange("hidden", c === true)}
              />
              <span>Hidden</span>
            </label>
          </div>
        </div>
      )}
      {advanced && (
        <div className="space-y-2">
          <Label>Prevent AI Changes</Label>
          <Hint>Stop the AI from changing this stat in a given direction.</Hint>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={!!editingStat.noIncrease}
                onCheckedChange={(c) => handleChange("noIncrease", c === true)}
              />
              <span>Don&apos;t Increase</span>
            </label>

            {!isPercentage && (
              <label className="flex items-center space-x-2 cursor-pointer">
                <Checkbox
                  checked={!!editingStat.noIncreaseMax}
                  onCheckedChange={(c) => handleChange("noIncreaseMax", c === true)}
                />
                <span>Don&apos;t Increase Max</span>
              </label>
            )}

            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={!!editingStat.noDecrease}
                onCheckedChange={(c) => handleChange("noDecrease", c === true)}
              />
              <span>Don&apos;t Decrease</span>
            </label>

            {!isPercentage && (
              <label className="flex items-center space-x-2 cursor-pointer">
                <Checkbox
                  checked={!!editingStat.noDecreaseMax}
                  onCheckedChange={(c) => handleChange("noDecreaseMax", c === true)}
                />
                <span>Don&apos;t Decrease Max</span>
              </label>
            )}
          </div>
        </div>
      )}
    </>
  );

  const descriptors = (
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
  );

  const code = (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Code className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <Label>Dynamic Value Calculation</Label>
        <HelpButton topicId="worldEditor.statCode" className="h-6 w-6" />
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => setTemplatesOpen(true)}>
          <LayoutTemplate className="h-4 w-4 mr-1" />
          Templates
        </Button>
      </div>

      <Hint>Code that returns a number replaces this stat&apos;s value each turn.</Hint>

      <StatCodeTemplateDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        stats={stats}
        currentStatId={stat.id}
        hasExistingCode={!!editingStat.code?.trim()}
        onInsert={(code) => handleChange("code", code)}
      />

      <CodeArea
        value={editingStat.code || ""}
        onChange={(code) => { clearTestReport(); handleChange("code", code); }}
        ariaLabel="Stat Code"
        statNames={statNames}
        placeholders={codePlaceholders}
        traits={traitNames}
        // Its caption is the section heading, which full screen leaves behind — so the field names
        // itself in the toolbar and stays labeled in both states.
        label="Code"
        // One line rather than a worked example: the completions, the ? and Templates each teach
        // more of the sandbox than a sample could, and four lines filled the box they sat in.
        // Short enough not to wrap in the panel — Templates is a labeled button right above this.
        placeholder="// Return a number. Start typing to see what you can use."
        rows={6}
      />

      <div className="flex justify-between items-center gap-2">
        <Button
          onClick={async () => {
            setIsTestingCode(true);
            clearTestReport();

            const source = editingStat.code ?? '';
            try {
              // Only the editor's chunk holds the reader, and CodeArea fetches that chunk on
              // demand — so this stays off the world editor's own bundle.
              const { statCodeDiagnostics, summarizeProblems } = await import('@/lib/statCodeAnalysis');
              setCodeProblems(summarizeProblems(statCodeDiagnostics(source, { placeholders: codePlaceholders, traits: traitNames })));
            } catch {
              // What the run itself found is the point; the count is what the editor adds to it.
            }

            try {
              // No playthrough behind the editor: an unrolled placeholder reads as a fresh draw, and the
              // player has no traits. A switch is reported here and never applied.
              const placeholderEntries = sandboxPlaceholders({ placeholders, rolls: {} });
              const traitEntries = sandboxTraits({ acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits, groups: [] } });
              const result = await executeStatCode(source, stats, editingStat as Stat, undefined, undefined, placeholderEntries, traitEntries);
              if (result.error) {
                setCodeError(result.error);
              } else {
                const parts = [
                  ...(result.value !== null ? [`Result: ${result.value}`] : []),
                  ...CODE_BOUND_FIELDS.flatMap((field) => {
                    const bound = result.bounds?.[field];
                    return bound === undefined ? [] : [`${BOUND_LABELS[field]}: ${bound}`];
                  }),
                  ...(result.placeholders ?? []).map((write) =>
                    ('unpin' in write ? `${write.name} unpinned` : `${write.name} = ${write.text}`)),
                  ...(result.traits ?? []).map((write) => `${write.name} switched ${write.enabled ? 'on' : 'off'}`),
                ];
                if (parts.length) setCodeResult(parts.join(' · '));
                setCodeWarnings([
                  ...(result.unknownPlaceholders ? [`No placeholder has these names, so code did not change them: ${result.unknownPlaceholders.join(', ')}.`] : []),
                  ...(result.unknownTraits ? [`No trait has these names, so code did not switch them: ${result.unknownTraits.join(', ')}.`] : []),
                  ...(result.acquiredWrites ? [`Code can’t change acquired, so these writes did nothing: ${result.acquiredWrites.join(', ')}.`] : []),
                ]);
              }
            } catch (error) {
              setCodeError((error as Error).message);
            } finally {
              setIsTestingCode(false);
            }
          }}
          disabled={isTestingCode || !editingStat.code}
          variant="outline"
        >
          {isTestingCode ? "Testing..." : "Test Code"}
        </Button>

        <div className="min-w-0 text-right">
          {codeResult !== null && <div className="text-success">{codeResult}</div>}
          {codeError && <div className="text-destructive text-label">Error: {codeError}</div>}
          {codeWarnings.map((warning) => <div key={warning} className="text-warning text-label">{warning}</div>)}
          {/* Always beside what the run reported, never instead of it: a run says what the code did
              this once, which is silent about a typo on a branch it didn't take. */}
          {codeProblems && <div className="text-warning text-label">{codeProblems}</div>}
        </div>
      </div>
    </div>
  );

  const panels: Record<StatPanelTab, ReactNode> = { details, descriptors, code };

  // One tab left is no choice to offer, so Simple renders the Details body bare with no strip above it.
  if (tabs.length === 1) return <div className="space-y-4">{panels[tabs[0].value]}</div>;

  return (
    <Tabs value={tab} onValueChange={(v) => onTabChange(v as StatPanelTab)} className="space-y-4">
      <PanelTabsList tabs={tabs} stripLabel="Stat Fields" />
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="space-y-4">{panels[t.value]}</TabsContent>
      ))}
    </Tabs>
  );
};

export default StatManager;
