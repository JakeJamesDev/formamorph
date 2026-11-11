import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tip } from '@/components/ui/tooltip';
import { HintInfo } from '@/components/SettingsRows';
import { DistanceMark } from '@/components/editor/DistanceMark';
import { TravelHintPair, type TravelHintFocus, type TravelHintLeg } from '@/components/editor/TravelHintPair';
import { TRAVEL_ICONS, type TravelChoiceLabel } from '@/components/editor/connectionTravel';
import { directionFrom, withDirection, type ConnectionDirection } from '@/lib/connectionEditing';
import { distanceOf, withDistance, type ConnectionDistance } from '@/lib/locationCanvas';
import { fieldFrame } from '@/lib/historyField';
import type { Connection, LegKey, Placeholder } from '@/types';

const DIRECTIONS: ConnectionDirection[] = ['two-way', 'outgoing', 'incoming'];
const DISTANCES: ConnectionDistance[] = ['nearby', 'far'];

const DISTANCE_INFO = [
  'Sets what the AI knows about the entities at the other end.',
  '',
  '- **Nearby:** The AI knows which entities are there. When the narration names a Unique entity there, it can come over to the player.',
  '- **Far:** The AI knows nothing about the entities there, and no entity there comes over.',
  '',
  'Travel works the same at both distances.',
].join('\n');

/**
 * One Connection's Travel, Distance and Travel Hints. Every control hands back the rewritten record.
 * Travel reads from `viewpoint`, the end the surface stands at.
 */
export function ConnectionFields({ connection, viewpoint, travelLabels, groupNames, legs, idPrefix, placeholders, onChange, focus }: {
  connection: Connection;
  viewpoint: string;
  travelLabels: Record<ConnectionDirection, TravelChoiceLabel>;
  /** The accessible names of the Travel and Distance controls, which tell one Connection's controls from another's. */
  groupNames: { travel: string; distance: string };
  /** The hint boxes, in display order. */
  legs: TravelHintLeg[];
  idPrefix: string;
  placeholders: Placeholder[];
  /** `typedLeg` names the hint box a keystroke went into. */
  onChange: (next: Connection, typedLeg?: LegKey) => void;
  focus?: TravelHintFocus | null;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="block">Travel</Label>
        <ToggleGroup
          type="single"
          className="grid w-full grid-cols-3"
          value={directionFrom(connection, viewpoint)}
          aria-label={groupNames.travel}
          {...fieldFrame('connections', connection.id, 'direction')}
          // Re-clicking the active choice empties a single ToggleGroup; a Connection always runs some way.
          onValueChange={(v) => { if (v) onChange(withDirection(connection, viewpoint, v as ConnectionDirection)); }}
        >
          {DIRECTIONS.map((value) => {
            const Icon = TRAVEL_ICONS[value];
            const label = travelLabels[value];
            if ('tip' in label) {
              return (
                <Tip key={value} tip={label.tip}>
                  <ToggleGroupItem value={value} className="px-1">
                    <Icon className="h-4 w-4 shrink-0" />
                  </ToggleGroupItem>
                </Tip>
              );
            }
            return (
              <ToggleGroupItem key={value} value={value} className="min-w-0 gap-1 px-1">
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate text-helper">{label.word}</span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>
      <div className="space-y-1">
        <Label className="flex items-center gap-1">Distance <HintInfo>{DISTANCE_INFO}</HintInfo></Label>
        <ToggleGroup
          type="single"
          // The width of two Travel choices plus the group's padding, so the choices sit under the first two.
          className="grid w-[calc((200%_+_0.5rem)_/_3)] grid-cols-2"
          value={distanceOf(connection)}
          aria-label={groupNames.distance}
          {...fieldFrame('connections', connection.id, 'distance')}
          onValueChange={(v) => { if (v) onChange(withDistance(connection, v as ConnectionDistance)); }}
        >
          {DISTANCES.map((value) => (
            <ToggleGroupItem key={value} value={value} className="min-w-0 px-1">
              <DistanceMark distance={value} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <TravelHintPair
        connection={connection}
        legs={legs}
        idPrefix={idPrefix}
        placeholders={placeholders}
        onChange={onChange}
        focus={focus}
      />
    </div>
  );
}
