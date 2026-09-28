import { useEffect } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PanelTabsList } from '@/components/ui/panel-tabs';
import { EntityDescriptionFields, EntityLocationsField, EntityProfileFields, EntityStartingLocationField } from './EntityFields';
import ScopedPlaceholdersSection from './ScopedPlaceholdersSection';
import EntityTraitsSection from './EntityTraitsSection';
import { EntityOpenings } from './OpeningsPanel';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { statCodeName } from '@/lib/statCodeNames';
import { useRenameField } from '@/lib/useCodeRename';
import { withEntityLocations } from '@/lib/entityPresence';
import type { Entity, FocusFieldHint } from '@/types';
import { labelPlaceholders } from '@/lib/placementLetters';
import { locationRows } from '@/lib/locationTree';
import { useEditorMode } from '@/lib/editorMode';
import { entityPanelTabsFor, entityTabFillsPane, entityTabForField, type EntityPanelTab } from '@/views/entityPanelTabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

/**
 * Right-panel editor for one entity: the field groups split across Profile, Descriptions, Traits, Openings
 * and Placeholders. A trait row opens on the Traits tab through `onOpenTrait`.
 *
 * The panel remounts per entity, so the chosen tab is the editor's to hold and arrives as a prop.
 *
 * `focusField` is the search target the find bar just navigated to. A hit on a tab that isn't showing has no
 * field to mark, so the panel opens the owning tab; the same hint the Overview panel takes for its own pair.
 */
const EntityManager = ({ entity, tab, onTabChange, onOpenTrait, focusField }: {
  entity: Entity;
  onOpenTrait?: (id: string) => void;
  tab: EntityPanelTab;
  onTabChange: (tab: EntityPanelTab) => void;
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
  // A filling tab takes the height the host gives it and scrolls inside; the others grow with their fields.
  const fills = entityTabFillsPane(tab);

  return (
    <div className={cn(fills ? 'flex min-h-0 flex-1 flex-col' : 'space-y-4')}>
      <Tabs
        value={tab}
        onValueChange={(v) => onTabChange(v as EntityPanelTab)}
        className={cn(fills ? 'flex min-h-0 flex-1 flex-col gap-4' : 'space-y-4')}
      >
        <PanelTabsList tabs={tabs} stripLabel="Entity Fields" />

        <TabsContent value="profile" className="space-y-4">
          <EntityProfileFields
            {...groupProps}
            nameHandlers={rename}
            home="world"
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
        </TabsContent>

        <TabsContent value="descriptions" className="space-y-4">
          <EntityDescriptionFields {...groupProps} />
        </TabsContent>

        <TabsContent value="traits" className="mt-0 min-h-0 flex-1 flex-col data-[state=active]:flex">
          <ScrollArea className="min-h-0 flex-1">
            <EntityTraitsSection entity={entity} onOpen={(id) => onOpenTrait?.(id)} />
          </ScrollArea>
        </TabsContent>

        {advanced && (
          <TabsContent value="openings">
            <EntityOpenings
              entity={editingEntity}
              placeholders={placeholders}
              onChange={(patch) => writeWhole({ ...editingEntity, ...patch })}
            />
          </TabsContent>
        )}

        {advanced && (
          <TabsContent value="placeholders" className="mt-0 min-h-0 flex-1 flex-col data-[state=active]:flex">
            <ScopedPlaceholdersSection kind="entity" ownerId={entity.id} fill />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default EntityManager;
