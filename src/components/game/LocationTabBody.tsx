import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { effectiveDestinations } from '@/lib/locationGraph';
import type { Connection, GameLocation } from '@/types';

const identity = (text: string) => text;

/**
 * The Location tab's body: where the player is, its Player-Facing Description and the places a drawn
 * Connection leads to. Names arrive resolved; `resolveText` resolves the description.
 */
export function LocationTabBody({ location, locations, connections, resolveText = identity, past, onLocationClick }: {
  location: GameLocation | null | undefined;
  locations: GameLocation[];
  connections: Connection[];
  resolveText?: (text: string) => string;
  /** The location of a past turn: named, but not a place to travel from. */
  past?: boolean;
  onLocationClick?: () => void;
}) {
  // The drawn Connections leading out of here, named. Implicit travel is left out, so a world with no
  // Connections shows no section at all.
  const connectedNames = useMemo(() => {
    if (!location) return [];
    const names: string[] = [];
    for (const [id, via] of effectiveDestinations(location.id, locations, connections)) {
      if (via.via !== 'connection') continue;
      const name = locations.find((l) => l.id === id)?.name;
      if (name) names.push(name);
    }
    return names;
  }, [connections, locations, location]);

  return (
    <div className="p-2 flex flex-col gap-4">
      <Button onClick={onLocationClick} disabled={past} className="w-full">
        {past ? 'Location' : 'Current Location'}: {location?.name || 'Unknown'}
      </Button>
      {location && (
        <div className="space-y-2">
          <p className="font-semibold">Description:</p>
          <p className="text-label">{resolveText(location.playerDescription || location.description || '')}</p>
          {connectedNames.length > 0 && (
            <>
              <p className="font-semibold mt-4">Connected Locations:</p>
              <ul className="list-disc list-inside text-label">
                {connectedNames.map((name, index) => (
                  <li key={index}>{name}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
