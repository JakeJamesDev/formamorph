import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tip } from '@/components/ui/tooltip';
import { BlueprintFooter, FieldReset, LabelRow } from '@/components/editor/BlueprintReset';
import PlaceholderField, { PlaceholderNameField } from '@/components/prompt/PlaceholderField';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import {
  copyValueState, effectiveCopy, removeCopyValue, resetCopyOverrides, resetCopyValue, setCopyValueText, setCopyValueWeight,
} from '@/lib/blueprints';
import { copyName } from '@/lib/placeholderBlueprints';
import { newPlaceholderValue, placeholderIsChoice, placeholderWeight, prunePlaceholderWeights } from '@/lib/placeholders';
import { cn } from '@/lib/utils';
import type { Placeholder, PlaceholderValue } from '@/types';
import { ListDetailFirstRow } from '@/components/ui/list-detail';

/** A weight typed into a box: whole, never negative. */
const typedWeight = (raw: string) => Math.max(0, Math.round(Number(raw) || 0));

/** One value's text: a line with chips inline, or the markdown field once it spans lines. */
function ValueText({ value, onChange, placeholders, ownerId, label }: {
  value: string;
  onChange: (text: string) => void;
  placeholders: Placeholder[];
  ownerId: string;
  label: string;
}) {
  return value.includes('\n')
    ? <PlaceholderField value={value} onChange={onChange} placeholders={placeholders} ownerId={ownerId} markdown ariaLabel={label} />
    : <PlaceholderNameField value={value} onChange={onChange} placeholders={placeholders} ownerId={ownerId} ariaLabel={label} />;
}

function WeightBox({ value, onChange, label }: { value: number; onChange: (weight: number) => void; label: string }) {
  return (
    <Input
      type="number"
      min={0}
      step={1}
      value={value}
      onChange={(e) => onChange(typedWeight(e.target.value))}
      className="h-6 w-14 px-1.5 text-helper"
      aria-label={label}
      title="Draw weight"
    />
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tip tip="Remove value" labelsChild={false}>
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label={label} onClick={onClick}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </Tip>
  );
}

/**
 * Right-panel editor for a copy: an entity's placeholder that reads its blueprint's values live. Each change
 * to a blueprint value is an override on this copy, reset one value at a time or all at once from the
 * footer. The copy's own values sit after the blueprint's. The name is always the blueprint's.
 */
