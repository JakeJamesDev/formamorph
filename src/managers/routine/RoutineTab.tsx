import { useEffect, useMemo, useRef, useState } from 'react';
import { Coffee, LockOpen, Plus, Trash2, X } from 'lucide-react';
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
import { withGroupStart, withKind, withoutGroupStartsAt } from '@/lib/entityKind';
import { withEntityLocations } from '@/lib/entityPresence';
import { fieldFrame } from '@/lib/historyField';
import { holderOf, locationRows } from '@/lib/locationTree';
import { labelPlaceholders } from '@/lib/placementLetters';
import { connectedPlaces } from '@/lib/positionEngine';
import { withLockedRest, withNewRow, withNewStart, withoutRow, withoutStart, withRow, withRowAt, withStart } from '@/lib/routineEditing';
import { CLEARS_ROUTINE_SELECTION, KEEPS_ROUTINE_SELECTION, useRoutineSelection } from '@/lib/routineSelection';
import {
  chancePercent, dayFull, freeRanges, onDaypartEdges, rangeText, toStrip, toWeight, type FreeRange,
} from '@/lib/routineTime';
import { cn } from '@/lib/utils';
import { randomUUID } from '@/lib/uuid';
import { MINUTES_PER_DAY } from '@/lib/gameClock';
import type { Connection, Entity, EntityKind, EntityStart, GameLocation, ScheduleRow, Traversable } from '@/types';
import { DayStrip, STRIP_PART } from './DayStrip';
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

/** What a press may land on and keep the row selection: a sentence, the strip, an open editor, or the map. */
const KEEPS_SELECTION = `[data-routine-row], [${STRIP_PART}], [data-radix-popper-content-wrapper], [role="listbox"], [${KEEPS_ROUTINE_SELECTION}]`;

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
  if (entity.customPersona) return <PersonaLocations entity={entity} book={book} commit={commit} />;
  const kind: EntityKind = entity.kind ?? 'individual';

  return (
    <div className="space-y-4" data-tour-anchor="entity-locations">
      <div className="space-y-1.5" {...fieldFrame('kind')}>
        <Label>Placement</Label>
        <OptionSwitcher
          ariaLabel="Placement" value={kind} options={KIND_OPTIONS}
          onChange={(next) => commit('Change Placement', withKind(entity, next, randomUUID))}
        />
        <Hint>{KIND_HINTS[kind]}</Hint>
      </div>
      {kind === 'group'
        ? <GroupStarts entity={entity} book={book} commit={commit} />
        : <IndividualRoutine entity={individual} book={book} connections={connections} locations={locations} commit={commit} onChange={onChange} />}
    </div>
  );
}

/** The Locations field: a pick list over every location. `version` remounts it so it shows `selected` again. */
function PlaceList({ entity, book, selected, version = 0, onChange }: {
  entity: Entity; book: PlaceBook; selected: string[]; version?: number; onChange: (ids: string[]) => void;
}) {
  const options = book.rowsOf(book.all).map((r) => ({ label: r.name, value: r.value, depth: r.breadcrumb?.length ?? 0 }));
  return (
    <div className="space-y-1.5" {...fieldFrame('locations')}>
      <Label>Locations</Label>
      {entity.persona === true && <Hint>Lets the player start at any of these as this entity</Hint>}
      <MultiSelect
        key={`${entity.id}:${version}`} options={options} defaultValue={selected.filter((id) => book.all.includes(id))}
        placeholder="Select locations" onValueChange={onChange}
      />
    </div>
  );
}

function PersonaLocations({ entity, book, commit }: { entity: Entity; book: PlaceBook; commit: (label: string, next: Entity) => void }) {
  return (
    <PlaceList
      entity={entity} book={book} selected={entity.locations ?? []}
      onChange={(ids) => commit('Change Locations', withEntityLocations(entity, ids))}
    />
  );
}

/** A Group's Starts as a place list: picking a place adds a Start with no rows there, and unpicking one removes the
 *  Starts that begin there. The last Start stays. */
function GroupStarts({ entity, book, commit }: { entity: Entity; book: PlaceBook; commit: (label: string, next: Entity) => void }) {
  // Remounts the list when a removal is refused, so it shows the Start that stayed.
  const [refusals, setRefusals] = useState(0);
  const places = [...new Set((entity.starts ?? []).map((s) => s.place))];
  const change = (ids: string[]) => {
    let next = entity;
    for (const place of places) if (!ids.includes(place)) next = withoutGroupStartsAt(next, place);
    for (const place of ids) if (!places.includes(place)) next = withGroupStart(next, place, randomUUID);
    if (places.some((place) => !ids.includes(place) && next.starts?.some((s) => s.place === place))) setRefusals((n) => n + 1);
    if (next !== entity) commit('Change Locations', next);
  };
  return <PlaceList entity={entity} book={book} selected={places} version={refusals} onChange={change} />;
}

