import { createContext, useContext, useMemo, useState } from 'react';
import { Plus, Trash2, TriangleAlert, X } from 'lucide-react';
import type { ListEditorAdapter } from '@/components/listEditorHooks';
import { PlaceholderPinRows } from '@/components/editor/PlaceholderPinRows';
import { OptionStatRowsField } from '@/components/editor/OptionStatRowsField';
import { OptionItemsField } from '@/managers/OptionItemsField';
import PlaceholderText, { PlaceholderVocabularyProvider } from '@/components/prompt/PlaceholderText';
import { OptionSwitcher } from '@/components/SettingsRows';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { BreadcrumbPicker, type BreadcrumbPickerNode, type BreadcrumbPickerRow } from '@/components/ui/breadcrumb-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { labelPlaceholders } from '@/lib/placementLetters';
import { Textarea } from '@/components/ui/textarea';
import { Hint, Meta } from '@/components/ui/typography';
import { useGameData } from '@/contexts/GameDataContext';
import { fieldFrame } from '@/lib/historyField';
import { useRenameField } from '@/lib/useCodeRename';
import { isAlwaysOn } from '@/lib/traitEffects';
import { startPlacesOf } from '@/lib/entityPlaces';
import { presetPersonaTargets } from '@/lib/entryDraft';
import {
  checkPreset, presetRowTrait, presetTraitTrees, type PresetCheckWorld, type PresetRowIssue, type PresetTraitTrees,
} from '@/lib/presetCheck';
import type { Owner } from '@/lib/owners';
import { randomUUID } from '@/lib/uuid';
import {
  BOOLEAN_OFF, BOOLEAN_ON, blankOption, booleanRows, withBooleanRows, choiceDefault, optionDefault, optionRange, reorderOptions, shownValuedOptions, snapNumber, withOptionType,
} from '@/lib/worldOptions';
import type {
  Entity, GameLocation, Placeholder, PlaceholderPin, PresetRow, PresetValue, PresetWorldOption, Trait, ValuedWorldOption, WorldOption, WorldOptionType, WorldOptionValueOf,
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

const PresetPlaceholders = createContext<readonly Placeholder[]>([]);

/** An authored name in the Preset editor, its placeholders drawn as chips. */
const ChipName = ({ text }: { text: string }) => <PlaceholderText text={text} placeholders={useContext(PresetPlaceholders)} />;

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
        {items.map((item) => <SelectItem key={item.id} value={item.id}><ChipName text={item.name} /></SelectItem>)}
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

/** What a Preset row can set: the shown Options that hold a value, the traits the player can toggle, by owner, the
 *  world's personas and its Starting Locations. */
interface RowTargets {
  options: readonly ValuedWorldOption[];
  traits: readonly { key: string; owner: string; traits: readonly TraitTarget[] }[];
  personas: readonly Pick<Entity, 'id' | 'name'>[];
  locations: readonly Pick<GameLocation, 'id' | 'name'>[];
}

/** The world's row targets. Traits come from the trees setup offers (Q42); one whose mode stops the player toggling
 *  it is left out (Q29). Personas are the marked entities and the Custom Persona (Q36); locations are the starting
 *  ones and every persona's start places (Q35). */
function rowTargets(world: Pick<PresetCheckWorld, 'options' | 'entities' | 'locations'>, trees: PresetTraitTrees): RowTargets {
  const toggled = (traits: readonly Trait[], owner?: Owner) => traits.filter((t) => !isAlwaysOn(t))
    .map((t): TraitTarget => ({ traitId: t.id, name: owner ? `${owner.name}: ${t.name}` : t.name, ...(owner ? { ownerId: owner.id } : {}) }));
  const { world: marked, custom } = presetPersonaTargets(world.entities);
  const personas = custom ? [...marked, custom] : marked;
  const starts = new Set(personas.flatMap((e) => startPlacesOf(e, world)));
  return {
    options: shownValuedOptions(world.options),
    traits: [
      { key: 'world', owner: 'World', traits: toggled(trees.global) },
      ...trees.owners.map((o) => ({ key: o.id, owner: o.name, traits: toggled(o.traits, o) })),
    ].filter((g) => g.traits.length),
    personas,
    locations: world.locations.filter((l) => l.isStarting || starts.has(l.id)),
  };
}

/** One key per row target, so a row and the target it names compare by it. A persona or location row is one per value. */
const optionKey = (optionId: string) => JSON.stringify(['option', optionId]);
const traitKey = (traitId: string, ownerId?: string) => JSON.stringify(['trait', ownerId ?? '', traitId]);
const PERSONA_KEY = JSON.stringify(['persona']);
const LOCATION_KEY = JSON.stringify(['location']);
const targetKey = (row: PresetRow): string => (row.kind === 'option' ? optionKey(row.optionId)
  : row.kind === 'trait' ? traitKey(row.traitId, row.ownerId) : row.kind === 'persona' ? PERSONA_KEY : LOCATION_KEY);

/** The row targets as drill-down pages, in the order the row editor lists them: Options, Start, then traits by owner. */
function targetTree(targets: RowTargets): BreadcrumbPickerNode<string>[] {
  const row = (key: string, name: string, place: string): BreadcrumbPickerRow<string> => ({ key, value: key, name, breadcrumb: [place] });
  const start = [
    ...(targets.personas.length ? [row(PERSONA_KEY, 'Persona', 'Start')] : []),
    ...(targets.locations.length ? [row(LOCATION_KEY, 'Starting Location', 'Start')] : []),
  ];
  const traitPages = targets.traits.map((g): BreadcrumbPickerNode<string> => ({
    kind: 'page', key: `traits:${g.key}`, heading: g.owner,
    children: [{ kind: 'section', rows: g.traits.map((t) => row(traitKey(t.traitId, t.ownerId), t.name, g.owner)) }],
  }));
  return [
    ...(targets.options.length ? [{
      kind: 'page' as const, key: 'options', heading: 'Options',
      children: [{ kind: 'section' as const, rows: targets.options.map((o) => row(optionKey(o.id), o.name, 'Options')) }],
    }] : []),
    ...(start.length ? [{ kind: 'page' as const, key: 'start', heading: 'Start', children: [{ kind: 'section' as const, rows: start }] }] : []),
    ...(traitPages.length ? [{ kind: 'page' as const, key: 'traits', heading: 'Traits', children: traitPages }] : []),
  ];
}

/** The value box for a persona or location row: one of the world's targets of that kind. */
function TargetRowValue({ items, value, label, onChange }: {
  items: readonly { id: string; name: string }[];
  value: string;
  label: string;
  onChange: (id: string) => void;
}) {
  return (
    <Select value={items.some((i) => i.id === value) ? value : ''} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-48 min-w-0"><SelectValue /></SelectTrigger>
      <SelectContent>
        {items.map((item) => <SelectItem key={item.id} value={item.id}><ChipName text={item.name} /></SelectItem>)}
      </SelectContent>
    </Select>
  );
}

const TRAIT_STATES = [{ id: 'on', name: 'On' }, { id: 'off', name: 'Off' }];

/** One Preset value's rows: each sets a shown Option, a trait, the persona or the Starting Location. */
function PresetRowsField({ rows, targets, label, onChange }: {
  rows: readonly PresetRow[];
  targets: RowTargets;
  label: string;
  onChange: (rows: PresetRow[]) => void;
}) {
  const choices: PresetRow[] = [
    ...targets.options.map((o): OptionRow => ({ kind: 'option', optionId: o.id, value: optionDefault(o) })),
    ...targets.traits.flatMap((g) => g.traits.map((t): PresetRow => ({ kind: 'trait', traitId: t.traitId, on: true, ...(t.ownerId ? { ownerId: t.ownerId } : {}) }))),
    ...targets.personas.slice(0, 1).map((p): PresetRow => ({ kind: 'persona', entityId: p.id })),
    ...targets.locations.slice(0, 1).map((l): PresetRow => ({ kind: 'location', locationId: l.id })),
  ];
  const unused = choices.find((c) => !rows.some((r) => targetKey(r) === targetKey(c)));
  const placeholders = useContext(PresetPlaceholders);
  const renderText = (text: string) => <PlaceholderText text={text} placeholders={placeholders} />;
  const plainText = (text: string) => labelPlaceholders(text, placeholders);
  const tree = targetTree(targets);
  const set =(index: number, row: PresetRow) => onChange(rows.map((r, i) => (i === index ? row : r)));
  return (
    <div className="space-y-2">
      <Meta as="p" className="font-medium">Sets</Meta>
      {rows.map((row, index) => {
        const key = targetKey(row);
        const known = choices.some((c) => targetKey(c) === key);
        const option = row.kind === 'option' ? targets.options.find((o) => o.id === row.optionId) : undefined;
        const rowLabel = `${label} Row ${index + 1}`;
        return (
          <div key={`${index}-${key}`} className="flex flex-wrap items-center gap-2">
            <BreadcrumbPicker
              tree={tree}
              value={known ? key : undefined}
              onPick={(k) => { const next = choices.find((c) => targetKey(c) === k); if (next) set(index, next); }}
              searchPlaceholder="Search Options, traits and start"
              renderText={renderText}
              plainText={plainText}
              placeholder="Pick What to Set"
              ariaLabel={`${rowLabel} Target`}
              className="w-56 min-w-0"
            />
            {row.kind === 'persona' && known && (
              <TargetRowValue
                items={targets.personas} value={row.entityId} label={`${rowLabel} Value`}
                onChange={(entityId) => set(index, { kind: 'persona', entityId })}
              />
            )}
            {row.kind === 'location' && known && (
              <TargetRowValue
                items={targets.locations} value={row.locationId} label={`${rowLabel} Value`}
                onChange={(locationId) => set(index, { kind: 'location', locationId })}
              />
            )}
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
      {choices.length === 0 && <Hint>Add a shown Option, trait, persona or Starting Location first</Hint>}
      <Button variant="outline" size="sm" disabled={!unused} onClick={() => unused && onChange([...rows, unused])}>
        <Plus className="mr-1 h-4 w-4" />Add Row
      </Button>
    </div>
  );
}

const DELETED_NOUN: Record<PresetRow['kind'], [one: string, many: string]> = {
  trait: ['trait', 'traits'], option: ['Option', 'Options'], persona: ['persona', 'personas'], location: ['location', 'locations'],
};

/** A row as its controls read: "Elf", "Wolf: Feral" (Q32), "Size: Big", "Persona: Mira", "Starting Location: Ashgate". */
function rowName(row: PresetRow, world: PresetCheckWorld, trees: PresetTraitTrees): string {
  if (row.kind === 'persona') return `Persona: ${world.entities.find((e) => e.id === row.entityId)?.name ?? ''}`;
  if (row.kind === 'location') return `Starting Location: ${world.locations.find((l) => l.id === row.locationId)?.name ?? ''}`;
  if (row.kind === 'option') {
    const option = world.options.find((o) => o.id === row.optionId);
    const value = option?.type === 'boolean' ? (row.value === true ? 'On' : 'Off')
      : option?.type === 'choice' ? option.values.find((v) => v.id === row.value)?.name : String(row.value);
    return value ? `${option?.name}: ${value}` : option?.name ?? '';
  }
  const found = presetRowTrait(row, trees);
  const name = found?.trait.name ?? '';
  return found?.owner ? `${found.owner.name}: ${name}` : name;
}

/** The warning on a Preset value naming each row that can't apply, then a count of deleted rows by kind (Q40). */
function PresetValueWarning({ issues, world, trees }: {
  issues: readonly PresetRowIssue[];
  world: PresetCheckWorld;
  trees: PresetTraitTrees;
}) {
  const deleted = (Object.keys(DELETED_NOUN) as PresetRow['kind'][]).flatMap((kind) => {
    const n = issues.filter((i) => i.deleted && i.row.kind === kind).length;
    return n === 0 ? [] : [n === 1 ? `a deleted ${DELETED_NOUN[kind][0]}` : `${n} deleted ${DELETED_NOUN[kind][1]}`];
  });
  const named = [...issues.filter((i) => !i.deleted).map((i) => rowName(i.row, world, trees)), ...deleted];
  return (
    <p role="status" className="flex items-start gap-1 text-helper text-warning">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>Can&apos;t apply: {named.map((name, i) => <span key={i}>{i > 0 && ', '}<ChipName text={name} /></span>)}</span>
    </p>
  );
}

/** A Preset's fields: what a pick does to the other choices, and its values. */
function PresetFields({ option, world, placeholders, onChange }: {
  option: PresetWorldOption;
  world: PresetCheckWorld;
  placeholders: readonly Placeholder[];
  onChange: (next: WorldOption) => void;
}) {
  const { worldOverview, entities, locations, traits, traitGroups, stats, statGroups, items, placements, slots, bodies, options } = world;
  const trees = useMemo(() => presetTraitTrees({ traits, traitGroups, entities }), [traits, traitGroups, entities]);
  const targets = useMemo(() => rowTargets({ options, entities, locations }, trees), [options, entities, locations, trees]);
  // Keyed on the slices the check reads, so an edit elsewhere in the world does not rerun it.
  const issues = useMemo(() => checkPreset(option, {
    worldOverview, entities, locations, traits, traitGroups, stats, statGroups, items, placements, slots, bodies, options,
  }), [option, worldOverview, entities, locations, traits, traitGroups, stats, statGroups, items, placements, slots, bodies, options]);
  const setValues = (values: PresetValue[]) => onChange({ ...option, values });
  const setValue = (id: string, patch: Partial<PresetValue>) => setValues(option.values.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  return (
    <PresetPlaceholders.Provider value={placeholders}>
      <PlaceholderVocabularyProvider placeholders={placeholders}>
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
              const valueIssues = issues.get(value.id);
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
                  {valueIssues && <PresetValueWarning issues={valueIssues} world={world} trees={trees} />}
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
      </PlaceholderVocabularyProvider>
    </PresetPlaceholders.Provider>
  );
}

/** The selected Option's fields. Every edit writes the world at once. */
function OptionDetail({ option, onChange }: { option: WorldOption; onChange: (next: WorldOption) => void }) {
  const world = useGameData();
  const rename = useRenameField({ root: 'options', value: option.name, siblings: world.options, ownId: option.id });
  const field = (name: string) => `option-${option.id}-${name}`;
  const withPins = (pins: PlaceholderPin[]) => (pins.length ? pins : undefined);

  const typeFields = () => {
    if (option.type === 'preset') return <PresetFields option={option} world={world} placeholders={world.placeholders} onChange={onChange} />;
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
          {(['On', 'Off'] as const).map((state) => {
            const on = state === 'On';
            return (
              <OptionStatRowsField
                key={state} when={`When ${state}`} name={state} rows={booleanRows(option, on)} world={world}
                valueId={on ? BOOLEAN_ON : BOOLEAN_OFF} onChange={(rows) => onChange(withBooleanRows(option, on, rows))}
              />
            );
          })}
          {(['On', 'Off'] as const).map((state) => {
            const on = state === 'On';
            return (
              <OptionItemsField
                key={state} when={`When ${state}`} name={state} valueId={on ? BOOLEAN_ON : BOOLEAN_OFF}
                placements={on ? option.onPlacements : option.offPlacements}
                onChange={(placements) => onChange(on ? { ...option, onPlacements: placements } : { ...option, offPlacements: placements })}
              />
            );
          })}
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
              <OptionStatRowsField
                name={value.name || `Value ${index + 1}`} rows={value} world={world} valueId={value.id}
                onChange={(rows) => setValues(option.values.map((v) => (v.id === value.id ? { ...v, ...rows } : v)))}
              />
              <OptionItemsField
                name={value.name || `Value ${index + 1}`} valueId={value.id} placements={value.placements}
                onChange={(placements) => setValues(option.values.map((v) => (v.id === value.id ? { ...v, placements } : v)))}
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
            Lists the Options the player sets when a new game starts, in the order the player sees them. Drag an
            Option to move it.
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
