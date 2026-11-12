import { useEffect, useMemo, useRef, useState } from 'react';
import { Coffee, LockOpen, Plus, Trash2, X } from 'lucide-react';
import { LocationIcon } from '@/lib/elementIcons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tip } from '@/components/ui/tooltip';
import { Hint, Meta } from '@/components/ui/typography';
import { HereMark } from '@/components/HereMark';
import { WorldInput } from '@/components/editor/WorldField';
import { OptionSwitcher } from '@/components/SettingsRows';
import { CHIP_BASE } from '@/components/Chip';
import { useGameData } from '@/contexts/GameDataContext';
import { useWorldHistoryStep } from '@/contexts/worldRecorder';
import { chanceChipStyle, relativeChance } from '@/lib/chanceColor';
import { traversableOf, withBeginsFollowing, withGenericStart, withKind, withoutGenericStart, withStartPlace } from '@/lib/entityKind';
import { namedPlacesOf, withMembership } from '@/lib/entityPlaces';
import { fieldFrame } from '@/lib/historyField';
import { rowNamesLocation, startNamesLocation } from '@/lib/hereMarks';
import { holderOf, locationRows } from '@/lib/locationTree';
import { labelPlaceholders } from '@/lib/placementLetters';
import { startReach } from '@/lib/positionEngine';
import {
  rowPlaceOf, withLockedRest, withNewRow, withNewStart, withoutRow, withoutStart, withRow, withRowAt, withStart,
} from '@/lib/routineEditing';
import { CLEARS_ROUTINE_SELECTION, KEEPS_ROUTINE_SELECTION, useRoutineSelection } from '@/lib/routineSelection';
import {
  chancePercent, dayFull, freeRanges, onDaypartEdges, rangeText, toStrip, toWeight, type FreeRange,
} from '@/lib/routineTime';
import { cn } from '@/lib/utils';
import { randomUUID } from '@/lib/uuid';
import { MINUTES_PER_DAY } from '@/lib/gameClock';
import { PLAYER_START, type Connection, type Entity, type EntityKind, type EntityStart, type GameLocation, type ScheduleRow, type Traversable } from '@/types';
import { OnMapField } from '@/managers/OnMapField';
import { DayStrip, STRIP_PART } from './DayStrip';
import { RoutineRow } from './RoutineRow';
import { ACTIONS } from './routineActions';
import { LocationPicker, PLAYER_START_NAME, Token, TOKEN_CLASS, type PlaceBook } from './RoutineFields';

const KIND_OPTIONS = [
  { value: 'unique', label: 'Unique' },
  { value: 'generic', label: 'Generic' },
] as const;

const KIND_HINTS: Record<EntityKind, string> = {
  unique: 'Places one character at one of the starts below',
  generic: 'Places one of this type of character at every start below',
};

/** What several Starts mean, by kind. */
const STARTS_HINTS: Record<EntityKind, string> = {
  unique: 'Picks one start at random in each new game',
  generic: 'Runs every start at the same time, each on its own routine',
};

