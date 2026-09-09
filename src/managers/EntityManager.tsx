import { useGameData } from '../contexts/GameDataContext';
import {
  EntityDescriptionFields,
  EntityGalleryField,
  EntityIdentityFields,
  EntityLocationsField,
  EntityModelField,
} from './EntityFields';
import ScopedPlaceholdersSection from './ScopedPlaceholdersSection';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { withEntityLocations } from '@/lib/entityPresence';
import type { Entity } from '@/types';
import { labelPlaceholders } from '@/lib/placementLetters';
import { locationRows } from '@/lib/locationTree';

const EntityManager = ({ entity }: { entity: Entity }) => {
  const { updateEntity, locations, placeholders, placementLetters, placeholderOwners } = useGameData();
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

  const groupProps = { value: editingEntity, onChange: handleChange, placeholders, ownerId: entity.id };

  return (
    <div className="space-y-4">
      <EntityIdentityFields {...groupProps} />
      <EntityDescriptionFields {...groupProps} />
      <EntityLocationsField
        {...groupProps}
        // Read as the tree it is, so the picker presents the hierarchy the way the game's own list does.
        options={locationRows(locations).map(({ location, depth }) => ({
          label: labelPlaceholders(location.name, placeholders, { letters: placementLetters, owners: placeholderOwners }),
          value: location.id,
          depth,
        }))}
        selectedIds={selectedLocationIds}
        onLocationsChange={handleLocationsChange}
      />
      <EntityGalleryField {...groupProps} />
      <EntityModelField {...groupProps} />
      <ScopedPlaceholdersSection kind="entity" ownerId={entity.id} />
    </div>
  );
};

export default EntityManager;
