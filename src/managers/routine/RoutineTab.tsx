import { useMemo, useState } from 'react';
import { Coffee, Plus, Trash2, X } from 'lucide-react';
import { LocationIcon } from '@/lib/elementIcons';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tip } from '@/components/ui/tooltip';
import { Hint, Meta } from '@/components/ui/typography';
import { WorldInput } from '@/components/editor/WorldField';
import { OptionSwitcher } from '@/components/SettingsRows';
import { CHIP_BASE } from '@/components/Chip';
import { useGameData } from '@/contexts/GameDataContext';
import { useWorldHistoryStep } from '@/contexts/worldRecorder';
import { chanceChipStyle, relativeChance } from '@/lib/chanceColor';
import { withKind } from '@/lib/entityKind';
import { withEntityLocations } from '@/lib/entityPresence';
import { fieldFrame } from '@/lib/historyField';
import { holderOf, locationRows } from '@/lib/locationTree';
import { labelPlaceholders } from '@/lib/placementLetters';
import { connectedPlaces } from '@/lib/positionEngine';
import { withNewRow, withNewStart, withoutRow, withoutStart, withRow, withStart } from '@/lib/routineEditing';
import { chancePercent, dayFull, freeRanges, rangeText, rowClockKey, toWeight, type FreeRange } from '@/lib/routineTime';
import { cn } from '@/lib/utils';
import { randomUUID } from '@/lib/uuid';
import { MINUTES_PER_DAY } from '@/lib/gameClock';
import type { Connection, Entity, EntityKind, EntityStart, GameLocation, ScheduleRow, Traversable } from '@/types';
import { RoutineRow } from './RoutineRow';
import { ACTIONS } from './routineActions';
import { LocationPicker, Token, TOKEN_CLASS, type PlaceBook } from './RoutineFields';

const KIND_OPTIONS = [
  { value: 'individual', label: 'One Location' },
  { value: 'group', label: 'Every Location' },
] as const;

const KIND_HINTS: Record<EntityKind, string> = {
  individual: 'Stands in one location at a time and keeps a daily routine',
  group: 'Stands at every picked location at once, like a crowd or a fixture',
};

/** The parent locations of `location`, outermost first. */
function pathOf(locations: readonly GameLocation[], location: GameLocation): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let parent = holderOf(locations as GameLocation[], location);
  while (parent && !seen.has(parent)) {
    seen.add(parent);
    const at = locations.find((l) => l.id === parent);
    if (!at) break;
    out.unshift(at.name);
    parent = holderOf(locations as GameLocation[], at);
  }
  return out;
}

/** Where an entity stands and how it moves: the Routine tab of a world entity. Writes the whole entity. */
export function RoutineTab({ entity, onChange }: { entity: Entity; onChange: (next: Entity) => void }) {
  const { locations, connections, placeholders, placementLetters, placeholderOwners } = useGameData();
  const step = useWorldHistoryStep();
  const commit = (label: string, next: Entity) => step(label, () => onChange(next));

  const book = useMemo<PlaceBook>(() => {
    const names = { letters: placementLetters, owners: placeholderOwners };
    const nameOf = (id: string) => labelPlaceholders(locations.find((l) => l.id === id)?.name ?? '', placeholders, names) || 'Unnamed Location';
    const ordered = locationRows(locations).map(({ location }) => location.id);
    return {
      nameOf,
      all: ordered,
      rowsOf: (ids) => ids.flatMap((id) => {
        const loc = locations.find((l) => l.id === id);
        if (!loc) return [];
        const path = pathOf(locations, loc).map((n) => labelPlaceholders(n, placeholders, names));
        return [{ key: id, value: id, name: nameOf(id), breadcrumb: path.length ? path : undefined }];
      }),
    };
  }, [locations, placeholders, placementLetters, placeholderOwners]);

  // An entity with no kind yet edits as a new Individual; its first write stores the kind.
  const individual = useMemo(() => (entity.kind ? entity : withKind(entity, 'individual', randomUUID)), [entity]);
  // A custom persona moves with the player: it keeps only its locations, with no placement or routine.
  if (entity.customPersona) return <div className="max-w-2xl"><GroupLocations entity={entity} book={book} commit={commit} /></div>;
  const kind: EntityKind = entity.kind ?? 'individual';

  return (
    <div className="max-w-2xl space-y-4" data-tour-anchor="entity-locations">
      <div className="space-y-1.5" {...fieldFrame('kind')}>
        <Label>Placement</Label>
        <OptionSwitcher
          ariaLabel="Placement" value={kind} options={KIND_OPTIONS}
          onChange={(next) => commit('Change Placement', withKind(entity, next, randomUUID))}
        />
        <Hint>{KIND_HINTS[kind]}</Hint>
      </div>
      {kind === 'group'
        ? <GroupLocations entity={entity} book={book} commit={commit} />
        : <IndividualRoutine entity={individual} book={book} connections={connections} locations={locations} commit={commit} onChange={onChange} />}
    </div>
  );
}

