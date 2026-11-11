import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/typography';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SelectOptions } from '@/components/SelectOptions';
import { CollapseAllButton } from '@/components/CollapseAllButton';
import { labelPlaceholders } from '@/lib/placementLetters';
import {
  connectionTargets,
  connectionsAt,
  createConnection,
  legFrom,
  travelHintConnectionId,
  type ConnectionView,
} from '@/lib/connectionEditing';
import { distanceOf } from '@/lib/locationCanvas';
import { otherLeg } from '@/lib/locationGraph';
import { cn } from '@/lib/utils';
import type { Connection, FocusFieldHint, GameLocation, LegKey, Placeholder } from '@/types';
import { Tip } from '@/components/ui/tooltip';
import { ConnectionFields } from '@/components/editor/ConnectionFields';
import { DistanceMark } from '@/components/editor/DistanceMark';
import { PANEL_TRAVEL_LABELS, TRAVEL_ICONS, travelLabelText } from '@/components/editor/connectionTravel';

/** A request to open one Connection's row. A new object opens it again. */
export interface ConnectionOpen {
  id: string;
}

/** The legs a Connection has, seen from `locationId`: the trip leaving first, then the trip arriving. */
function legsAt(connection: Connection, locationId: string): { key: LegKey; word: 'To' | 'From' }[] {
  const out = legFrom(connection, locationId);
  const back = otherLeg(out);
  return [
    ...(connection[out] ? [{ key: out, word: 'To' as const }] : []),
    ...(connection[back] ? [{ key: back, word: 'From' as const }] : []),
  ];
}

const without = (ids: ReadonlySet<string>, id: string): ReadonlySet<string> => {
  const next = new Set(ids);
  next.delete(id);
  return next;
};

