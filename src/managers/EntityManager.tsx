import { useEffect } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  EntityDescriptionFields,
  EntityIdentityFields,
  EntityImageWidget,
  EntityLocationsField,
  EntityModelField,
} from './EntityFields';
import { ImageGallery, ImageTags } from './ImageTagsField';
import ScopedPlaceholdersSection from './ScopedPlaceholdersSection';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { withEntityLocations } from '@/lib/entityPresence';
import type { Entity } from '@/types';
import { labelPlaceholders } from '@/lib/placementLetters';
import { locationRows } from '@/lib/locationTree';
import { useEditorMode } from '@/lib/editorMode';
import { entityPanelTabsFor, entityTabForField, type EntityPanelTab } from '@/views/entityPanelTabs';
import { ContentLinkHeader } from '@/components/ContentLinkStatus';

/**
 * Right-panel editor for one entity: the field groups split across Profile, Descriptions and Placeholders.
 *
 * The panel remounts per entity, so the chosen tab is the editor's to hold and arrives as a prop. Profile
 * places the picture and its tags in separate columns of one grid, which is why the gallery widget is opened
 * up here rather than drawn as a single box.
 *
 * `focusField` is the search target the find bar just navigated to. A hit on a tab that isn't showing has no
 * field to mark, so the panel opens the owning tab; the same hint the Overview panel takes for its own pair.
 */
const EntityManager = ({ entity, tab, onTabChange, focusField }: {
  entity: Entity;
  tab: EntityPanelTab;
  onTabChange: (tab: EntityPanelTab) => void;
  focusField?: { fieldKey: string } | null;
}) => {
  const { updateEntity, locations, placeholders, placementLetters, placeholderOwners } = useGameData();
  const { draft: editingEntity, setDraft, setField: handleChange } = useEditingDraft<Entity>(entity, updateEntity);
  const { advanced } = useEditorMode();

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

  // Before the reveal, which is a timer behind this render: the field it looks for has to be mounting by
  // then. A key no tab claims leaves the panel where the author put it.
  useEffect(() => {
    const owning = focusField ? entityTabForField(focusField.fieldKey) : null;
    if (owning) onTabChange(owning);
  }, [focusField, onTabChange]);

  if (!editingEntity) return null;

  const groupProps = { value: editingEntity, onChange: handleChange, placeholders, ownerId: entity.id };
  const tabs = entityPanelTabsFor(advanced);

  return (
    <div className="space-y-4">
      {/* Above the strip, so a linked entity's status reads the same on every tab. */}
      <ContentLinkHeader link={editingEntity.link} />
      <Tabs value={tab} onValueChange={(v) => onTabChange(v as EntityPanelTab)} className="space-y-4">
        {/* Named, because the editor's own strip is on the same screen and carries a Placeholders tab too. */}
        <TabsList
          aria-label="Entity Fields"
          className="grid w-full"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {/* Icon alone wherever the pane is narrow: "Descriptions" needs 137px on one row, and it gets 105px
              in the 375px sheet and 113px in the half-width pane at `md`. Same non-monotonic pane as the grid
              below, so the label follows the same steps. The name stays on `aria-label` at every width. */}
          {tabs.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} aria-label={label} className="gap-1.5">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline md:hidden xl:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <EntityImageWidget {...groupProps}>
            {/* Two columns need ~570px, and the pane holding them is not monotonic in viewport width: below
                `md` it is the full-width detail sheet, at `md` it becomes half the editor. So the second
                column comes back only where the pane is wide enough — once in the sheet, again at `xl`. */}
            <div className="grid gap-4 sm:grid-cols-[18rem_minmax(0,1fr)] md:grid-cols-1 xl:grid-cols-[18rem_minmax(0,1fr)]">
              <ImageGallery />
              <div className="space-y-4">
                <EntityIdentityFields {...groupProps} />
                <ImageTags />
              </div>
            </div>
          </EntityImageWidget>
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
          <EntityModelField {...groupProps} />
        </TabsContent>

        <TabsContent value="descriptions" className="space-y-4">
          <EntityDescriptionFields {...groupProps} />
        </TabsContent>

        {advanced && (
          <TabsContent value="placeholders">
            <ScopedPlaceholdersSection kind="entity" ownerId={entity.id} fill />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default EntityManager;