function GroupLocations({ entity, book, commit }: { entity: Entity; book: PlaceBook; commit: (label: string, next: Entity) => void }) {
  const options = book.rowsOf(book.all).map((r) => ({ label: r.name, value: r.value, depth: r.breadcrumb?.length ?? 0 }));
  const selected = (entity.locations ?? []).filter((id) => book.all.includes(id));
  return (
    <div className="space-y-1.5" {...fieldFrame('locations')}>
      <Label>Locations</Label>
      {entity.persona === true && <Hint>Lets the player start at any of these as this entity</Hint>}
      <MultiSelect
        key={entity.id} options={options} defaultValue={selected} placeholder="Select locations"
        onValueChange={(ids) => commit('Change Locations', withEntityLocations(entity, ids))}
      />
    </div>
  );
}

function IndividualRoutine({ entity, book, locations, connections, commit, onChange }: {
  entity: Entity; book: PlaceBook; locations: readonly GameLocation[]; connections: readonly Connection[];
  commit: (label: string, next: Entity) => void; onChange: (next: Entity) => void;
}) {
  const starts = entity.starts ?? [];
  const [shownId, setShownId] = useState<string | null>(null);
  const start = starts.find((s) => s.id === shownId) ?? starts[0];
  const weights = starts.map((s) => s.weight);
  const addStart = (place: string) => {
    const next = withNewStart(entity, place, randomUUID);
    commit('Add Start', next);
    setShownId(next.starts?.[next.starts.length - 1]?.id ?? null);
  };
  const addTrigger = (label: string) => (
    <Button variant="ghost" size="sm" className="h-8 gap-1 px-2" aria-label="Add Start"><Plus className="h-4 w-4" aria-hidden />{label}</Button>
  );

  return (
    <>
      <div className="space-y-2" {...fieldFrame('starts')}>
        <div className="flex flex-wrap items-center gap-1 border-b pb-2" role="group" aria-label="Starts">
          {starts.map((s, i) => (
            <button
              key={s.id} type="button" aria-pressed={s.id === start?.id} onClick={() => setShownId(s.id)}
              className={cn('flex items-center gap-1.5 rounded-md border px-2 py-1 text-label',
                s.id === start?.id ? 'border-primary bg-accent' : 'border-transparent hover:bg-muted')}
            >
              Start {i + 1}
              {starts.length > 1 && (
                <span className={CHIP_BASE} style={chanceChipStyle(relativeChance(s.weight, weights))}>{chancePercent(s.weight, weights)}%</span>
              )}
            </button>
          ))}
          <LocationPicker book={book} places={book.all} onPick={addStart} trigger={addTrigger(starts.length ? '' : 'Add Start')} />
        </div>
        {starts.length > 1 && <Hint>Picks one start at random in each new game</Hint>}
        {entity.persona === true && <Hint>Lets the player start at any start location as this entity</Hint>}
        {!start && <Hint>Pick the location it starts at</Hint>}
      </div>
      {start && (
        <StartRoutine
          entity={entity} start={start} weights={weights} book={book} commit={commit} onChange={onChange}
          connected={[...connectedPlaces(start.place, { locations, connections })]}
          onDeleted={() => setShownId(null)}
        />
      )}
      <TraversableField
        value={entity.traversable ?? 'anywhere'} book={book}
        onChange={(traversable) => commit('Change Can Also Go', { ...entity, traversable })}
      />
    </>
  );
}