/** The fields a kind edits. A Generic entity keeps weight, Strict and Traversable in its data but hides them. */
type KindFields = { chance: boolean; locks: boolean; canAlsoGo: boolean };
const KIND_FIELDS: Record<EntityKind, KindFields> = {
  unique: { chance: true, locks: true, canAlsoGo: true },
  generic: { chance: false, locks: false, canAlsoGo: false },
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

// A Routine edit touches one entity, so its undo returns to where the author made it.
const KEEP_ORIGIN = { keepOrigin: true };

/** The world's locations as picker rows and display names, placeholders labeled. */
export function usePlaceBook(): PlaceBook {
  const { locations, placeholders, placementLetters, placeholderOwners } = useGameData();
  return useMemo<PlaceBook>(() => {
    const names = { letters: placementLetters, owners: placeholderOwners };
    const nameOf = (id: string) => (id === PLAYER_START
      ? PLAYER_START_NAME
      : labelPlaceholders(locations.find((l) => l.id === id)?.name ?? '', placeholders, names) || 'Unnamed Location');
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
}

/** Where an entity stands and how it moves: the routine fields of a world entity. Writes the whole entity. */
export function RoutineTab({ entity, onChange, hereMark }: {
  entity: Entity; onChange: (next: Entity) => void;
  /** The location whose Presence tab hosts this editor: what names it gets a mark. Without it nothing is marked. */
  hereMark?: string;
}) {
  const { locations, connections } = useGameData();
  const step = useWorldHistoryStep(KEEP_ORIGIN);
  const commit = (label: string, next: Entity) => step(label, () => onChange(next));
  const book = usePlaceBook();

  // An entity with no kind yet edits as a new Unique entity; its first write stores the kind.
  const kinded = useMemo(() => (entity.kind ? entity : withKind(entity, 'unique', randomUUID)), [entity]);
  // A custom persona moves with the player: it keeps only its locations, with no placement or routine.
  if (entity.customPersona) return <PersonaLocations entity={entity} book={book} commit={commit} />;
  const kind: EntityKind = entity.kind ?? 'unique';

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
      <OnMapField entity={entity} commit={commit} />
      <EntityRoutine
        entity={kinded} kind={kind} book={book} connections={connections} locations={locations} commit={commit} onChange={onChange}
        hereMark={hereMark}
      />
    </div>
  );
}

/** The Locations field: a pick list over every location. */
function PlaceList({ entity, book, selected, onChange }: {
  entity: Entity; book: PlaceBook; selected: string[]; onChange: (ids: string[]) => void;
}) {
  const options = book.rowsOf(book.all).map((r) => ({ label: r.name, value: r.value, depth: r.breadcrumb?.length ?? 0 }));
  return (
    <div className="space-y-1.5" {...fieldFrame('locations')}>
      <Label>Locations</Label>
      {entity.persona === true && <Hint>Lets the player start at any of these as this entity</Hint>}
      <MultiSelect
        key={entity.id} options={options} defaultValue={selected.filter((id) => book.all.includes(id))}
        placeholder="Select locations" onValueChange={onChange}
      />
    </div>
  );
}

function PersonaLocations({ entity, book, commit }: { entity: Entity; book: PlaceBook; commit: (label: string, next: Entity) => void }) {
  return (
    <PlaceList
      entity={entity} book={book} selected={namedPlacesOf(entity)}
      onChange={(ids) => commit('Change Locations', withMembership(entity, ids))}
    />
  );
}

/** The Starts, the shown Start's routine and, for a Unique entity, Can Also Go. A Generic entity hides weight, Strict and
 *  Traversable but keeps them in the data. */
function EntityRoutine({ entity, kind, book, locations, connections, commit, onChange, hereMark }: {
  entity: Entity; kind: EntityKind; book: PlaceBook; locations: readonly GameLocation[]; connections: readonly Connection[];
  commit: (label: string, next: Entity) => void; onChange: (next: Entity) => void; hereMark?: string;
}) {
  const generic = kind === 'generic';
  const fields = KIND_FIELDS[kind];
  const starts = entity.starts ?? [];
  const { startId, showStart } = useRoutineSelection(entity.id);
  const start = starts.find((s) => s.id === startId) ?? starts[0];
  const weights = starts.map((s) => s.weight);
  const addStart = (place: string) => {
    const next = generic ? withGenericStart(entity, place, randomUUID) : withNewStart(entity, place, randomUUID);
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
              {hereMark && startNamesLocation(s, hereMark) && <HereMark locationName={book.nameOf(hereMark)} />}
              {fields.chance && starts.length > 1 && (
                <span className={CHIP_BASE} style={chanceChipStyle(relativeChance(s.weight, weights))}>{chancePercent(s.weight, weights)}%</span>
              )}
            </button>
          ))}
          <LocationPicker book={book} places={book.all} playerStart onPick={addStart} trigger={addTrigger(starts.length ? '' : 'Add Start')} />
        </div>
        {starts.length > 1 && <Hint>{STARTS_HINTS[kind]}</Hint>}
        {entity.persona === true && <Hint>Lets the player start at any start location as this entity</Hint>}
        {!start && <Hint>Pick the location it starts at</Hint>}
      </div>
      {start && (
        <StartRoutine
          entity={entity} kind={kind} start={start} weights={weights} book={book} commit={commit} onChange={onChange} hereMark={hereMark}
          connected={[...startReach(start.place, { locations, connections })]}
          onDeleted={() => showStart(null)}
        />
      )}
      {fields.canAlsoGo && (
        <TraversableField
          value={traversableOf(entity)} book={book} hereMark={hereMark}
          onChange={(traversable) => commit('Change Can Also Go', { ...entity, traversable })}
        />
      )}
    </>
  );
}

