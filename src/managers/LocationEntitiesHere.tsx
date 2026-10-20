import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OptionSwitcher } from '@/components/SettingsRows';
import { movementOptions, withMovement, withPresence, type MovementChoice } from '@/lib/entityPresence';
import {
  MOVEMENT_LABEL, movementHelpFor, PERSONA_IGNORED_HELP, PRESENCE_HELP, PRESENCE_OPTIONS,
} from '@/lib/entityPresenceCopy';
import { fieldFrame } from '@/lib/historyField';
import PersonaPresenceHint from '@/managers/PersonaPresenceHint';
import type { Entity } from '@/types';

/** One entity's Presence and Movement, as a row of the location's cast. */
function EntityHereRow({ entity, label, onChange }: { entity: Entity; label: string; onChange: (next: Entity) => void }) {
  if (entity.customPersona) {
    return (
      <div className="space-y-1 rounded-md border p-2">
        <span className="block truncate font-medium">{label}</span>
        <PersonaPresenceHint />
      </div>
    );
  }
  const listed = entity.locations?.length ?? 0;
  const presence = entity.presence === 'random' ? 'random' : 'everywhere';
  const movement: MovementChoice = entity.movement ?? 'free';
  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        <div {...fieldFrame('entities', entity.id, 'movement')}>
          <Select value={movement} onValueChange={(v) => onChange(withMovement(entity, v as MovementChoice))}>
            <SelectTrigger className="w-60" aria-label={`Movement of ${label}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {movementOptions(entity).map((m) => <SelectItem key={m} value={m}>{MOVEMENT_LABEL[m]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Hint>{movementHelpFor(entity)}</Hint>
      {listed > 1 && (
        <div className="space-y-1" {...fieldFrame('entities', entity.id, 'presence')}>
          <OptionSwitcher
            ariaLabel={`Presence of ${label}`}
            value={presence}
            onChange={(v) => onChange(withPresence(entity, v === 'random' ? 'random' : undefined))}
            options={PRESENCE_OPTIONS}
          />
          <Hint>{PRESENCE_HELP[presence]}</Hint>
        </div>
      )}
      {entity.persona && <Hint>{PERSONA_IGNORED_HELP}</Hint>}
    </div>
  );
}

/** The Entities Here section of a location's Presence tab: each entity at this location, with its
 *  Presence and Movement. */
export default function LocationEntitiesHere({ entities, labelOf, onChange }: {
  /** The entities at this location, in the order the tab lists them. */
  entities: Entity[];
  labelOf: (entity: Entity) => string;
  onChange: (next: Entity) => void;
}) {
  if (entities.length === 0) return null;
  return (
    <div className="space-y-2">
      <Label>Entities Here</Label>
      {entities.map((entity) => (
        <EntityHereRow key={entity.id} entity={entity} label={labelOf(entity)} onChange={onChange} />
      ))}
    </div>
  );
}
