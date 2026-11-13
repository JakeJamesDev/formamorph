import { useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { ListEditorAdapter } from '@/components/listEditorHooks';
import { PlaceholderPinRows } from '@/components/editor/PlaceholderPinRows';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Hint, Meta } from '@/components/ui/typography';
import { useGameData } from '@/contexts/GameDataContext';
import { fieldFrame } from '@/lib/historyField';
import { useRenameField } from '@/lib/useCodeRename';
import { randomUUID } from '@/lib/uuid';
import {
  BOOLEAN_OFF, BOOLEAN_ON, blankOption, choiceDefault, optionRange, reorderOptions, snapNumber, withOptionType,
} from '@/lib/worldOptions';
import type { PlaceholderPin, WorldOption, WorldOptionType } from '@/types';

const TYPE_LABELS: Record<WorldOptionType, string> = { choice: 'Choice', boolean: 'On or Off', number: 'Number' };

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

/** The selected Option's fields. Every edit writes the world at once. */
function OptionDetail({ option, onChange }: { option: WorldOption; onChange: (next: WorldOption) => void }) {
  const world = useGameData();
  const rename = useRenameField({ root: 'options', value: option.name, siblings: world.options, ownId: option.id });
  const field = (name: string) => `option-${option.id}-${name}`;
  const withPins = (pins: PlaceholderPin[]) => (pins.length ? pins : undefined);

  const typeFields = () => {
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
      <div className="space-y-3">
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
      </div>
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
