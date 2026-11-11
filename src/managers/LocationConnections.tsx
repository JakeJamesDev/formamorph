import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SelectOptions } from '@/components/SelectOptions';
import { labelPlaceholders } from '@/lib/placementLetters';
import {
  connectionTargets,
  connectionsAt,
  createConnection,
  legFrom,
} from '@/lib/connectionEditing';
import { otherLeg } from '@/lib/locationGraph';
import type { Connection, GameLocation, LegKey } from '@/types';
import { Tip } from '@/components/ui/tooltip';
import { ConnectionFields } from '@/components/editor/ConnectionFields';
import { PANEL_TRAVEL_LABELS, TRAVEL_ICONS } from '@/components/editor/connectionTravel';

/** The legs a Connection has, seen from `locationId`: the trip leaving first, then the trip arriving. */
function legsAt(connection: Connection, locationId: string): { key: LegKey; word: 'To' | 'From' }[] {
  const out = legFrom(connection, locationId);
  const back = otherLeg(out);
  return [
    ...(connection[out] ? [{ key: out, word: 'To' as const }] : []),
    ...(connection[back] ? [{ key: back, word: 'From' as const }] : []),
  ];
}

/**
 * The Connections on one location's editor panel: add, set Travel, Distance and hints, delete.
 *
 * A Connection is one world record shown from whichever end the author opened, so the same link appears on
 * both locations and every edit here writes the single record through the editor's own path.
 */
const LocationConnections = ({ location }: { location: GameLocation }) => {
  const { locations, connections, addConnection, updateConnection, removeConnection, placeholders, placementLetters, placeholderOwners } = useGameData();
  const [target, setTarget] = useState('');

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

  const handleAdd = () => {
    if (!target) return;
    addConnection(createConnection(location.id, target));
    setTarget('');
  };

  return (
    <div data-tour-anchor="location-connections" className="space-y-2">
      <Label className="block">Connections</Label>
      <Hint>
        Sets the travel rule for a pair of locations. Without one, a location still connects to its parent,
        its children, and its siblings.
      </Hint>
      {views.map(({ connection, partnerId, direction }) => {
        const Icon = TRAVEL_ICONS[direction];
        const partnerName = nameOf(partnerId);
        return (
          <div key={connection.id} className="space-y-2 rounded-md border p-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-grow truncate">{partnerName}</span>
              <Tip tip={`Delete Connection to ${partnerName}`}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => removeConnection(connection.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </Tip>
            </div>
            <ConnectionFields
              connection={connection}
              viewpoint={location.id}
              travelLabels={PANEL_TRAVEL_LABELS}
              groupNames={{ travel: `Travel between here and ${partnerName}`, distance: `Distance to ${partnerName}` }}
              legs={legsAt(connection, location.id).map(({ key, word }) => ({
                key,
                label: `${word} ${partnerName}`,
                name: `Travel Hint ${word.toLowerCase()} ${partnerName}`,
              }))}
              idPrefix={`connection-${connection.id}`}
              placeholders={placeholders}
              onChange={updateConnection}
            />
          </div>
        );
      })}
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
