import { useEffect, useRef, useState } from 'react';
import { LibraryGroupPicker } from '@/components/library/LibraryGroupPicker';
import { useDevRoute } from '@/lib/devRouter';
import { LibraryTileContextMenu, type LibraryTileMenuModel } from '@/components/library/LibraryTileContextMenu';
import { WorldCardShell } from '@/components/WorldCardShell';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { addToGroup, createGroupFromItem, disbandGroup, emptyTabOrganization, groupOf, removeFromGroup, setTileSize, tileSize, type LibraryGroup } from '@/lib/libraryOrganization';
import { randomUUID } from '@/lib/uuid';
import { Hint, Meta } from '@/components/ui/typography';

const SAMPLE_ID = 'context-menu-sample-world';
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
          Right-click the sample world. On a touch screen, press and hold the sample world. For keyboard access, focus the sample world. Press Shift+F10 or the Context Menu key.
        </Hint>
      </div>

      <div className="max-w-md">
        {deleted ? (
          <div className="grid min-h-48 place-items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
            <Hint>Restore the local sample to continue.</Hint>
            <Button size="sm" variant="outline" onClick={() => setDeleted(false)}>Restore Sample</Button>
          </div>
        ) : (
          <LibraryTileContextMenu
            id={SAMPLE_ID}
            name="The Lantern District"
            tiles={tiles}
            layout="grid"
            renderedIds={[SAMPLE_ID]}
            baseCols={4}
            onOpenGroup={() => undefined}
            onDelete={() => setPendingDelete(true)}
          >
            <WorldCardShell
              role="button"
              tabIndex={0}
              aria-label="Sample world: The Lantern District"
              name="The Lantern District"
              description="A controlled library sample for the production tile menu."
              author="local reference"
              frameClassName="bg-card"
            />
          </LibraryTileContextMenu>
        )}
      </div>

      <div>
        <Button ref={pickerOpener} variant="outline" disabled={deleted} onClick={() => setPanel('picker')}>Add To Group…</Button>
      </div>
      {panel && <LibraryGroupPicker
        key={panel}
        name="The Lantern District"
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
          <Meta>The local sample is {deleted ? 'deleted' : 'available'}.</Meta>
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        title="Delete World"
        description="Are you sure you want to delete this world? This action cannot be undone."
        onConfirm={() => {
          setPendingDelete(false);
          setDeleted(true);
        }}
        onCancel={() => setPendingDelete(false)}
      />
    </section>
  );
}
