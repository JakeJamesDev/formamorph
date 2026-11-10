import { useMemo } from 'react';
import { Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tip } from '@/components/ui/tooltip';
import { Hint } from '@/components/ui/typography';
import { presenceLines } from '@/lib/locationPresenceReasons';
import type { Entity } from '@/types';

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The Entities Here list on a location's Presence tab: every entity that can be at this location, one line each
 * with its reasons, and a button that opens that entity's Routine tab. Read-only, because an Individual's place
 * belongs to a row with a time and an action, and this tab cannot say which row.
 */
export default function LocationEntitiesHere({ locationId, entities, labelOf, onOpenRoutine }: {
  locationId: string;
  /** The cast, in the order the tab lists it. */
  entities: Entity[];
  labelOf: (entity: Entity) => string;
  onOpenRoutine?: (entityId: string) => void;
}) {
  const lines = useMemo(() => presenceLines(locationId, entities), [locationId, entities]);

  return (
    <div className="space-y-2" data-testid="entities-here">
      <Label className="block">Entities Here</Label>
      <Hint>Lists each entity that can be here, and why</Hint>
      {lines.length === 0 && <Hint>No entity can be here</Hint>}
      {lines.map(({ entity, reasons }) => {
        const label = labelOf(entity);
        return (
          <div key={entity.id} className="flex items-center gap-2 rounded-md border p-2">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{label}</div>
              <Hint>{capitalized(reasons.join(', '))}</Hint>
            </div>
            {onOpenRoutine && (
              <Tip tip={`Open ${label}’s Routine`}>
                <Button variant="ghost" size="icon" className="shrink-0" aria-label={`Open ${label}’s Routine`} onClick={() => onOpenRoutine(entity.id)}>
                  <Route className="h-4 w-4" />
                </Button>
              </Tip>
            )}
          </div>
        );
      })}
    </div>
  );
}
