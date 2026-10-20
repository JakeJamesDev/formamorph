import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OptionSwitcher } from '@/components/SettingsRows';
import { isEverywhere, movementOptions, withMovement, withPresence, type MovementChoice } from '@/lib/entityPresence';
import { fieldFrame } from '@/lib/historyField';
import type { Entity } from '@/types';

const MOVEMENT_LABEL: Record<MovementChoice, string> = {
  free: 'Free',
  stays: 'Stays Put',
  between: 'Moves Between Its Locations',
  follow: 'Can Follow the Player',
};

const MOVEMENT_HELP: Record<MovementChoice, string> = {
  free: 'Keeps no position. It appears at every listed location and costs no AI request.',
  stays: 'Never leaves its location. Costs no AI request.',
  between: 'Moves one Connection at a time, only between its own locations',
  follow: 'Joins the player when the AI decides, then travels with them until it stays behind',
};

const FOLLOW_EVERYWHERE_HELP = 'Adds a new entity with this name that travels with the player. This one stays at every listed location.';

const PRESENCE_OPTIONS = [
  { value: 'everywhere', label: 'Everywhere Listed' },
  { value: 'random', label: 'One, at Random' },
] as const;

const PRESENCE_HELP = {
  everywhere: 'Puts it at every listed location at once',
  random: 'Places it at one of its locations at random in each new game',
} as const;

/** One entity's Presence and Movement, as a row of the location's cast. */
function EntityHereRow({ entity, label, onChange }: { entity: Entity; label: string; onChange: (next: Entity) => void }) {
  if (entity.customPersona) {
    return (
      <div className="space-y-1 rounded-md border p-2">
        <span className="block truncate font-medium">{label}</span>
        <Hint>Moves with the player, so <b>Presence</b>, <b>Movement</b> and <b>Known In</b> don’t apply</Hint>
      </div>
    );
  }
  const listed = entity.locations?.length ?? 0;
  const presence = entity.presence === 'random' ? 'random' : 'everywhere';
  const movement: MovementChoice = entity.movement ?? 'free';
  const movementHelp = movement === 'follow' && isEverywhere(entity) ? FOLLOW_EVERYWHERE_HELP : MOVEMENT_HELP[movement];
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
      <Hint>{movementHelp}</Hint>
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
      {entity.persona && <Hint>Ignored while the player plays this entity</Hint>}
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
