import { useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { ListEditorAdapter } from '@/components/listEditorHooks';
import { PlaceholderPinRows } from '@/components/editor/PlaceholderPinRows';
import { OptionSwitcher } from '@/components/SettingsRows';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Hint, Meta } from '@/components/ui/typography';
import { useGameData } from '@/contexts/GameDataContext';
import { fieldFrame } from '@/lib/historyField';
import { useRenameField } from '@/lib/useCodeRename';
import { isAlwaysOn } from '@/lib/traitEffects';
import { randomUUID } from '@/lib/uuid';
import {
  BOOLEAN_OFF, BOOLEAN_ON, blankOption, choiceDefault, optionDefault, optionRange, reorderOptions, shownValuedOptions, snapNumber, withOptionType,
} from '@/lib/worldOptions';
import type {
  Entity, PlaceholderPin, PresetRow, PresetValue, PresetWorldOption, Trait, ValuedWorldOption, WorldOption, WorldOptionType, WorldOptionValueOf,
} from '@/types';

const TYPE_LABELS: Record<WorldOptionType, string> = { choice: 'Choice', boolean: 'On or Off', number: 'Number', preset: 'Preset' };

const MODES = [{ value: 'snapshot', label: 'Reset to Defaults' }, { value: 'overlay', label: 'Keep as Set' }] as const;

