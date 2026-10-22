import { useEffect, useState } from 'react';
import { Megaphone, TriangleAlert, X } from 'lucide-react';
import { LocationIcon } from '@/lib/elementIcons';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tip } from '@/components/ui/tooltip';
import { Hint } from '@/components/ui/typography';
import { OptionSwitcher } from '@/components/SettingsRows';
import { knownInOf, movementOptions, withKnownIn, withMovement, withPresence, type MovementChoice } from '@/lib/entityPresence';
import { rangeGap, rangeWarning, type PickMode } from '@/lib/entityPicking';
import {
  KNOWN_IN_HELP, KNOWN_IN_LABEL, MOVEMENT_LABEL, movementHelpFor, PERSONA_IGNORED_HELP,
  PICK_MODE_HELP, PRESENCE_HELP, PRESENCE_OPTIONS, type KnownInChoice,
} from '@/lib/entityPresenceCopy';
import { fieldFrame } from '@/lib/historyField';
import PersonaPresenceHint from '@/managers/PersonaPresenceHint';
import type { Connection, Entity, GameLocation } from '@/types';

/** The entity the canvas is picking for, and what a click on a location writes. */
export interface PickState {
  entityId: string;
  mode: PickMode;
}

const MODES = [
  { value: 'locations', label: 'Locations', Icon: LocationIcon },
  { value: 'knownIn', label: 'Known In', Icon: Megaphone },
] as const;

const KNOWN_IN_CHOICES: KnownInChoice[] = ['nearby', 'nowhere', 'picked'];

/** Presence, Movement, the range warning and Known In of one entity. */
function PickFields({ entity, label, locationName, locations, connections, mode, onModeChange, onChange }: {
  entity: Entity;
  label: string;
  locationName: (id: string) => string;
  locations: GameLocation[];
  connections: Connection[];
  mode: PickMode;
  onModeChange: (mode: PickMode) => void;
  onChange: (next: Entity) => void;
}) {
  // Picked Locations chosen with no pick yet: nothing is stored until the first click on the canvas.
  const [pickedPending, setPickedPending] = useState(false);
  useEffect(() => { if (mode !== 'knownIn') setPickedPending(false); }, [mode]);
  const knownIn = knownInOf(entity);
  const knownInChoice: KnownInChoice = Array.isArray(knownIn) || (pickedPending && mode === 'knownIn') ? 'picked' : knownIn;
  const presence = entity.presence === 'random' ? 'random' : 'everywhere';
  const movement: MovementChoice = entity.movement ?? 'free';
  const gap = rangeGap(entity, locations, connections);

  const chooseKnownIn = (choice: KnownInChoice) => {
    if (choice === 'picked') {
      setPickedPending(true);
      onModeChange('knownIn');
      return;
    }
    setPickedPending(false);
    onChange(withKnownIn(entity, choice));
  };

  return (
    <>
      {(entity.locations?.length ?? 0) > 1 && (
        <div className="space-y-1.5" {...fieldFrame('entities', entity.id, 'presence')}>
          <Label>Presence</Label>
          <OptionSwitcher
            ariaLabel="Presence"
            value={presence}
            onChange={(v) => onChange(withPresence(entity, v === 'random' ? 'random' : undefined))}
            options={PRESENCE_OPTIONS}
          />
          <Hint>{PRESENCE_HELP[presence]}</Hint>
        </div>
      )}
      <div className="space-y-1.5" {...fieldFrame('entities', entity.id, 'movement')}>
        <Label>Movement</Label>
        <Select value={movement} onValueChange={(v) => onChange(withMovement(entity, v as MovementChoice))}>
          <SelectTrigger aria-label="Movement"><SelectValue /></SelectTrigger>
          <SelectContent>
            {movementOptions(entity).map((m) => <SelectItem key={m} value={m}>{MOVEMENT_LABEL[m]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Hint>{movementHelpFor(entity)}</Hint>
        {entity.persona && <Hint>{PERSONA_IGNORED_HELP}</Hint>}
      </div>
      {gap && (
        <p role="status" className="flex items-start gap-1 text-helper text-warning">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {rangeWarning(label, locationName(gap.from), gap.unreachable.map(locationName))}
        </p>
      )}
      <div className="space-y-1.5" {...fieldFrame('entities', entity.id, 'knownIn')}>
        <Label>Known In</Label>
        <Select value={knownInChoice} onValueChange={(v) => chooseKnownIn(v as KnownInChoice)}>
          <SelectTrigger aria-label="Known In"><SelectValue /></SelectTrigger>
          <SelectContent>
            {KNOWN_IN_CHOICES.map((c) => <SelectItem key={c} value={c}>{KNOWN_IN_LABEL[c]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Hint>{KNOWN_IN_HELP[knownInChoice]}</Hint>
      </div>
    </>
  );
}

/**
 * The full-screen canvas's entity card: which entity the canvas picks for, what a click writes, and that
 * entity's Presence, Movement and Known In.
 */
export default function EntityPickCard({
  entities, entityLabel, locationName, locations, connections, picking, onPickingChange, onChange,
}: {
  entities: Entity[];
  entityLabel: (entity: Entity) => string;
  locationName: (id: string) => string;
  locations: GameLocation[];
  connections: Connection[];
  picking: PickState | null;
  onPickingChange: (next: PickState | null) => void;
  onChange: (next: Entity) => void;
}) {
  const entity = picking ? entities.find((e) => e.id === picking.entityId) : undefined;
  const mode = picking?.mode ?? 'locations';
  return (
    <div data-testid="entity-pick-card" className="space-y-3 rounded-md border bg-card p-3 shadow-md">
      <div className="flex items-center gap-1">
        <Select
          value={entity?.id ?? ''}
          onValueChange={(id) => onPickingChange({ entityId: id, mode: picking?.mode ?? 'locations' })}
        >
          <SelectTrigger aria-label="Entity" className="min-w-0 flex-1">
            <SelectValue placeholder="Choose an entity" />
          </SelectTrigger>
          <SelectContent>
            {entities.map((e) => <SelectItem key={e.id} value={e.id}>{entityLabel(e)}</SelectItem>)}
          </SelectContent>
        </Select>
        {entity && (
          <Tip tip="Close Entity">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onPickingChange(null)}>
              <X className="h-5 w-5" />
            </Button>
          </Tip>
        )}
      </div>
      {entity && (
        <>
          {!entity.customPersona && (
            <ToggleGroup
              type="single"
              className="grid w-full grid-cols-2"
              value={mode}
              aria-label="Pick Mode"
              // A single group clears its value when the active item is clicked again; one mode is always on.
              onValueChange={(v) => { if (v) onPickingChange({ entityId: entity.id, mode: v as PickMode }); }}
            >
              {MODES.map(({ value, label, Icon }) => (
                <ToggleGroupItem key={value} value={value} className="gap-1.5">
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          <Hint>{PICK_MODE_HELP[mode]}</Hint>
          {entity.customPersona
            ? <PersonaPresenceHint />
            : (
              <PickFields
                key={entity.id}
                entity={entity}
                label={entityLabel(entity)}
                locationName={locationName}
                locations={locations}
                connections={connections}
                mode={mode}
                onModeChange={(next) => onPickingChange({ entityId: entity.id, mode: next })}
                onChange={onChange}
              />
            )}
        </>
      )}
    </div>
  );
}
