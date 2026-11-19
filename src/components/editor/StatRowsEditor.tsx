import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WorldInput } from '@/components/editor/WorldField';
import { fieldFrame } from '@/lib/historyField';
import type { StatRow, StatRowSide } from '@/lib/traitTree';
import type { Stat, StatChange, TraitStatToggle } from '@/types';

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

/** One labeled list of stats a stat row can name. */
export interface StatChoices {
  label?: string;
  stats: readonly Stat[];
  /** The global stats on an owner's trait, whose items take the global target. */
  global?: boolean;
}

/** The stat options of a stat row, under a heading per list when there is more than one. */
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

/** The stat a row names, with the entity that owns it when it is not a global stat. */
export interface StatRowTarget {
  statId: string;
  ownerId?: string;
}

/** A stat picker in place of the Select: `row`'s current target, and `onPick` to point it elsewhere. */
export type StatRowPicker = (row: StatRowTarget, onPick: (target: StatRowTarget) => void, ariaLabel?: string) => ReactNode;

/** `row` pointed at `target`, its owner field replaced. */
function targetedRow<R extends StatRow>(row: R, target: StatRowTarget): R {
  const { ownerId: _owner, ...rest } = row as R & { ownerId?: string };
  return { ...rest, ...target } as R;
}

/** The stat changes and stat toggles a trait or an Option value carries, edited in place. */
export function StatRowsEditor<C extends StatChange, T extends TraitStatToggle>({
  statChanges, onStatChanges, statToggles, onStatToggles, choices, label, sideOf = () => null, showToggles, togglesReadOnly = false,
  changesLabel, togglesLabel, toggleNote, framePrefix = [], ariaPrefix, changesAnchor, statPicker,
}: {
  statChanges: readonly C[];
  onStatChanges: (next: C[]) => void;
  statToggles: readonly T[];
  onStatToggles: (next: T[]) => void;
  choices: readonly StatChoices[];
  /** A stat's name as the picker shows it. */
  label: (name: string) => string;
  /** Whose stat a row moves, on an owner's trait. Absent = no owner. */
  sideOf?: (row: StatRow) => StatRowSide;
  showToggles: boolean;
  togglesReadOnly?: boolean;
  changesLabel: ReactNode;
  togglesLabel: ReactNode;
  /** A line under one toggle, such as a rival that claims the same stat. */
  toggleNote?: (toggle: T) => ReactNode;
  /** The history field the rows sit under. */
  framePrefix?: readonly string[];
  /** Names each control after its row ("Easy Stat Change 1 Stat"). Absent = unnamed. */
  ariaPrefix?: string;
  changesAnchor?: string;
  /** Replaces each row's stat Select; `choices` then go unread. */
  statPicker?: StatRowPicker;
}) {
  const frame = (...parts: string[]) => fieldFrame(...framePrefix, ...parts);
  const aria = (kind: string, index: number, part: string) => (ariaPrefix ? { 'aria-label': `${ariaPrefix} ${kind} ${index + 1} ${part}` } : {});
  /** A row's stat control: the caller's picker, else a Select over `choices`. */
  const statControl = <R extends C | T>(row: R, kind: string, index: number, list: string, set: (next: R) => void, disabled = false) => {
    const ariaLabel = aria(kind, index, 'Stat')['aria-label'];
    if (statPicker) {
      return <div className="w-56 max-w-[40%] shrink-0" {...frame(list, String(index), 'statId')}>{statPicker(row, (target) => set(targetedRow(row, target)), ariaLabel)}</div>;
    }
    return (
      <Select value={pickerValue(row, sideOf(row))} onValueChange={(value) => set(pickedRow(row, value))} disabled={disabled}>
        <SelectTrigger {...frame(list, String(index), 'statId')} {...aria(kind, index, 'Stat')}>
          <SelectValue placeholder="Select stat" />
        </SelectTrigger>
        <SelectContent>
          <StatOptions choices={choices} label={label} />
        </SelectContent>
      </Select>
    );
  };
  const setChange = (index: number, next: C) => onStatChanges(statChanges.map((row, i) => (i === index ? next : row)));
  const setToggle = (index: number, next: T) => onStatToggles(statToggles.map((row, i) => (i === index ? next : row)));

  return (
    <>
      <div data-tour-anchor={changesAnchor} className="space-y-2">
        {changesLabel}
        {statChanges.map((statChange, index) => (
          <div key={index} className="flex space-x-2">
            {statControl(statChange, 'Stat Change', index, 'statChanges', (next) => setChange(index, next))}
            {/* A stat change has no id, and two can name one stat, so its place in the list names it. */}
            <div className="w-full" {...frame('statChanges', String(index), 'value')}>
              <WorldInput
                type="number"
                value={statChange.value}
                onChange={(e) => setChange(index, { ...statChange, value: Number(e.target.value) })}
                {...aria('Stat Change', index, 'Amount')}
              />
            </div>
            <Select value={statChange.type} onValueChange={(value) => setChange(index, { ...statChange, type: value as StatChange['type'] })}>
              <SelectTrigger {...frame('statChanges', String(index), 'type')} {...aria('Stat Change', index, 'Facet')}>
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
              variant="ghost" size="icon" {...(ariaPrefix ? { 'aria-label': `Delete ${ariaPrefix} Stat Change ${index + 1}` } : {})}
              onClick={() => onStatChanges(statChanges.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button size="sm" onClick={() => onStatChanges([...statChanges, { statId: '', value: 0, type: 'min' } as C])}>Add Stat Change</Button>
      </div>

      {showToggles && (
        <div className="space-y-2">
          {togglesLabel}
          {statToggles.map((toggle, index) => (
            <div key={index} className="space-y-1">
              <div className="flex space-x-2">
                {statControl(toggle, 'Stat Availability', index, 'statToggles', (next) => setToggle(index, next), togglesReadOnly)}
                <Select
                  value={toggle.enabled ? 'on' : 'off'}
                  onValueChange={(v) => setToggle(index, { ...toggle, enabled: v === 'on' })}
                  disabled={togglesReadOnly}
                >
                  <SelectTrigger className="w-32" {...frame('statToggles', String(index), 'enabled')} {...aria('Stat Availability', index, 'State')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on">Enable</SelectItem>
                    <SelectItem value="off">Disable</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost" size="icon" disabled={togglesReadOnly}
                  {...(ariaPrefix ? { 'aria-label': `Delete ${ariaPrefix} Stat Availability ${index + 1}` } : {})}
                  onClick={() => onStatToggles(statToggles.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {toggleNote?.(toggle)}
            </div>
          ))}
          {!togglesReadOnly && (
            <Button size="sm" onClick={() => onStatToggles([...statToggles, { statId: '', enabled: true } as T])}>
              Add Stat Availability
            </Button>
          )}
        </div>
      )}
    </>
  );
}
