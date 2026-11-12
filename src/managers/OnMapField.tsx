import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import { OptionSwitcher } from '@/components/SettingsRows';
import { fieldFrame } from '@/lib/historyField';
import { ON_MAP_HELP, ON_MAP_OPTIONS, onMapOf, withOnMap } from '@/lib/onMap';
import type { Entity } from '@/types';

/** How the player's map shows an entity. `commit` writes the whole entity under a history label. */
export function OnMapField({ entity, commit }: { entity: Entity; commit: (label: string, next: Entity) => void }) {
  const value = onMapOf(entity);
  return (
    <div className="space-y-1.5" {...fieldFrame('onMap')}>
      <Label>On Map</Label>
      <OptionSwitcher
        ariaLabel="On Map" value={value} options={ON_MAP_OPTIONS}
        onChange={(next) => commit('Change On Map', withOnMap(entity, next))}
      />
      <Hint>{ON_MAP_HELP[value]}</Hint>
    </div>
  );
}
