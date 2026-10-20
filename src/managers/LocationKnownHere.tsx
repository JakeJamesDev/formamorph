import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SelectOptions } from '@/components/SelectOptions';
import { Tip } from '@/components/ui/tooltip';
import { knownHere, toggleKnownInPick } from '@/lib/entityPresence';
import { fieldFrame } from '@/lib/historyField';
import type { Entity, GameLocation } from '@/types';

/** The Known Here section of a location's Presence tab: each entity known at this location through its Known In
 *  picks, with **Remove** on this location's own picks, and a select that adds this location to another one's. */
export default function LocationKnownHere({ location, locations, entities, labelOf, locationLabel, onChange }: {
  location: GameLocation;
  locations: GameLocation[];
  /** The cast, in the order the tab lists it. */
  entities: Entity[];
  labelOf: (entity: Entity) => string;
  locationLabel: (id: string) => string;
  onChange: (next: Entity) => void;
}) {
  const rows = useMemo(() => knownHere(location.id, locations, entities), [location.id, locations, entities]);
  const addable = useMemo(() => {
    const known = new Set(rows.map((row) => row.entity.id));
    return entities.filter((e) => !e.customPersona && !known.has(e.id));
  }, [rows, entities]);

  return (
    <div className="space-y-2">
      <Label className="block">Known Here</Label>
      <Hint>Sends these entities’ summaries to the AI anywhere inside this location. They aren’t here.</Hint>
      {rows.map(({ entity, via }) => {
        const label = labelOf(entity);
        return (
          <div key={entity.id} className="flex items-center gap-2 rounded-md border p-2" {...fieldFrame('entities', entity.id, 'knownIn')}>
            <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
            {via === null ? (
              <Tip tip={`Removes this location from ${label}’s Known In`}>
                <Button variant="ghost" size="sm" className="shrink-0" onClick={() => onChange(toggleKnownInPick(entity, location.id))}>
                  Remove
                </Button>
              </Tip>
            ) : (
              <Hint className="shrink-0">Known in {locationLabel(via)}</Hint>
            )}
          </div>
        );
      })}
      <div {...fieldFrame('knownHere')}>
        <Select
          value=""
          onValueChange={(id) => {
            const entity = addable.find((e) => e.id === id);
            if (entity) onChange(toggleKnownInPick(entity, location.id));
          }}
          disabled={addable.length === 0}
        >
          <SelectTrigger aria-label="Make an Entity Known Here">
            <SelectValue placeholder="Make an entity known here" />
          </SelectTrigger>
          <SelectContent>
            <SelectOptions options={addable.map((e) => ({ value: e.id, label: labelOf(e) }))} />
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