/** One Connection as a row that folds: the header names it, the open body edits it. */
function ConnectionRow({ view, locationId, partnerName, open, onToggle, onRemove, placeholders, onChange }: {
  view: ConnectionView;
  locationId: string;
  partnerName: string;
  open: boolean;
  onToggle: () => void;
  onRemove: () => void;
  placeholders: Placeholder[];
  onChange: (next: Connection) => void;
}) {
  const { connection, direction } = view;
  const Icon = TRAVEL_ICONS[direction];
  const distance = distanceOf(connection);
  return (
    <div className="rounded-md border bg-card" data-testid="connection-row">
      <div className={cn('flex items-center gap-1.5 px-2 py-1.5', open && 'border-b')}>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          aria-expanded={open}
          aria-label={`${partnerName}, ${travelLabelText(PANEL_TRAVEL_LABELS[direction])}`}
          onClick={onToggle}
        >
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')} />
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 truncate text-label">{partnerName}</span>
        </button>
        <DistanceMark distance={distance} className={distance === 'far' ? 'text-foreground' : 'text-muted-foreground'} />
        <Tip tip={`Delete Connection to ${partnerName}`}>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </Tip>
      </div>
      {open && (
        <div className="p-2">
          <ConnectionFields
            connection={connection}
            viewpoint={locationId}
            travelLabels={PANEL_TRAVEL_LABELS}
            groupNames={{ travel: `Travel between here and ${partnerName}`, distance: `Distance to ${partnerName}` }}
            legs={legsAt(connection, locationId).map(({ key, word }) => ({
              key,
              label: `${word} ${partnerName}`,
              name: `Travel Hint ${word.toLowerCase()} ${partnerName}`,
            }))}
            idPrefix={`connection-${connection.id}`}
            placeholders={placeholders}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
}

/**
 * A location's Connections tab: one folding row per Connection, then the picker that adds one.
 *
 * A Connection is one world record shown from whichever end the author opened, so the same link appears on
 * both locations and every edit here writes the single record through the editor's own path. Every row
 * starts closed; one opens when the author adds it here, or when a search hit or reveal lands in it.
 */
const LocationConnections = ({ location, focusField, openRequest, onOpened }: {
  location: GameLocation;
  /** The find bar's target; a Travel Hint hit opens its row. */
  focusField?: FocusFieldHint | null;
  /** A row to open, from an undo's reveal or the Authoring Tour. */
  openRequest?: ConnectionOpen | null;
  onOpened?: () => void;
}) => {
  const { locations, connections, addConnection, updateConnection, removeConnection, placeholders, placementLetters, placeholderOwners } = useGameData();
  const [target, setTarget] = useState('');
  const searchedId = focusField ? travelHintConnectionId(focusField.fieldKey) : null;
  const [opened, setOpened] = useState<ReadonlySet<string>>(
    () => new Set([searchedId, openRequest?.id].filter((id): id is string => !!id)),
  );
  const open = useCallback((id: string) => setOpened((was) => (was.has(id) ? was : new Set(was).add(id))), []);

  // Keyed on the hint object too: a new one is a new navigation, even to the same box.
  useEffect(() => {
    if (searchedId) open(searchedId);
  }, [focusField, searchedId, open]);

  useEffect(() => {
    if (!openRequest) return;
    open(openRequest.id);
    onOpened?.();
  }, [openRequest, onOpened, open]);

  const nameOf = (id: string) => {
    const found = locations.find((l) => l.id === id);
    return found ? labelPlaceholders(found.name, placeholders, { letters: placementLetters, owners: placeholderOwners }) : 'Unknown Location';
  };

  const views = useMemo(() => connectionsAt(location.id, connections), [location.id, connections]);
  const targets = useMemo(
    () => connectionTargets(location.id, locations, connections),
    [location.id, locations, connections],
  );
  const targetOptions = useMemo(
    () => targets.map((l) => ({ value: l.id, label: labelPlaceholders(l.name, placeholders, { letters: placementLetters, owners: placeholderOwners }) })),
    [targets, placeholders, placementLetters, placeholderOwners],
  );

  const ids = views.map((v) => v.connection.id);
  const anyOpen = ids.some((id) => opened.has(id));
  const toggleAll = () => setOpened(anyOpen ? new Set() : new Set(ids));
  const toggle = (id: string) => setOpened((was) => (was.has(id) ? without(was, id) : new Set(was).add(id)));

  const handleAdd = () => {
    if (!target) return;
    const made = createConnection(location.id, target);
    addConnection(made);
    open(made.id);
    setTarget('');
  };

  // A Connection an undo brings back starts closed, like any row the author did not add here.
  const handleRemove = (id: string) => {
    removeConnection(id);
    setOpened((was) => without(was, id));
  };

  return (
    <div data-tour-anchor="location-connections" className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <Hint>
          Sets the travel rule for a pair of locations. Without one, a location still connects to its parent,
          its children, and its siblings.
        </Hint>
        {views.length > 1 && <CollapseAllButton anyOpen={anyOpen} noun="connections" onClick={toggleAll} />}
      </div>
      {views.length > 0 && (
        <div className="flex flex-col gap-2">
          {views.map((view) => (
            <ConnectionRow
              key={view.connection.id}
              view={view}
              locationId={location.id}
              partnerName={nameOf(view.partnerId)}
              open={opened.has(view.connection.id)}
              onToggle={() => toggle(view.connection.id)}
              onRemove={() => handleRemove(view.connection.id)}
              placeholders={placeholders}
              onChange={updateConnection}
            />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Select value={target} onValueChange={setTarget} disabled={targets.length === 0}>
          <SelectTrigger aria-label="Connect To">
            <SelectValue placeholder={targets.length ? 'Connect to…' : 'No locations left to connect'} />
          </SelectTrigger>
          <SelectContent>
            <SelectOptions options={targetOptions} />
          </SelectContent>
        </Select>
        <Tip tip="Add Connection">
          <Button onClick={handleAdd} disabled={!target} size="icon" className="h-9 w-9 shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </Tip>
      </div>
    </div>
  );
};

export default LocationConnections;
