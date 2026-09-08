import { useRef, useState, type ReactElement } from 'react';
import { FolderPlus, FolderSearch, Trash2 } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { LibraryTileSize } from '@/lib/libraryOrganization';
import type { LibraryTiles } from '@/lib/useLibraryTiles';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LibraryGroupPicker } from './LibraryGroupPicker';

const SIZE_LABELS: { size: LibraryTileSize; label: string }[] = [
  { size: 'small', label: 'Small' },
  { size: 'medium', label: 'Medium' },
  { size: 'large', label: 'Large' },
];

const ActionSpace = () => <span aria-hidden className="h-4 w-4 shrink-0" />;

export type LibraryTileMenuModel = Pick<
  LibraryTiles,
  'groups' | 'group' | 'groupOfItem' | 'size' | 'setSize' | 'addTo' | 'groupWithNew' | 'removeFrom' | 'disband'
>;

/** The production actions attached to one main-menu library tile. */
export function LibraryTileContextMenu({
  children,
  id,
  name,
  tiles,
  layout,
  renderedIds,
  baseCols,
  onOpenGroup,
  onDelete,
}: {
  children: ReactElement;
  id: string;
  name: string;
  tiles: LibraryTileMenuModel;
  layout: 'grid' | 'detailed';
  renderedIds: string[];
  baseCols: number;
  onOpenGroup: (groupId: string) => void;
  onDelete?: (id: string) => void;
}) {
  const group = tiles.group(id);
  const inFolder = tiles.groupOfItem(id);
  const [panel, setPanel] = useState<'picker' | 'create' | null>(null);
  const pendingPanel = useRef<typeof panel>(null);
  const trigger = useRef<HTMLSpanElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const fallback = useRef<HTMLElement | null>(null);
  const restoreFocus = () => {
    const target = opener.current?.isConnected ? opener.current : fallback.current;
    target?.focus({ preventScroll: true });
  };

  return (
    <>
    <ContextMenu onOpenChange={(open) => {
      if (!open) return;
      const node = trigger.current;
      opener.current = node?.querySelector<HTMLElement>('button, [tabindex="0"]') ?? node;
      fallback.current = node?.closest<HTMLElement>('[data-library-focus-root]') ?? null;
    }}>
      <ContextMenuTrigger ref={trigger} asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent
        className="w-64 max-w-[calc(100vw-1rem)] p-0"
        collisionPadding={8}
        sticky="always"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const next = pendingPanel.current;
          pendingPanel.current = null;
          if (next) setPanel(next);
          else restoreFocus();
        }}
      >
        <ScrollArea className="max-h-[min(calc(100dvh-1rem-2px),calc(var(--radix-context-menu-content-available-height)-2px))] p-1">
        {/* Size only affects the packed grid; detailed cards are uniform. */}
        {layout === 'grid' && (
          <>
            <ContextMenuLabel>Tile Size</ContextMenuLabel>
            <ContextMenuRadioGroup
              value={tiles.size(id)}
              onValueChange={(value) => tiles.setSize(id, value as LibraryTileSize, renderedIds, baseCols)}
            >
              {/* The shared radio item takes its checked state explicitly. */}
              {SIZE_LABELS.map(({ size, label }) => (
                <ContextMenuRadioItem key={size} value={size} checked={tiles.size(id) === size}>
                  {label}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
            <ContextMenuSeparator />
          </>
        )}

        {group ? (
          <>
            <ContextMenuItem onSelect={() => onOpenGroup(group.id)}>
              <ActionSpace /> Open Group
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => tiles.disband(group.id)}>
              <ActionSpace /> Delete Group
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuLabel>Add To Group</ContextMenuLabel>
            {tiles.groups
              .filter((candidate) => candidate.id !== inFolder?.id)
              .slice(0, 3)
              .map((candidate) => (
                <ContextMenuItem key={candidate.id} className="pl-8" onSelect={() => tiles.addTo(id, candidate.id)}>
                  <span className="min-w-0 truncate">{candidate.name}</span>
                </ContextMenuItem>
              ))}
            <ContextMenuItem onSelect={() => { pendingPanel.current = 'create'; }}>
              <FolderPlus className="h-4 w-4 shrink-0" /> Create New Group…
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => { pendingPanel.current = 'picker'; }}>
              <FolderSearch className="h-4 w-4 shrink-0" /> Add To Group…
            </ContextMenuItem>
            {inFolder && (
              <>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => tiles.removeFrom(id)}>
                <ActionSpace /> Remove From Group
              </ContextMenuItem>
              </>
            )}
          </>
        )}

        {/* Delete stays in the menu because the card has no delete control. */}
        {!group && onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => onDelete(id)}
            >
              <Trash2 className="h-4 w-4 shrink-0" /> Delete
            </ContextMenuItem>
          </>
        )}
        </ScrollArea>
      </ContextMenuContent>
    </ContextMenu>
    {panel && <LibraryGroupPicker
      name={name}
      groups={tiles.groups}
      currentGroupId={inFolder?.id}
      initialPanel={panel}
      onSelect={(groupId) => tiles.addTo(id, groupId)}
      onCreate={(groupName) => tiles.groupWithNew(id, groupName)}
      onClose={() => setPanel(null)}
      restoreFocus={restoreFocus}
    />}
    </>
  );
}
