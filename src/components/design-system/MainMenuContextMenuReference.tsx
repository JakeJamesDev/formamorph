import { useEffect, useRef, useState } from 'react';
import { LibraryGroupPicker } from '@/components/library/LibraryGroupPicker';
import { useDevRoute } from '@/lib/devRouter';
import { LibraryTileContextMenu, type LibraryTileMenuModel } from '@/components/library/LibraryTileContextMenu';
import { WorldCardFace } from '@/components/WorldCardFace';
import { EntityPlaceholderArt } from '@/components/EntityPlaceholderArt';
import { DefaultPersonaBadge, DefaultPersonaMenuItem } from '@/components/library/DefaultPersona';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { addToGroup, createGroupFromItem, disbandGroup, emptyTabOrganization, groupOf, removeFromGroup, setTileSize, tileSize, type LibraryGroup } from '@/lib/libraryOrganization';
import { randomUUID } from '@/lib/uuid';
import { Hint, Meta } from '@/components/ui/typography';

const SAMPLE_ID = 'context-menu-sample-entity';
const SAMPLE_NAME = 'Mara Venn';
const SAMPLE_GROUPS: LibraryGroup[] = [
  { id: 'archive', name: 'Archive of Very Long Expeditions and Unfinished Maps', members: [], settings: {} },
  { id: 'favorites', name: 'Favorites', members: [], settings: {} },
  { id: 'coastal', name: 'Coastal Mysteries', members: [], settings: {} },
  { id: 'short', name: 'Short Adventures', members: [], settings: {} },
  { id: 'quiet', name: 'Quiet Horror', members: [], settings: {} },
  { id: 'puzzles', name: 'Puzzle Worlds', members: [], settings: {} },
  { id: 'drafts', name: 'Drafts to Revisit', members: [], settings: {} },
  { id: 'shared', name: 'Shared Table Worlds', members: [], settings: {} },
  { id: 'winter', name: 'Winter Adventures', members: [], settings: {} },
  { id: 'science', name: 'Science Fiction', members: [], settings: {} },
  { id: 'one-shot', name: 'One-Shot Worlds', members: [], settings: {} },
  { id: 'finished', name: 'Recently Finished', members: [], settings: {} },
];

export function MainMenuContextMenuReference() {
  const route = useDevRoute();
  const pickerOpener = useRef<HTMLButtonElement>(null);
  const [panel, setPanel] = useState<'picker' | 'create' | null>(null);
  useEffect(() => {
    if (route?.modal === 'designSystem' && route.tab === 'context-menu' && (route.subtab === 'picker' || route.subtab === 'create')) {
      setPanel(route.subtab);
    }
  }, [route]);
  const [organization, setOrganization] = useState(() => ({
    ...emptyTabOrganization(),
    order: [SAMPLE_ID, ...SAMPLE_GROUPS.map((group) => group.id)],
    groups: Object.fromEntries(SAMPLE_GROUPS.map((group) => [group.id, group])),
  }));
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const groups = organization.order.flatMap((id) => organization.groups[id] ? [organization.groups[id]] : []);
  const group = groupOf(organization, SAMPLE_ID);
  const size = tileSize(organization, SAMPLE_ID);

  const tiles: LibraryTileMenuModel = {
    groups,
    group: () => undefined,
    groupOfItem: () => group,
    size: () => size,
    setSize: (id, nextSize) => setOrganization((prev) => setTileSize(prev, id, nextSize)),
    addTo: (itemId, groupId) => setOrganization((prev) => addToGroup(prev, itemId, groupId)),
    groupWithNew: (itemId, name) => {
      const groupId = randomUUID();
      setOrganization((prev) => createGroupFromItem(prev, { groupId, itemId, name }));
    },
    removeFrom: (itemId) => setOrganization((prev) => removeFromGroup(prev, itemId)),
    disband: (groupId) => setOrganization((prev) => disbandGroup(prev, groupId)),
  };

  return (
    <section className="grid gap-6" aria-labelledby="main-menu-context-menu-reference-title">
      <div className="grid gap-2">
        <h3 id="main-menu-context-menu-reference-title" className="text-heading">Grouped Context Actions</h3>
        <Hint>
          Right-click the sample entity. On a touch screen, press and hold the sample entity. For keyboard access, focus the sample entity. Press Shift+F10 or the Context Menu key.
        </Hint>
      </div>

      <div className="w-44">
        {deleted ? (
          <div className="grid aspect-[2/3] place-items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
            <Hint>Restore the local sample to continue.</Hint>
            <Button size="sm" variant="outline" onClick={() => setDeleted(false)}>Restore Sample</Button>
          </div>
        ) : (
          <LibraryTileContextMenu
            id={SAMPLE_ID}
            name={SAMPLE_NAME}
            tiles={tiles}
            layout="grid"
            renderedIds={[SAMPLE_ID]}
            baseCols={4}
            onOpenGroup={() => undefined}
            onCheckUpdates={() => setChecked(true)}
            itemActions={() => (
              <DefaultPersonaMenuItem isDefault={isDefault} onSet={() => setIsDefault(true)} onClear={() => setIsDefault(false)} />
            )}
            onDelete={() => setPendingDelete(true)}
          >
            <WorldCardFace
              role="button"
              tabIndex={0}
              aria-label={`Sample entity: ${SAMPLE_NAME}`}
              world={{ id: SAMPLE_ID, name: SAMPLE_NAME }}
              layout="grid"
              aspect="portrait"
              placeholder={<EntityPlaceholderArt id={SAMPLE_ID} name={SAMPLE_NAME} />}
              badge={isDefault ? <DefaultPersonaBadge /> : undefined}
            />
          </LibraryTileContextMenu>
        )}
      </div>

      <div>
        <Button ref={pickerOpener} variant="outline" disabled={deleted} onClick={() => setPanel('picker')}>Add To Group…</Button>
      </div>
      {panel && <LibraryGroupPicker
        key={panel}
        name={SAMPLE_NAME}
        groups={groups}
        currentGroupId={group?.id}
        initialPanel={panel}
        onSelect={(groupId) => tiles.addTo(SAMPLE_ID, groupId)}
        onCreate={(name) => tiles.groupWithNew(SAMPLE_ID, name)}
        onClose={() => setPanel(null)}
        restoreFocus={() => pickerOpener.current?.focus({ preventScroll: true })}
      />}

      <div className="rounded-md border border-border bg-muted/30 p-3" role="status" aria-live="polite">
        <div className="grid gap-1">
          <Meta>The tile size is {size}.</Meta>
          <Meta>{group ? `The sample group is ${group.name}.` : 'The sample is not in a group.'}</Meta>
          <Meta>{checked ? 'Check for Updates ran on the local sample.' : 'Check for Updates has not run.'}</Meta>
          <Meta>The sample is {isDefault ? 'the' : 'not the'} default persona.</Meta>
          <Meta>The local sample is {deleted ? 'deleted' : 'available'}.</Meta>
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        title="Delete Character"
        description="Are you sure you want to delete this character? This action cannot be undone."
        onConfirm={() => {
          setPendingDelete(false);
          setDeleted(true);
        }}
        onCancel={() => setPendingDelete(false)}
      />
    </section>
  );
}
