import type { ReactElement } from 'react';
import { Trash2 } from 'lucide-react';
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
  tiles,
  layout,
  renderedIds,
  baseCols,
  onOpenGroup,
  onDelete,
}: {
  children: ReactElement;
  id: string;
  tiles: LibraryTileMenuModel;
  layout: 'grid' | 'detailed';
  renderedIds: string[];
  baseCols: number;
  onOpenGroup: (groupId: string) => void;
  onDelete?: (id: string) => void;
}) {
  const group = tiles.group(id);
  const inFolder = tiles.groupOfItem(id);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="max-h-[60vh] w-max max-w-[calc(var(--radix-context-menu-content-available-width)-0.5rem)] overflow-x-hidden overflow-y-auto sm:max-w-sm">
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
              .map((candidate) => (
                <ContextMenuItem key={candidate.id} onSelect={() => tiles.addTo(id, candidate.id)}>
                  <ActionSpace /> <span className="min-w-0 break-words">{candidate.name}</span>
                </ContextMenuItem>
              ))}
            {/* Distinguish the action from a folder already named "New Group". */}
            <ContextMenuItem onSelect={() => tiles.groupWithNew(id)}>
              <ActionSpace /> Create New Group
            </ContextMenuItem>
            {inFolder && (
              <ContextMenuItem onSelect={() => tiles.removeFrom(id)}>
                <ActionSpace /> Remove From Group
              </ContextMenuItem>
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
      </ContextMenuContent>
    </ContextMenu>
  );
}
