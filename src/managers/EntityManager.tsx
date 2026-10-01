import { useEffect } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { PanelTabContent, PanelTabs } from '@/components/ui/panel-tabs';
import { EntityDescriptionFields, EntityLocationsField, EntityProfileFields, EntityStartingLocationField } from './EntityFields';
import ScopedPlaceholdersSection from './ScopedPlaceholdersSection';
import EntityTraitsMirror from './EntityTraitsMirror';
import { EntityOpenings } from './OpeningsPanel';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { statCodeName } from '@/lib/statCodeNames';
import { useRenameField } from '@/lib/useCodeRename';
import { withEntityLocations } from '@/lib/entityPresence';
import { customPersonaHeldElsewhere } from '@/lib/customPersona';
import type { Entity, FocusFieldHint } from '@/types';
import { labelPlaceholders } from '@/lib/placementLetters';
import { locationRows } from '@/lib/locationTree';
import { useEditorMode } from '@/lib/editorMode';
import { entityPanelTabsFor, entityTabForField, type EntityPanelTab } from '@/views/entityPanelTabs';

/**
 * Right-panel editor for one entity: the field groups split across Profile, Descriptions, Traits, Openings
 * and Placeholders. The Traits tab is the Traits tab's editor over this entity alone.
 *
 * The panel remounts per entity, so the chosen tab and the open trait and placeholder are the editor's to
 * hold and arrive as props.
 *
 * `focusField` is the search target the find bar just navigated to. A hit on a tab that isn't showing has no
 * field to mark, so the panel opens the owning tab; the same hint the Overview panel takes for its own pair.
 */
const EntityManager = ({
  entity, tab, onTabChange, traitId, onTraitIdChange, placeholderId, onPlaceholderIdChange, onOpenWorldPlaceholder, focusField,
}: {
  entity: Entity;
  tab: EntityPanelTab;
  onTabChange: (tab: EntityPanelTab) => void;
  /** The Traits tab's open trait, group or Link; null shows its list. */
  traitId: string | null;
  onTraitIdChange: (id: string | null) => void;
  /** The Placeholders tab's open row; null shows its list. */
  placeholderId: string | null;
  onPlaceholderIdChange: (id: string | null) => void;
  /** Opens a world placeholder on the editor's Placeholders tab. */
  onOpenWorldPlaceholder: (id: string) => void;
  focusField?: FocusFieldHint | null;
}) => {
  const { updateEntity, entities, locations, placeholders, placementLetters, placeholderOwners } = useGameData();
  const { draft: editingEntity, setDraft, setField: handleChange } = useEditingDraft<Entity>(entity, updateEntity);
  const { advanced } = useEditorMode();
  // An entity that owns placeholders is a node of the `placeholders` map, so renaming it moves the owner
  // segment of every path through it. Its own name can carry chips, so code reads it the way a stat's is read.
  const rename = useRenameField({
    root: 'placeholders',
    value: editingEntity?.name ?? '',
    siblings: entities,
    ownId: entity.id,
    codeNameOf: (name) => statCodeName(name, placeholders),
    subject: { kind: 'entity', id: entity.id },
  });

  // Membership is the entity's own field, so the picker reads and writes it directly. Locations the world
  // no longer has are filtered out of the selection rather than shown as blank rows.
  const selectedLocationIds = (editingEntity?.locations ?? []).filter((id) => locations.some((l) => l.id === id));

  // Written whole rather than through `setField`, so a patch of several fields lands at once and a cleared
  // field drops instead of persisting an empty value.
  const writeWhole = (next: Entity) => {
    setDraft(next);
    updateEntity(next);
  };

  const handleLocationsChange = (ids: string[]) => {
    if (editingEntity) writeWhole(withEntityLocations(editingEntity, ids));
  };

  // Before the reveal, which is a timer behind this render: the field it looks for has to be mounting by
  // then. A key no tab claims leaves the panel where the author put it.
  useEffect(() => {
    const owning = focusField ? entityTabForField(focusField.fieldKey) : null;
    if (owning) onTabChange(owning);
  }, [focusField, onTabChange]);

  if (!editingEntity) return null;

  const groupProps = { value: editingEntity, onChange: handleChange, placeholders, ownerId: entity.id };
  // Read as the tree it is, so a picker presents the hierarchy the way the game's own list does.
  const locationOptions = locationRows(locations).map(({ location, depth }) => ({
    label: labelPlaceholders(location.name, placeholders, { letters: placementLetters, owners: placeholderOwners }),
    value: location.id,
    depth,
  }));
  const tabs = entityPanelTabsFor(advanced);

  return (
    <PanelTabs tabs={tabs} value={tab} onValueChange={onTabChange} stripLabel="Entity Fields" surfaceTabs="worldEditorEntity">

        <PanelTabContent value="profile">
          <EntityProfileFields
            {...groupProps}
            nameHandlers={rename}
            home="world"
            customPersonaHolder={customPersonaHeldElsewhere(entities, entity.id)?.name}
            // Two columns need ~570px, and the pane holding them is not monotonic in viewport width: below
            // `md` it is the full-width detail sheet, at `md` it becomes half the editor. So the second
            // column comes back only where the pane is wide enough — once in the sheet, again at `xl`.
            columnsClassName="sm:grid-cols-[18rem_minmax(0,1fr)] md:grid-cols-1 xl:grid-cols-[18rem_minmax(0,1fr)]"
            locations={(
              <>
                <EntityLocationsField
                  {...groupProps}
                  options={locationOptions}
                  selectedIds={selectedLocationIds}
                  onLocationsChange={handleLocationsChange}
                />
                <EntityStartingLocationField {...groupProps} options={locationOptions} />
              </>
            )}
          />
        </PanelTabContent>

        <PanelTabContent value="descriptions">
          <EntityDescriptionFields {...groupProps} />
        </PanelTabContent>

        {advanced && (
          <PanelTabContent value="traits" fill>
            <EntityTraitsMirror entity={entity} selectedId={traitId} onSelect={onTraitIdChange} />
          </PanelTabContent>
        )}

        {advanced && (
          <PanelTabContent value="openings">
            <EntityOpenings
              entity={editingEntity}
              placeholders={placeholders}
              names={{ placeholders, letters: placementLetters, owners: placeholderOwners }}
              onChange={(patch) => writeWhole({ ...editingEntity, ...patch })}
            />
          </PanelTabContent>
        )}

        {advanced && (
          <PanelTabContent value="placeholders" fill>
            <ScopedPlaceholdersSection
              kind="entity"
              ownerId={entity.id}
              selectedId={placeholderId}
              onSelect={onPlaceholderIdChange}
              onOpenWorldPlaceholder={onOpenWorldPlaceholder}
            />
          </PanelTabContent>
        )}
    </PanelTabs>
  );
};

export default EntityManager;