export function PlaceholderCopyEditor({ copy, blueprint, ownerName }: { copy: Placeholder; blueprint: Placeholder; ownerName: string }) {
  const { placeholders, updatePlaceholder } = usePlaceholderStore();
  const effective = effectiveCopy(copy, blueprint);
  const weighable = placeholderIsChoice(effective);
  const weightOf = (value: PlaceholderValue) => placeholderWeight(effective, value);

  // Every edit is an override, even one back to the blueprint's value; Reset is the way back to live.
  const setText = (value: PlaceholderValue, text: string) => updatePlaceholder(setCopyValueText(copy, blueprint, value.id, text));
  const setWeight = (value: PlaceholderValue, weight: number) =>
    updatePlaceholder(setCopyValueWeight(copy, blueprint, value.id, weight));

  const setOwn = (values: PlaceholderValue[], weights = copy.weights) => {
    const pruned = prunePlaceholderWeights(weights, values);
    const { weights: _old, ...rest } = copy;
    updatePlaceholder({ ...rest, values, ...(pruned ? { weights: pruned } : {}) });
  };
  const setOwnWeight = (value: PlaceholderValue, weight: number) => {
    const weights = { ...copy.weights };
    if (weight === 1) delete weights[value.id];
    else weights[value.id] = weight;
    setOwn(copy.values, Object.keys(weights).length ? weights : undefined);
  };

  const count = blueprint.values.length;
  return (
    <div className="space-y-4">
      <ListDetailFirstRow align="center">
        <p className="rounded-md border border-dashed px-2 py-1.5 text-helper text-muted-foreground">
          Copy of the blueprint <strong>{blueprint.name}</strong>. Values follow the blueprint until you change them
          here.
        </p>
      </ListDetailFirstRow>
      <div className="space-y-2">
        <Label htmlFor={`copy-name-${copy.id}`}>Name</Label>
        <Input id={`copy-name-${copy.id}`} value={copyName(ownerName, blueprint.name)} disabled readOnly />
      </div>
      <div className="space-y-3">
        <Label>Blueprint Values</Label>
        {blueprint.values.map((value, i) => {
          const n = i + 1;
          const own = copy.valueOverrides?.[value.id];
          const state = copyValueState(copy, blueprint, value.id);
          const reset = state.overridden.length
            ? <FieldReset field={`value ${n}`} stale={state.stale.length > 0} onReset={() => updatePlaceholder(resetCopyValue(copy, value.id))} />
            : undefined;
          const shown = effective.values.find((v) => v.id === value.id);
          return (
            <div key={value.id} className={cn('space-y-2 rounded-md border bg-card p-2', own?.removed && 'opacity-60')}>
              <LabelRow reset={reset}>
                <span className="text-helper font-medium text-muted-foreground">Value {n}</span>
                {own?.removed ? (
                  <span className="text-meta text-muted-foreground">Removed</span>
                ) : (
                  <>
                    {weighable && shown && <WeightBox value={weightOf(shown)} onChange={(w) => setWeight(value, w)} label={`Draw weight for value ${n}`} />}
                    <RemoveButton label={`Remove value ${n}`} onClick={() => updatePlaceholder(removeCopyValue(copy, value.id))} />
                  </>
                )}
              </LabelRow>
              {own?.removed || !shown
                ? <p className="text-helper text-muted-foreground">{value.text}</p>
                : <ValueText value={shown.text} onChange={(t) => setText(value, t)} placeholders={placeholders} ownerId={copy.id} label={`Value ${n}`} />}
            </div>
          );
        })}
      </div>
      <div className="space-y-3">
        <Label>Own Values</Label>
        {copy.values.map((value, i) => {
          const n = count + i + 1;
          return (
            <div key={value.id} className="space-y-2 rounded-md border bg-card p-2">
              <LabelRow>
                <span className="text-helper font-medium text-muted-foreground">Value {n}</span>
                <span className="ml-auto flex items-center gap-2">
                  {weighable && <WeightBox value={weightOf(value)} onChange={(w) => setOwnWeight(value, w)} label={`Draw weight for value ${n}`} />}
                  <RemoveButton label={`Remove value ${n}`} onClick={() => setOwn(copy.values.filter((v) => v.id !== value.id))} />
                </span>
              </LabelRow>
              <ValueText
                value={value.text}
                onChange={(text) => setOwn(copy.values.map((v) => (v.id === value.id ? { ...v, text } : v)))}
                placeholders={placeholders}
                ownerId={copy.id}
                label={`Value ${n}`}
              />
            </div>
          );
        })}
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setOwn([...copy.values, newPlaceholderValue('')])}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Value
        </Button>
      </div>
    </div>
  );
}

/** The copy's frozen footer: Reset to Blueprint, and Edit Blueprint where the blueprint can be opened. */
export function PlaceholderCopyFooter({ copy, onEditBlueprint }: { copy: Placeholder; onEditBlueprint?: () => void }) {
  const { updatePlaceholder } = usePlaceholderStore();
  const overridden = !!copy.valueOverrides && Object.keys(copy.valueOverrides).length > 0;
  return (
    <BlueprintFooter canReset={overridden} onReset={() => updatePlaceholder(resetCopyOverrides(copy))}>
      {onEditBlueprint && <Button type="button" variant="outline" size="sm" onClick={onEditBlueprint}>Edit Blueprint</Button>}
    </BlueprintFooter>
  );
}