/** A whole-number box that keeps what is typed until it reads as a number, then writes it. */
function WholeNumberField({ id, value, onChange }: { id: string; value: number; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      id={id} type="number" inputMode="numeric" step={1}
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== '' && Number.isInteger(n)) onChange(n);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

/** One pin list with its heading. */
function PinsField({ label, pins, onChange, source, world }: {
  label: string;
  pins: readonly PlaceholderPin[] | undefined;
  onChange: (pins: PlaceholderPin[]) => void;
  source: { kind: 'option'; optionId: string; valueId: string };
  world: ReturnType<typeof useGameData>;
}) {
  return (
    <div className="space-y-2" {...fieldFrame('pins', source.valueId)}>
      <Meta as="p" className="font-medium">{label}</Meta>
      <PlaceholderPinRows pins={pins ?? []} onChange={onChange} source={source} world={world} placeholders={world.placeholders} />
    </div>
  );
}

type OptionRow = Extract<PresetRow, { kind: 'option' }>;

/** The value box for an Option row: the target Option's own control. */
function OptionRowValue({ option, value, label, onChange }: {
  option: ValuedWorldOption;
  value: WorldOptionValueOf;
  label: string;
  onChange: (value: WorldOptionValueOf) => void;
}) {
  if (option.type === 'number') {
    return <div className="w-28"><WholeNumberField id={`${label}-value`} value={Number(value)} onChange={(n) => onChange(snapNumber(option, n))} /></div>;
  }
  const items = option.type === 'boolean'
    ? [{ id: BOOLEAN_ON, name: 'On' }, { id: BOOLEAN_OFF, name: 'Off' }]
    : option.values;
  const current = option.type === 'boolean' ? (value === true ? BOOLEAN_ON : BOOLEAN_OFF) : String(value);
  return (
    <Select value={current} onValueChange={(v) => onChange(option.type === 'boolean' ? v === BOOLEAN_ON : v)}>
      <SelectTrigger aria-label={`${label} Value`} className="w-40"><SelectValue /></SelectTrigger>
      <SelectContent>
        {items.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** A trait a row can turn on or off: a root trait, or one an authored entity owns. */
interface TraitTarget {
  traitId: string;
  ownerId?: string;
  name: string;
}

/** What a Preset row can set: the shown Options that hold a value, and the traits the player can toggle, by owner. */
interface RowTargets {
  options: readonly ValuedWorldOption[];
  traits: readonly { owner: string; traits: readonly TraitTarget[] }[];
}

/** The world's row targets. A trait whose mode stops the player toggling it is left out (Q29). */
function rowTargets(world: Pick<ReturnType<typeof useGameData>, 'options' | 'traits' | 'entities'>): RowTargets {
  const toggled = (traits: readonly Trait[] | undefined, owner?: Entity) => (traits ?? []).filter((t) => !isAlwaysOn(t))
    .map((t): TraitTarget => ({ traitId: t.id, name: owner ? `${owner.name}’s ${t.name}` : t.name, ...(owner ? { ownerId: owner.id } : {}) }));
  return {
    options: shownValuedOptions(world.options),
    traits: [
      { owner: 'World Traits', traits: toggled(world.traits) },
      ...world.entities.map((e) => ({ owner: e.name, traits: toggled(e.traits, e) })),
    ].filter((g) => g.traits.length),
  };
}

/** One key per row target, so a row and the target it names compare by it. */
const optionKey = (optionId: string) => JSON.stringify(['option', optionId]);
const traitKey = (traitId: string, ownerId?: string) => JSON.stringify(['trait', ownerId ?? '', traitId]);
const targetKey = (row: PresetRow): string => (row.kind === 'option' ? optionKey(row.optionId)
  : row.kind === 'trait' ? traitKey(row.traitId, row.ownerId) : JSON.stringify([row.kind]));

const TRAIT_STATES = [{ id: 'on', name: 'On' }, { id: 'off', name: 'Off' }];

/** One Preset value's rows: each sets one shown Option to a value, or turns one trait on or off. */
function PresetRowsField({ rows, targets, label, onChange }: {
  rows: readonly PresetRow[];
  targets: RowTargets;
  label: string;
  onChange: (rows: PresetRow[]) => void;
}) {
  const choices: PresetRow[] = [
    ...targets.options.map((o): OptionRow => ({ kind: 'option', optionId: o.id, value: optionDefault(o) })),
    ...targets.traits.flatMap((g) => g.traits.map((t): PresetRow => ({ kind: 'trait', traitId: t.traitId, on: true, ...(t.ownerId ? { ownerId: t.ownerId } : {}) }))),
  ];
  const unused = choices.find((c) => !rows.some((r) => targetKey(r) === targetKey(c)));
  const set = (index: number, row: PresetRow) => onChange(rows.map((r, i) => (i === index ? row : r)));
  return (
    <div className="space-y-2">
      <Meta as="p" className="font-medium">Sets</Meta>
      {rows.map((row, index) => {
        if (row.kind !== 'option' && row.kind !== 'trait') return null;
        const key = targetKey(row);
        const known = choices.some((c) => targetKey(c) === key);
        const option = row.kind === 'option' ? targets.options.find((o) => o.id === row.optionId) : undefined;
        const rowLabel = `${label} Row ${index + 1}`;
        return (
          <div key={`${index}-${key}`} className="flex flex-wrap items-center gap-2">
            <Select
              value={known ? key : ''}
              onValueChange={(k) => { const next = choices.find((c) => targetKey(c) === k); if (next) set(index, next); }}
            >
              <SelectTrigger aria-label={`${rowLabel} Target`} className="w-56 min-w-0"><SelectValue placeholder="Pick an Option or Trait" /></SelectTrigger>
              <SelectContent>
                {targets.options.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Options</SelectLabel>
                    {targets.options.map((o) => <SelectItem key={o.id} value={optionKey(o.id)}>{o.name}</SelectItem>)}
                  </SelectGroup>
                )}
                {targets.traits.map((g) => (
                  <SelectGroup key={g.owner}>
                    <SelectLabel>{g.owner}</SelectLabel>
                    {g.traits.map((t) => (
                      <SelectItem key={`${t.ownerId ?? ''}-${t.traitId}`} value={traitKey(t.traitId, t.ownerId)}>{t.name}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {row.kind === 'option' && option && (
              <OptionRowValue option={option} value={row.value} label={rowLabel} onChange={(value) => set(index, { ...row, value })} />
            )}
            {row.kind === 'trait' && known && (
              <Select value={row.on ? 'on' : 'off'} onValueChange={(v) => set(index, { ...row, on: v === 'on' })}>
                <SelectTrigger aria-label={`${rowLabel} Value`} className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRAIT_STATES.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button variant="ghost" size="icon" aria-label={`Delete ${rowLabel}`} onClick={() => onChange(rows.filter((_, i) => i !== index))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
      {choices.length === 0 && <Hint>Add a shown Option or a trait to set it here</Hint>}
      <Button variant="outline" size="sm" disabled={!unused} onClick={() => unused && onChange([...rows, unused])}>
        <Plus className="mr-1 h-4 w-4" />Add Row
      </Button>
    </div>
  );
}

/** A Preset's fields: what a pick does to the other choices, and its values. */
function PresetFields({ option, targets, onChange }: {
  option: PresetWorldOption;
  targets: RowTargets;
  onChange: (next: WorldOption) => void;
}) {
  const setValues = (values: PresetValue[]) => onChange({ ...option, values });
  const setValue = (id: string, patch: Partial<PresetValue>) => setValues(option.values.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  return (
    <>
      <div className="space-y-2" {...fieldFrame('mode')}>
        <Label>Other Choices</Label>
        <OptionSwitcher ariaLabel="Other Choices" value={option.mode} options={MODES} onChange={(mode) => onChange({ ...option, mode })} />
        <Hint>
          {option.mode === 'snapshot'
            ? 'Resets every Option and trait this value doesn\u2019t set to its default'
            : 'Changes only what this value sets'}
        </Hint>
      </div>
      <div className="space-y-3">
        <Label>Values</Label>
        {option.values.map((value, index) => {
          const label = value.name || `Value ${index + 1}`;
          return (
            <div key={value.id} className="space-y-3 rounded-lg border p-3" {...fieldFrame('values', value.id)}>
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Value ${index + 1} Name`} value={value.name} className="min-w-0 flex-1"
                  onChange={(e) => setValue(value.id, { name: e.target.value })}
                />
                <Button
                  variant="ghost" size="icon" aria-label={`Delete ${label}`} disabled={option.values.length <= 1}
                  onClick={() => setValues(option.values.filter((v) => v.id !== value.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                aria-label={`${label} Description`} placeholder="Description" value={value.description}
                onChange={(e) => setValue(value.id, { description: e.target.value })}
              />
              <PresetRowsField rows={value.rows} targets={targets} label={label} onChange={(rows) => setValue(value.id, { rows })} />
            </div>
          );
        })}
        <Button
          variant="outline" size="sm"
          onClick={() => setValues([...option.values, { id: randomUUID(), name: `Value ${option.values.length + 1}`, description: '', rows: [] }])}
        >
          <Plus className="mr-1 h-4 w-4" />Add Value
        </Button>
      </div>
    </>
  );
}

/** The selected Option's fields. Every edit writes the world at once. */
function OptionDetail({ option, onChange }: { option: WorldOption; onChange: (next: WorldOption) => void }) {
  const world = useGameData();
  const rename = useRenameField({ root: 'options', value: option.name, siblings: world.options, ownId: option.id });
  const field = (name: string) => `option-${option.id}-${name}`;
  const withPins = (pins: PlaceholderPin[]) => (pins.length ? pins : undefined);

  const typeFields = () => {
    if (option.type === 'preset') return <PresetFields option={option} targets={rowTargets(world)} onChange={onChange} />;
    if (option.type === 'number') {
      const { lo, hi } = optionRange(option);
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['min', 'max', 'step', 'default'] as const).map((key) => (
            <div key={key} className="space-y-2" {...fieldFrame(key)}>
              <Label htmlFor={field(key)}>{{ min: 'Minimum', max: 'Maximum', step: 'Step', default: 'Default' }[key]}</Label>
              <WholeNumberField
                id={field(key)}
                value={key === 'step' ? option.step ?? 1 : key === 'default' ? snapNumber(option, option.default) : option[key]}
                onChange={(n) => onChange(key === 'step' ? { ...option, step: Math.max(1, n) }
                  : key === 'default' ? { ...option, default: snapNumber(option, n) } : { ...option, [key]: n })}
              />
            </div>
          ))}
          {lo === hi && <Hint className="col-span-full" role="note">The minimum and maximum are the same, so the slider can&apos;t move</Hint>}
        </div>
      );
    }
    if (option.type === 'boolean') {
      return (
        <>
          <div className="space-y-2" {...fieldFrame('default')}>
            <Label htmlFor={field('default')}>Default</Label>
            <Select value={option.default ? BOOLEAN_ON : BOOLEAN_OFF} onValueChange={(v) => onChange({ ...option, default: v === BOOLEAN_ON })}>
              <SelectTrigger id={field('default')} className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={BOOLEAN_ON}>On</SelectItem>
                <SelectItem value={BOOLEAN_OFF}>Off</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <PinsField
            label="Placeholder Pins When On" pins={option.onPins} world={world}
            source={{ kind: 'option', optionId: option.id, valueId: BOOLEAN_ON }}
            onChange={(pins) => onChange({ ...option, onPins: withPins(pins) })}
          />
          <PinsField
            label="Placeholder Pins When Off" pins={option.offPins} world={world}
            source={{ kind: 'option', optionId: option.id, valueId: BOOLEAN_OFF }}
            onChange={(pins) => onChange({ ...option, offPins: withPins(pins) })}
          />
        </>
      );
    }
    const setValues = (values: typeof option.values, defaultId = option.default) =>
      onChange({ ...option, values, default: choiceDefault(values, defaultId) });
    return (
      <div className="space-y-3">
        <Label>Values</Label>
        <RadioGroup value={option.default} onValueChange={(id) => onChange({ ...option, default: id })} className="space-y-3">
          {option.values.map((value, index) => (
            <div key={value.id} className="space-y-3 rounded-lg border p-3" {...fieldFrame('values', value.id)}>
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Value ${index + 1} Name`} value={value.name} className="min-w-0 flex-1"
                  onChange={(e) => setValues(option.values.map((v) => (v.id === value.id ? { ...v, name: e.target.value } : v)))}
                />
                <div className="flex shrink-0 items-center gap-2">
                  <RadioGroupItem id={field(`default-${value.id}`)} value={value.id} />
                  <Label htmlFor={field(`default-${value.id}`)} className="font-normal">Default</Label>
                </div>
                <Button
                  variant="ghost" size="icon" aria-label={`Delete ${value.name || `Value ${index + 1}`}`}
                  disabled={option.values.length <= 1}
                  onClick={() => setValues(option.values.filter((v) => v.id !== value.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <PinsField
                label="Placeholder Pins" pins={value.placeholderPins} world={world}
                source={{ kind: 'option', optionId: option.id, valueId: value.id }}
                onChange={(pins) => setValues(option.values.map((v) => (v.id === value.id ? { ...v, placeholderPins: withPins(pins) } : v)))}
              />
            </div>
          ))}
        </RadioGroup>
        <Button
          variant="outline" size="sm"
          onClick={() => setValues([...option.values, { id: randomUUID(), name: `Value ${option.values.length + 1}` }])}
        >
          <Plus className="mr-1 h-4 w-4" />Add Value
        </Button>
      </div>
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="space-y-2" {...fieldFrame('name')}>
        <Label htmlFor={field('name')}>Name</Label>
        <Input
          id={field('name')} value={option.name} onChange={(e) => onChange({ ...option, name: e.target.value })}
          onFocus={rename.onFocus} onBlur={rename.onBlur} onKeyDown={(e) => { if (e.key === 'Enter') rename.onSubmit(); }}
        />
      </div>
      <div className="space-y-2" {...fieldFrame('type')}>
        <Label htmlFor={field('type')}>Type</Label>
        <Select value={option.type} onValueChange={(t) => onChange(withOptionType(option, t as WorldOptionType, randomUUID))}>
          <SelectTrigger id={field('type')} className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(TYPE_LABELS) as WorldOptionType[]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2" {...fieldFrame('playerDescription')}>
        <Label htmlFor={field('playerDescription')}>Player-Facing Description</Label>
        <Textarea
          id={field('playerDescription')} value={option.playerDescription ?? ''}
          onChange={(e) => onChange({ ...option, playerDescription: e.target.value || undefined })}
        />
        <Hint>Shows to the player under the Option at new game</Hint>
      </div>
      {option.type !== 'preset' && <div className="space-y-3">
        <div className="flex items-start gap-2" {...fieldFrame('shownToPlayer')}>
          <Checkbox
            id={field('shown')} checked={option.shownToPlayer} className="mt-0.5"
            onCheckedChange={(c) => onChange({ ...option, shownToPlayer: c === true })}
          />
          <div>
            <Label htmlFor={field('shown')}>Shown to Player</Label>
            <Hint>Shows this Option to the player at new game</Hint>
          </div>
        </div>
        <div className="flex items-start gap-2" {...fieldFrame('midGame')}>
          <Checkbox
            id={field('midGame')} checked={option.midGame} className="mt-0.5"
            onCheckedChange={(c) => onChange({ ...option, midGame: c === true })}
          />
          <div>
            <Label htmlFor={field('midGame')}>Changeable During Play</Label>
            <Hint>Lets the player change this Option after the game starts</Hint>
          </div>
        </div>
      </div>}
      {typeFields()}
    </div>
  );
}

/**
 * The Options tab: the world's World Options in setup order. A drag reorders them; the selected Option edits
 * in place.
 */
export function useWorldOptionsAdapter({ selectedId, onSelect }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}): ListEditorAdapter {
  const { options, setWorldOptions, updateOption } = useGameData();
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  const remove = (id: string) => {
    setWorldOptions(options.filter((o) => o.id !== id));
    if (selectedId === id) onSelect(null);
  };
  const add = (name: string) => {
    const option = blankOption('choice', randomUUID(), name || 'New Option', randomUUID);
    setWorldOptions([...options, option]);
    onSelect(option.id);
  };

  return {
    rows: () => options.map((o) => ({
      id: o.id, name: o.name, sortable: true,
      actions: [{ icon: <X className="h-4 w-4" />, destructive: true, title: 'Delete', onClick: () => remove(o.id) }],
    })),
    names: { placeholders: [] },
    noun: 'options',
    detail: (id) => {
      const option = id ? byId.get(id) : undefined;
      if (option) return <OptionDetail key={option.id} option={option} onChange={updateOption} />;
      return (
        <div className="space-y-2">
          <span className="font-medium">Options</span>
          <Hint>
            Lists the choices the player makes when a new game starts, in the order they show. A Choice or an On or
            Off Option changes text through its placeholder pins. Drag an Option to change its order.
          </Hint>
        </div>
      );
    },
    onReorder: (activeId, overId) => {
      const next = reorderOptions(options, activeId, overId);
      if (next !== options) setWorldOptions([...next]);
    },
    add: { label: 'Add Option', onAdd: add },
    placeholder: 'Search options',
    holds: (id) => byId.has(id),
    isEmpty: options.length === 0,
    emptyHint: <Hint className="p-3">Add an Option the player picks when a new game starts</Hint>,
  };
}