function StartRoutine({ entity, kind, start, weights, book, connected, commit, onChange, onDeleted, hereMark }: {
  entity: Entity; kind: EntityKind; start: EntityStart; weights: number[]; book: PlaceBook; connected: string[];
  commit: (label: string, next: Entity) => void; onChange: (next: Entity) => void; onDeleted: () => void; hereMark?: string;
}) {
  const many = (entity.starts?.length ?? 0) > 1;
  const fields = KIND_FIELDS[kind];
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
  // A row needs a real location, so one added at the player's starting location begins at the first.
  const firstPlace = book.all[0];

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
    const added = withRowAt(entity, start.id, time, randomUUID, firstPlace);
    if (!added.rowId) return;
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
          book={book} places={book.all} value={start.place} playerStart
          onPick={(place) => commit('Change Start Location', withStart(entity, start.id, (s) => withStartPlace(s, place)))}
          trigger={(
            <button type="button" aria-label={`Start location: ${startName}`} className={TOKEN_CLASS}>
              {startName}
            </button>
          )}
        />
        {many && fields.chance && (
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
              onClick={() => {
                commit('Delete Start', kind === 'generic' ? withoutGenericStart(entity, start.id) : withoutStart(entity, start.id));
                onDeleted();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </Tip>
        )}
      </p>
      {kind === 'unique' && start.place === PLAYER_START && (
        <div className="space-y-0.5" {...fieldFrame('starts', start.id, 'beginsFollowing')}>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`follows-${start.id}`} checked={!!start.beginsFollowing}
              onCheckedChange={(on) => commit('Change Follows the Player', withStart(entity, start.id, (s) => withBeginsFollowing(s, on === true)))}
            />
            <Label htmlFor={`follows-${start.id}`}>Follows the Player</Label>
          </div>
          <Hint>Travels with the player from the first turn</Hint>
        </div>
      )}

      <DayStrip
        rows={start.schedule} free={free} lockable={fields.locks} asHoursOf={asHoursOf} selected={selected}
        onSelect={showRow} onFill={fill} onMove={move}
      />

      <ol className="space-y-0.5 border-l pl-2" aria-label="Routine">
        {lines.map((line) => line.row ? (
          <RoutineRow
            key={line.row.id} row={line.row} startPlace={rowPlaceOf(start, firstPlace) ?? start.place} book={book} connected={connected} lockable={fields.locks}
            here={hereMark && rowNamesLocation(line.row, hereMark) ? book.nameOf(hereMark) : undefined}
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
            {fields.locks && (
              <Tip tip="Unlocked: can be called over and follow the player">
                <button
                  type="button" className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Lock Free Time"
                  onClick={() => {
                    const added = withLockedRest(entity, start.id, randomUUID, firstPlace);
                    if (!added.rowId) return;
                    commit('Lock Free Time', added.entity);
                    scrollTo.current = added.rowId;
                    selectRow(added.rowId);
                  }}
                >
                  <LockOpen className="h-4 w-4" />
                </button>
              </Tip>
            )}
            <span>{line.free.wholeDay ? 'All day' : rangeText({ start: line.free.start, end: line.free.end % MINUTES_PER_DAY })}, stays at {startName}.</span>
          </li>
        ))}
        {free.length === 0 && <li className="px-1 text-label italic leading-7 text-muted-foreground">Busy all day.</li>}
      </ol>

      <div className="flex flex-wrap items-center gap-1">
        {ACTIONS.map(({ value, label, Icon }) => (
          <Button
            key={value} variant="outline" size="sm" className="gap-1" disabled={full} aria-label={`Add ${label}`}
            onClick={() => commit('Add Routine Row', withNewRow(entity, start.id, value, randomUUID, firstPlace))}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /><Icon className="h-4 w-4" aria-hidden />{label}
          </Button>
        ))}
        {full && <Meta>Shorten a row to add another</Meta>}
      </div>
    </div>
  );
}

function TraversableField({ value, book, onChange, hereMark }: {
  value: Traversable; book: PlaceBook; onChange: (next: Traversable) => void; hereMark?: string;
}) {
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
              {id === hereMark && <HereMark locationName={book.nameOf(id)} />}
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
