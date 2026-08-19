import { useGameData } from '../contexts/GameDataContext';
import EntityFields from './EntityFields';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { withEntityLocations } from '@/lib/entityPresence';
import type { Entity } from '@/types';
import { describePlaceholders } from '@/lib/placeholders';
import { locationRows } from '@/lib/locationTree';

const EntityManager = ({ entity }: { entity: Entity }) => {
  const { updateEntity, locations, placeholders } = useGameData();
  const { draft: editingEntity, setDraft, setField: handleChange } = useEditingDraft<Entity>(entity, updateEntity);

  // Membership is the entity's own field, so the picker reads and writes it directly. Locations the world
  // no longer has are filtered out of the selection rather than shown as blank rows.
  const selectedLocationIds = (editingEntity?.locations ?? []).filter((id) => locations.some((l) => l.id === id));

  const handleLocationsChange = (ids: string[]) => {
    if (!editingEntity) return;
    // Written whole rather than through `setField`, so clearing the list drops the field instead of
    // persisting an empty array.
    const next = withEntityLocations(editingEntity, ids);
    setDraft(next);
    updateEntity(next);
  };

  if (!editingEntity) return null;

  return (
    <EntityFields
      value={editingEntity}
      onChange={handleChange}
      placeholders={placeholders}
      // Read as the tree it is, so the picker presents the hierarchy the way the game's own list does.
      locationOptions={locationRows(locations).map(({ location, depth }) => ({
        label: describePlaceholders(location.name, placeholders),
        value: location.id,
        depth,
      }))}
      selectedLocationIds={selectedLocationIds}
      onLocationsChange={handleLocationsChange}
    />
  );
};

export default EntityManager;
