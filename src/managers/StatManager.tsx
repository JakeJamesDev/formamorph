import { randomUUID } from "@/lib/uuid";
import { useState, useMemo, useCallback } from "react";
import { useGameData } from "@/contexts/GameDataContext";
import { useEditingDraft } from "@/lib/useEditingDraft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Code, LayoutTemplate } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HelpButton } from "@/components/HelpButton";
import { executeStatCode } from "@/lib/statCodeExecutor";
import { StatCodeTemplateDialog } from "@/components/modals/StatCodeTemplateDialog";
import { CodeArea } from "@/components/prompt/CodeArea";
import { MultiSelect } from "@/components/ui/multi-select";
import { PlaceholderNameField } from "@/components/prompt/PlaceholderField";
import { useBodyMorphSources } from "@/lib/useBodyMorphNames";
import { boundMorphNamesExcluding, buildMorphGroups } from "@/lib/bodyMorphs";
import { clamp } from "@/lib/utils";
import { useEditorMode } from '@/lib/editorMode';
import { StatDescriptorsSection } from './StatDescriptorsSection';
import type { Stat, StatDescriptor, StatType, ThresholdUnit } from "@/types";

/** The stat being edited — a loose, partial Stat while fields are filled in. */
type EditingStat = Partial<Stat>;

/** Draft shape for an incoming stat: default a blank type/code so the editor controls stay bound. */
const normalizeStat = (stat: EditingStat): EditingStat => ({
  ...(stat ?? {}),
  type: stat?.type || "number",
  code: stat?.code || "",
});

const StatManager = ({ stat }: { stat: Stat }) => {
  const { updateStat, stats, placeholders } = useGameData();
  const [newDescriptor, setNewDescriptor] = useState<{ threshold: number | string; description: string }>({
    threshold: "",
    description: "",
  });
  const [codeResult, setCodeResult] = useState<number | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
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

  /** Drop what the last test said. Editing the code makes every part of that report stale together. */
  const clearTestReport = useCallback(() => {
    setCodeResult(null);
    setCodeError(null);
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

  const handleDescriptorChange = (index: number, field: string, value: string | number) => {
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

  if (!editingStat) return null;

  const statType = editingStat.type?.toLowerCase();
  const isPercentage = statType === "percentage";
  // Percentage stats share every scalar affordance (descriptors, sliders, code, AI-locks) with number stats;
  // they only differ in the range fields and how the value is displayed.
  const isNumeric = statType === "number" || isPercentage;

  return (
    <div className="space-y-4">
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
      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={editingStat.description || ""}
          onChange={(e) => handleChange("description", e.target.value)}
        />
      </div>
      {advanced && (
      <div className="space-y-2">
        <Label>Availability</Label>
        <label className="flex items-center space-x-2 cursor-pointer">
          <Checkbox
            checked={editingStat.enabled !== false}
            onCheckedChange={(c) => handleChange("enabled", c !== false)}
          />
          <span>Enabled</span>
        </label>
        <p className="text-helper text-muted-foreground">
          Turn this off to keep the stat inert until a trait switches it on. A disabled stat is invisible
          to the player and the AI, and its regen and code pause.
        </p>
        <label className="flex items-center space-x-2 cursor-pointer">
          <Checkbox
            checked={editingStat.hidden === true}
            onCheckedChange={(c) => handleChange("hidden", c === true)}
          />
          <span>Hidden</span>
        </label>
        <p className="text-helper text-muted-foreground">
          A hidden stat never shows to the player, but the AI still reads it and its regen and code keep
          running — for dice rolls, cooldowns, and other bookkeeping.
        </p>
      </div>
      )}
      {isNumeric && (
        <div className="flex flex-col gap-4">
          {isPercentage ? (
            <div className="grid grid-cols-2 gap-2">
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
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
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
            </div>
          )}
          <div>
            <Label>Body Sliders</Label>
            <p className="py-2 text-helper text-muted-foreground">
              Bind body morph sliders to this stat — its value (min→max) drives each slider.
            </p>
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
          {advanced && (
          <div className="space-y-2">
            <Label>Prevent AI Changes</Label>
            <p className="text-helper text-muted-foreground">Stop the AI from changing this stat in a given direction.</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <Checkbox
                  checked={!!editingStat.noIncrease}
                  onCheckedChange={(c) => handleChange("noIncrease", c === true)}
                />
                <span>Don&apos;t increase</span>
              </label>

              {!isPercentage && (
                <label className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={!!editingStat.noIncreaseMax}
                    onCheckedChange={(c) => handleChange("noIncreaseMax", c === true)}
                  />
                  <span>Don&apos;t increase max</span>
                </label>
              )}

              <label className="flex items-center space-x-2 cursor-pointer">
                <Checkbox
                  checked={!!editingStat.noDecrease}
                  onCheckedChange={(c) => handleChange("noDecrease", c === true)}
                />
                <span>Don&apos;t decrease</span>
              </label>

              {!isPercentage && (
                <label className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={!!editingStat.noDecreaseMax}
                    onCheckedChange={(c) => handleChange("noDecreaseMax", c === true)}
                  />
                  <span>Don&apos;t decrease Max</span>
                </label>
              )}
            </div>
          </div>
          )}
        </div>
      )}

      {advanced && (
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
      )}

      {/* Code Section — a plain section like its siblings; the `?` carries what it needs explaining. */}
      {isNumeric && advanced && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <Label>Dynamic Value Calculation (Optional)</Label>
            <HelpButton topicId="worldEditor.statCode" className="h-6 w-6" />
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setTemplatesOpen(true)}>
              <LayoutTemplate className="h-4 w-4 mr-1" />
              Templates
            </Button>
          </div>

          <p className="text-helper text-muted-foreground">
            Code that returns a number replaces this stat&apos;s value each turn.
          </p>

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
            ariaLabel="Stat code"
            statNames={statNames}
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

                const code = editingStat.code ?? '';
                try {
                  // Only the editor's chunk holds the reader, and CodeArea fetches that chunk on
                  // demand — so this stays off the world editor's own bundle.
                  const { statCodeDiagnostics, summarizeProblems } = await import('@/lib/statCodeAnalysis');
                  setCodeProblems(summarizeProblems(statCodeDiagnostics(code)));
                } catch {
                  // What the run itself found is the point; the count is what the editor adds to it.
                }

                try {
                  const result = await executeStatCode(code, stats, editingStat as Stat);
                  if (result.error) {
                    setCodeError(result.error);
                  } else if (result.value !== null) {
                    setCodeResult(result.value);
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
              {codeResult !== null && <div className="text-success">Result: {codeResult}</div>}
              {codeError && <div className="text-destructive text-label">Error: {codeError}</div>}
              {/* Always beside what the run reported, never instead of it: a run says what the code did
                  this once, which is silent about a typo on a branch it didn't take. */}
              {codeProblems && <div className="text-warning text-label">{codeProblems}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatManager;