function StartRoutine({ entity, start, weights, book, connected, commit, onChange, onDeleted }: {
  entity: Entity; start: EntityStart; weights: number[]; book: PlaceBook; connected: string[];
  commit: (label: string, next: Entity) => void; onChange: (next: Entity) => void; onDeleted: () => void;
}) {
  const many = (entity.starts?.length ?? 0) > 1;
  const percent = chancePercent(start.weight, weights);
  const rows = [...start.schedule].sort((a, b) => rowClockKey(a) - rowClockKey(b));
  const free = freeRanges(start.schedule);
  type Line = { at: number; row: ScheduleRow; free?: undefined } | { at: number; row?: undefined; free: FreeRange };
  const lines: Line[] = [
    ...rows.map((row) => ({ at: rowClockKey(row), row })),
    ...free.map((f) => ({ at: f.start, free: f })),
  ].sort((a, b) => a.at - b.at);
  const full = dayFull(start.schedule);
  const startName = book.nameOf(start.place);

  return (
    <div className="space-y-3">
      <p className="text-label leading-7">
        <LocationIcon className="mr-1 inline h-4 w-4 text-muted-foreground" aria-hidden />
        {'Starts at '}
        <LocationPicker
          book={book} places={book.all} value={start.place}
          onPick={(place) => commit('Change Start Location', withStart(entity, start.id, (s) => ({ ...s, place })))}
          trigger={(
            <button type="button" aria-label={`Start location: ${startName}`} className={TOKEN_CLASS}>
              {startName}
            </button>
          )}
        />
        {many && (
          <>
            {' in '}
            <Token label={`Chance: ${percent}%`} editor={(
              <div className="space-y-1.5" {...fieldFrame('starts', start.id, 'weight')}>
                <Label htmlFor={`weight-${start.id}`}>Weight</Label>
                <WorldInput
                  id={`weight-${start.id}`} type="number" min={1} step={1} inputMode="numeric" value={start.weight}
                  onChange={(e) => onChange(withStart(entity, start.id, (s) => ({ ...s, weight: toWeight(e.target.value) })))}
                />
                <Meta as="p">Picked in {percent}% of new games</Meta>
              </div>
            )}>{percent}%</Token>
            {' of new games'}
          </>
        )}
        .
        {many && (
          <Tip tip="Delete Start">
            <Button
              variant="ghost" size="icon" className="ml-1 h-7 w-7 align-middle text-muted-foreground" aria-label="Delete Start"
              onClick={() => { commit('Delete Start', withoutStart(entity, start.id)); onDeleted(); }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </Tip>
        )}
      </p>

      <ol className="space-y-0.5 border-l pl-2" aria-label="Routine">
        {lines.map((line) => line.row ? (
          <RoutineRow
            key={line.row.id} row={line.row} startPlace={start.place} book={book} connected={connected}
            others={start.schedule.filter((r) => r.id !== line.row.id)}
            onChange={(next, typed) => {
              const write = withRow(entity, start.id, line.row.id, () => next);
              if (typed) onChange(write); else commit('Edit Routine', write);
            }}
            onDelete={() => commit('Delete Routine Row', withoutRow(entity, start.id, line.row.id))}
          />
        ) : (
          <li key={`free-${line.free.start}`} className="flex items-center gap-1 px-1 text-label leading-7 text-muted-foreground">
            <Coffee className="h-4 w-4 shrink-0" aria-hidden />
            <span>{line.free.wholeDay ? 'All day' : rangeText({ start: line.free.start, end: line.free.end % MINUTES_PER_DAY })}, stays at {startName}.</span>
          </li>
        ))}
        {free.length === 0 && <li className="px-1 text-label italic leading-7 text-muted-foreground">Busy all day.</li>}
      </ol>

      <div className="flex flex-wrap items-center gap-1">
        {ACTIONS.map(({ value, label, Icon }) => (
          <Button
            key={value} variant="outline" size="sm" className="gap-1" disabled={full} aria-label={`Add ${label}`}
            onClick={() => commit('Add Routine Row', withNewRow(entity, start.id, value, randomUUID))}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /><Icon className="h-4 w-4" aria-hidden />{label}
          </Button>
        ))}
        {full && <Meta>Shorten a row to add another</Meta>}
      </div>
    </div>
  );
}

function TraversableField({ value, book, onChange }: { value: Traversable; book: PlaceBook; onChange: (next: Traversable) => void }) {
  const anywhere = value === 'anywhere';
  const list = anywhere ? [] : value;
  return (
    <div className="space-y-1.5 border-t pt-3" {...fieldFrame('traversable')}>
      <Label>Can Also Go</Label>
      <Select value={anywhere ? 'anywhere' : 'listed'} onValueChange={(v) => onChange(v === 'anywhere' ? 'anywhere' : [])}>
        <SelectTrigger className="h-9 w-56" aria-label="Can Also Go"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="anywhere">Anywhere</SelectItem>
          <SelectItem value="listed">Only Listed Locations</SelectItem>
        </SelectContent>
      </Select>
      {!anywhere && (
        <div className="flex flex-wrap items-center gap-1">
          {list.map((id) => (
            <span key={id} className={cn(CHIP_BASE, 'bg-secondary text-secondary-foreground')}>
              {book.nameOf(id)}
              <button type="button" aria-label={`Remove ${book.nameOf(id)}`} onClick={() => onChange(list.filter((x) => x !== id))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <LocationPicker
            book={book} places={book.all.filter((id) => !list.includes(id))} onPick={(id) => onChange([...list, id])}
            trigger={<Button variant="ghost" size="sm" className="h-7 gap-1 px-1.5"><Plus className="h-4 w-4" aria-hidden />Add Location</Button>}
          />
        </div>
      )}
      <Hint>
        {anywhere
          ? 'Can follow the player or be called over to any location'
          : 'Follows or comes over only to its routine and listed locations'}
      </Hint>
    </div>
  );
}