function IndividualRoutine({ entity, book, locations, connections, commit, onChange }: {
  entity: Entity; book: PlaceBook; locations: readonly GameLocation[]; connections: readonly Connection[];
  commit: (label: string, next: Entity) => void; onChange: (next: Entity) => void;
}) {
  const starts = entity.starts ?? [];
  const { startId, showStart } = useRoutineSelection(entity.id);
  const start = starts.find((s) => s.id === startId) ?? starts[0];
  const weights = starts.map((s) => s.weight);
  const addStart = (place: string) => {
    const next = withNewStart(entity, place, randomUUID);
    commit('Add Start', next);
    showStart(next.starts?.[next.starts.length - 1]?.id ?? null);
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
              key={s.id} type="button" aria-pressed={s.id === start?.id} onClick={() => showStart(s.id)}
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
          onDeleted={() => showStart(null)}
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
  const free = freeRanges(start.schedule);
  type Line = { at: number; row: ScheduleRow; free?: undefined } | { at: number; row?: undefined; free: FreeRange };
  // The sentences read from Dawn, the way the strip above them does.
  const lines: Line[] = [
    ...start.schedule.map((row) => ({ at: row.time === 'allDay' ? -1 : toStrip(row.time.start), row })),
    ...free.map((f) => ({ at: toStrip(f.start), free: f })),
  ].sort((a, b) => a.at - b.at);
  const full = dayFull(start.schedule);
  const startName = book.nameOf(start.place);

  const { rowId, selectRow } = useRoutineSelection(entity.id);
  const selected = start.schedule.some((r) => r.id === rowId) ? rowId : null;
  // A row shows as hours when its ends sit off daypart edges, until its swap button says otherwise.
  const [formats, setFormats] = useState<Record<string, boolean>>({});
  const asHoursOf = (row: ScheduleRow) => formats[row.id] ?? (row.time !== 'allDay' && !onDaypartEdges(row.time));
  const rowEls = useRef(new Map<string, HTMLLIElement>());

  // A press outside the rows, their bands, their handles and their open editors clears the selection.
  useEffect(() => {
    if (!selected) return;
    const onDown = (e: PointerEvent) => {
      // The nearest marked ancestor decides, so a panel that clears wins over the surface around it.
      const marked = e.target instanceof Element ? e.target.closest(`${KEEPS_SELECTION}, [${CLEARS_ROUTINE_SELECTION}]`) : null;
      if (marked && !marked.hasAttribute(CLEARS_ROUTINE_SELECTION)) return;
      selectRow(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [selected, selectRow]);

  // A filled gap's new sentence exists only after the write renders, so it scrolls into view then.
  const scrollTo = useRef<string | null>(null);
  useEffect(() => {
    if (!selected || scrollTo.current !== selected) return;
    scrollTo.current = null;
    rowEls.current.get(selected)?.scrollIntoView?.({ block: 'nearest' });
  }, [selected, start.schedule]);

  const showRow = (id: string) => {
    selectRow(id);
    rowEls.current.get(id)?.scrollIntoView?.({ block: 'nearest' });
  };
  const fill = (time: ScheduleRow['time']) => {
    const added = withRowAt(entity, start.id, time, randomUUID);
    commit('Add Routine Row', added.entity);
    scrollTo.current = added.rowId;
    selectRow(added.rowId);
  };
  const move = (id: string, time: ScheduleRow['time'], gesture: boolean) => {
    // The row keeps its format through a drag, All Day included, so it snaps the same way on the way back.
    setFormats((f) => (id in f ? f : { ...f, [id]: asHoursOf(start.schedule.find((r) => r.id === id)!) }));
    const write = withRow(entity, start.id, id, (r) => ({ ...r, time }));
    if (gesture) onChange(write); else commit('Move Routine Time', write);
  };

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

      <DayStrip
        rows={start.schedule} free={free} asHoursOf={asHoursOf} selected={selected}
        onSelect={showRow} onFill={fill} onMove={move}
      />

      <ol className="space-y-0.5 border-l pl-2" aria-label="Routine">
        {lines.map((line) => line.row ? (
          <RoutineRow
            key={line.row.id} row={line.row} startPlace={start.place} book={book} connected={connected}
            asHours={asHoursOf(line.row)} onAsHours={(hours) => setFormats((f) => ({ ...f, [line.row.id]: hours }))}
            selected={selected === line.row.id} onSelect={() => selectRow(line.row.id)}
            rowRef={(el) => { if (el) rowEls.current.set(line.row.id, el); else rowEls.current.delete(line.row.id); }}
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
            {/* Free time has no row to lock, so locking it writes one: a locked All-day Stay under the timed rows. */}
            <Tip tip="Unlocked: can be called over and follow the player">
              <button
                type="button" className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Lock Free Time"
                onClick={() => {
                  const added = withLockedRest(entity, start.id, randomUUID);
                  commit('Lock Free Time', added.entity);
                  scrollTo.current = added.rowId;
                  selectRow(added.rowId);
                }}
              >
                <LockOpen className="h-4 w-4" />
              </button>
            </Tip>
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
