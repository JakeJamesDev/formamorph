import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowLeftRight, Plus, X } from 'lucide-react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { describePlaceholders } from '@/lib/placeholders';
import {
  connectionTargets,
  connectionsAt,
  createConnection,
  withDirection,
  withHint,
  type ConnectionDirection,
} from '@/lib/connectionEditing';
import type { GameLocation } from '@/types';
import { Tip } from '@/components/ui/tooltip';

/** The direction control's options in the order they're offered, worded from the panel that's open. */
const DIRECTIONS: { value: ConnectionDirection; label: string }[] = [
  { value: 'two-way', label: 'Two-Way' },
  { value: 'outgoing', label: 'Outgoing' },
  { value: 'incoming', label: 'Incoming' },
];

const DIRECTION_ICONS: Record<ConnectionDirection, typeof ArrowRight> = {
  'two-way': ArrowLeftRight,
  outgoing: ArrowRight,
  incoming: ArrowLeft,
};

/**
 * The Connections on one location's editor panel: add, retarget direction, hint, delete.
 *
 * A Connection is one world record shown from whichever end the author opened, so the same link appears on
 * both locations and every edit here writes the single record through the editor's own path. Where a
 * Connection exists, it is the pair's whole travel rule — which is why the direction control offers the
 * one-way orientations rather than hiding a flip behind a second gesture.
 */
const LocationConnections = ({ location }: { location: GameLocation }) => {
  const { locations, connections, addConnection, updateConnection, removeConnection, placeholders } = useGameData();
  const [target, setTarget] = useState('');

  const nameOf = (id: string) => {
    const found = locations.find((l) => l.id === id);
    return found ? describePlaceholders(found.name, placeholders) : 'Unknown Location';
  };

  const views = useMemo(() => connectionsAt(location.id, connections), [location.id, connections]);
  const targets = useMemo(
    () => connectionTargets(location.id, locations, connections),
    [location.id, locations, connections],
  );

  const handleAdd = () => {
    if (!target) return;
    addConnection(createConnection(location.id, target));
    setTarget('');
  };

  return (
    <div className="space-y-2">
      <Label className="block">Connections</Label>
      <p className="text-helper text-muted-foreground">
        A Connection is the whole travel rule for its pair — locations with none still reach their parent,
        children, and siblings for free.
      </p>
      {views.map(({ connection, partnerId, direction }) => {
        const Icon = DIRECTION_ICONS[direction];
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
            <ToggleGroup
              type="single"
              className="w-full"
              value={direction}
              aria-label={`Direction of the Connection to ${partnerName}`}
              // A single ToggleGroup clears its value when the active item is clicked again; a Connection
              // always runs some direction, so an empty result is ignored rather than stored.
              onValueChange={(v) => {
                if (v) updateConnection(withDirection(connection, location.id, v as ConnectionDirection));
              }}
            >
              {DIRECTIONS.map((d) => (
                <ToggleGroupItem key={d.value} value={d.value} className="flex-1">{d.label}</ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Input
              value={connection.aiHint || ''}
              onChange={(e) => updateConnection(withHint(connection, e.target.value))}
              placeholder="Travel Hint, e.g. through the shimmering portal"
              aria-label={`Travel Hint for the Connection to ${partnerName}`}
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
            {targets.map((l) => (
              <SelectItem key={l.id} value={l.id}>{describePlaceholders(l.name, placeholders)}</SelectItem>
            ))}
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
