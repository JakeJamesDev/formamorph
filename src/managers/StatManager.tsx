import { randomUUID } from "@/lib/uuid";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useGameData } from "@/contexts/GameDataContext";
import { useEditingDraft } from "@/lib/useEditingDraft";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Code } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { executeStatCode } from "@/lib/statCodeExecutor";
import { MultiSelect } from "@/components/ui/multi-select";
import { useBodyMorphSources } from "@/lib/useBodyMorphNames";
import { boundMorphNamesExcluding, buildMorphGroups } from "@/lib/bodyMorphs";
import { clamp } from "@/lib/utils";
import type { Stat, StatDescriptor, StatListItem, StatType } from "@/types";

/** The stat being edited — a loose, partial Stat while fields are filled in. */
type EditingStat = Partial<Stat>;

/** Draft shape for an incoming stat: default a blank type/code so the editor controls stay bound. */
const normalizeStat = (stat: EditingStat): EditingStat => ({
  ...(stat ?? {}),
  type: stat?.type || "number",
  code: stat?.code || "",
});

const StatManager = ({ stat }: { stat: Stat }) => {
  const { updateStat, stats } = useGameData();
  const [newDescriptor, setNewDescriptor] = useState<{ threshold: number | string; description: string }>({
    threshold: "",
    description: "",
  });
  const [newListItem, setNewListItem] = useState<{ name: string; description: string; number: number }>({
    name: "",
    description: "",
    number: 0,
  });
  const [codeOpen, setCodeOpen] = useState(stat?.code ? true : false);
  const [codeResult, setCodeResult] = useState<number | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isTestingCode, setIsTestingCode] = useState(false);

  const writeStat = useCallback((next: EditingStat) => updateStat(next as Stat), [updateStat]);
  const { draft: editingStat, apply } = useEditingDraft<EditingStat>(stat, writeStat, normalizeStat);

  // Body sliders available to this stat: every model's morph names (grouped by model) minus those already
  // owned by another stat (each slider binds to a single stat). Loaded lazily when the picker opens.
  const { sources: morphSources, loading: morphsLoading, load: loadMorphs } = useBodyMorphSources();
  const morphGroups = useMemo(() => {
    const taken = boundMorphNamesExcluding(stats, stat.id);
    return buildMorphGroups(morphSources, taken);
  }, [morphSources, stats, stat.id]);

  // Open the code section by default when the selected stat carries code (the draft sync itself is
  // handled by useEditingDraft).
  useEffect(() => {
    if (stat?.code && stat.code.trim() !== "") setCodeOpen(true);
  }, [stat]);

  const handleChange = (field: string, value: unknown) => {
    apply({ [field]: value } as EditingStat);

    // Reset code test results when code changes
    if (field === "code") {
      setCodeResult(null);
      setCodeError(null);
    }
  };

  const handleTypeChange = (value: StatType) => {
    if (value === "list") {
      apply({ type: value, value: editingStat.value || [] });
      return;
    }
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

  const handleRemoveDescriptor = (descriptorId: string | number) => {
    const updatedDescriptors = (editingStat.descriptors || []).filter(
      (desc) => desc.id !== descriptorId,
    );
    handleChange("descriptors", updatedDescriptors);
  };

  const handleAddListItem = () => {
    if (newListItem.name && editingStat.type === "list") {
      const updatedValue = [
        ...((editingStat.value as StatListItem[]) || []),
        { ...newListItem, id: randomUUID() },
      ];
      handleChange("value", updatedValue);
      setNewListItem({ name: "", description: "", number: 0 });
    }
  };

  const handleRemoveListItem = (itemId: string | number) => {
    if (editingStat.type === "list") {
      const updatedValue = (editingStat.value as StatListItem[]).filter(
        (item) => item.id !== itemId,
      );
      handleChange("value", updatedValue);
    }
  };

  const handleListItemChange = (itemId: string | number, field: string, value: string | number) => {
    if (editingStat.type === "list") {
      const updatedValue = (editingStat.value as StatListItem[]).map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item,
      );
      handleChange("value", updatedValue);
    }
  };

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
        <Input
          value={editingStat.name || ""}
          onChange={(e) => handleChange("name", e.target.value)}
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
            {/* <SelectItem value="list">List</SelectItem> */}
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
      <div className="space-y-2">
        <Label>Availability</Label>
        <label className="flex items-center space-x-2 cursor-pointer">
          <Checkbox
            checked={editingStat.enabled !== false}
            onCheckedChange={(c) => handleChange("enabled", c !== false)}
          />
          <span>Enabled</span>
        </label>
        <p className="text-sm text-muted-foreground">
          Turn this off to keep the stat hidden until a trait switches it on. A disabled stat is invisible
          to the player and the AI, and its regen and code pause.
        </p>
      </div>
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
            <p className="py-2 text-sm text-muted-foreground">
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
          <div className="space-y-2">
            <Label>Prevent AI Changes</Label>
            <p className="text-sm text-muted-foreground">Stop the AI from changing this stat in a given direction.</p>
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
        </div>
      )}

      {editingStat.type?.toLowerCase() === "list" && (
        <div className="space-y-2">
          <Label>Items</Label>
          {editingStat.value &&
            (editingStat.value as StatListItem[]).map((item) => (
              <div key={item.id} className="space-y-2 border p-2 rounded">
                <div className="flex items-center space-x-2">
                  <Input
                    value={item.name}
                    onChange={(e) =>
                      handleListItemChange(item.id, "name", e.target.value)
                    }
                    placeholder="Item name"
                    className="flex-grow"
                  />
                  <Input
                    type="number"
                    value={item.number}
                    onChange={(e) =>
                      handleListItemChange(
                        item.id,
                        "number",
                        Number(e.target.value),
                      )
                    }
                    placeholder="Quantity"
                    className="w-24"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveListItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  value={item.description}
                  onChange={(e) =>
                    handleListItemChange(item.id, "description", e.target.value)
                  }
                  placeholder="Item description"
                />
              </div>
            ))}
          <div className="space-y-2 border p-2 rounded">
            <div className="flex items-center space-x-2">
              <Input
                value={newListItem.name}
                onChange={(e) =>
                  setNewListItem({ ...newListItem, name: e.target.value })
                }
                placeholder="New item name"
                className="flex-grow"
              />
              <Input
                type="number"
                value={newListItem.number}
                onChange={(e) =>
                  setNewListItem({
                    ...newListItem,
                    number: Number(e.target.value),
                  })
                }
                placeholder="Quantity"
                className="w-24"
              />
            </div>
            <Input
              value={newListItem.description}
              onChange={(e) =>
                setNewListItem({ ...newListItem, description: e.target.value })
              }
              placeholder="New item description"
            />
            <Button onClick={handleAddListItem} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label>Stat Descriptors</Label>
        {editingStat.descriptors &&
          editingStat.descriptors.map((descriptor, index) => (
            <div key={descriptor.id} className="flex items-center space-x-2">
              <Input
                type="number"
                value={descriptor.threshold}
                onChange={(e) =>
                  handleDescriptorChange(
                    index,
                    "threshold",
                    Number(e.target.value),
                  )
                }
                onBlur={handleDescriptorBlur}
                placeholder="Threshold %"
                className="w-24"
              />
              <Input
                value={descriptor.description}
                onChange={(e) =>
                  handleDescriptorChange(index, "description", e.target.value)
                }
                placeholder="Description"
                className="flex-grow"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveDescriptor(descriptor.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        <div className="flex items-center space-x-2">
          <Input
            type="number"
            value={newDescriptor.threshold}
            onChange={(e) =>
              setNewDescriptor({
                ...newDescriptor,
                threshold: e.target.value === "" ? "" : Number(e.target.value),
              })
            }
            placeholder="New Threshold %"
            className="w-24"
          />
          <Input
            value={newDescriptor.description}
            onChange={(e) =>
              setNewDescriptor({
                ...newDescriptor,
                description: e.target.value,
              })
            }
            placeholder="New Description"
            className="flex-grow"
          />
          <Button onClick={handleAddDescriptor}>Add</Button>
        </div>
      </div>

      {/* Code Section */}
      {isNumeric && (
        <CollapsibleSection
          open={codeOpen}
          onOpenChange={setCodeOpen}
          icon={<Code className="h-4 w-4" />}
          title="Dynamic Value Calculation (Optional)"
        >
            <p className="text-sm text-muted-foreground">
              Write JavaScript code to dynamically calculate this stat&apos;s value
              based on other stats and the story clock. The code should return a number. You have
              access to the &apos;stats&apos; array containing all stats, plus:
            </p>

            <ul className="text-xs text-muted-foreground space-y-1 pl-4">
              <li><code>deltaHours</code> — story hours this turn took (1 with the in-world clock off)</li>
              <li><code>elapsedHours</code> — total story hours so far, counting this turn</li>
              <li><code>day</code> / <code>daypart</code> — where the story stands at the <em>end</em> of the turn</li>
              <li><code>startDay</code> / <code>startDaypart</code> — where it stood at the <em>start</em></li>
            </ul>

            <p className="text-xs text-muted-foreground">
              Dayparts are <code>night</code>, <code>dawn</code>, <code>morning</code>, <code>midday</code>,{" "}
              <code>afternoon</code>, <code>evening</code>. Code that mentions any of these variables re-runs
              every turn; other code only re-runs when a stat changes.
            </p>

            <Textarea
              value={editingStat.code || ""}
              onChange={(e) => handleChange("code", e.target.value)}
              placeholder="// Example: Return the average of Health and Strength stats
const health = stats.find(s => s.name === 'Health')?.value || 0;
const strength = stats.find(s => s.name === 'Strength')?.value || 0;
return (health + strength) / 2;"
              className="font-mono text-sm"
              rows={6}
            />

            <div className="flex justify-between items-center">
              <Button
                onClick={async () => {
                  setIsTestingCode(true);
                  setCodeResult(null);
                  setCodeError(null);

                  try {
                    const result = await executeStatCode(
                      editingStat.code ?? '',
                      stats,
                      editingStat as Stat,
                    );
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

              {codeResult !== null && (
                <div className="text-success">Result: {codeResult}</div>
              )}

              {codeError && (
                <div className="text-destructive text-sm">Error: {codeError}</div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Note: When code is provided, it will override the manual value
              setting. Leave empty to use the manual value. AI can&apos;t modify
              stats with code (but it can see the stat value and desc). Test Code runs as a
              one-hour turn on day one.
            </p>
        </CollapsibleSection>
      )}
    </div>
  );
};

export default StatManager;
