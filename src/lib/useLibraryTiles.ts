import { useCallback, useEffect, useMemo, useState } from 'react';
import { randomUUID } from '@/lib/uuid';
import type { MainMenuCardTab } from '@/views/mainMenuTabs';
import {
  addToGroup,
  commitPlacements,
  createGroupFromItem,
  disbandGroup,
  groupOf,
  loadTabOrganization,
  pruneOrganization,
  removeFromGroup,
  renameGroup,
  saveTabOrganization,
  setDrawnOrder,
  setGroupPromptPreset,
  setTileSize,
  tileSize,
  topLevelIds,
  type LibraryGroup,
  type LibraryTabOrganization,
  type LibraryTileSize,
  type PlacementMap,
} from '@/lib/libraryOrganization';

/** One tab's tile arrangement plus the actions the grid dispatches against it. */
export interface LibraryTiles {
  organization: LibraryTabOrganization;
  /** The ids the tab currently holds. */
  itemIds: string[];
  /** Folders and loose items, in the order the main grid draws them. */
  topLevel: string[];
  /** Every folder in this tab, in the order they stand in the grid. */
  groups: LibraryGroup[];
  group: (id: string) => LibraryGroup | undefined;
  groupOfItem: (itemId: string) => LibraryGroup | undefined;
  size: (id: string) => LibraryTileSize;
  /**
   * Resize one tile. `ids` are the tiles sharing its grid, so a tile that outgrows its cell can find a
   * free one without disturbing them.
   */
  setSize: (id: string, size: LibraryTileSize, ids?: string[]) => void;
  addTo: (itemId: string, groupId: string) => void;
  /** Fold a tile into a brand-new folder on its own, for the context menu's New Group entry. */
  groupWithNew: (itemId: string) => void;
  removeFrom: (itemId: string) => void;
  disband: (groupId: string) => void;
  rename: (groupId: string, name: string) => void;
  /** Write the list a drag finished with as the order, for the main grid or one folder's members. */
  commitOrder: (drawn: string[], container?: string | null) => void;
  /** Write the board a grid drag finished with: every tile's cell at this width, and the order it reads as. */
  commitPlacements: (
    columns: number,
    places: PlacementMap,
    ids: string[],
    container?: string | null,
  ) => void;
  setPromptPreset: (groupId: string, presetId: string | null) => void;
}

/**
 * One library tab's tile arrangement, read from device-local storage and written back on every change.
 *
 * Nothing here reaches a world export, a publish, or the backup bundle — it is a view preference, like
 * the flat card order it grew out of.
 *
 * @param itemIds - The ids the tab currently holds; memoize it, since it drives the prune pass
 * @param ready - False while the tab is still loading, so a half-loaded list never prunes the arrangement
 */
export function useLibraryTiles(
  tab: MainMenuCardTab,
  itemIds: string[],
  ready: boolean,
): LibraryTiles {
  const [organization, setOrganization] = useState<LibraryTabOrganization>(
    () => loadTabOrganization(tab),
  );

  useEffect(() => {
    // An empty list is never pruned against: a load that threw looks exactly like an empty library, and
    // pruning against it would erase every folder and size the player has. An empty library has nothing
    // worth pruning anyway, so the guard costs nothing.
    if (!ready || itemIds.length === 0) return;
    // Deleted items leave the arrangement with them; a prune with nothing to do returns the same state.
    setOrganization((prev) => pruneOrganization(prev, itemIds));
  }, [ready, itemIds]);

  useEffect(() => {
    saveTabOrganization(tab, organization);
  }, [tab, organization]);

  const topLevel = useMemo(() => topLevelIds(organization, itemIds), [organization, itemIds]);
  const groups = useMemo(
    () => topLevel.map((id) => organization.groups[id]).filter((group): group is LibraryGroup => !!group),
    [topLevel, organization],
  );

  const groupWithNew = useCallback((itemId: string) => {
    setOrganization((prev) => createGroupFromItem(prev, { groupId: randomUUID(), itemId }));
  }, []);

  return {
    organization,
    itemIds,
    topLevel,
    groups,
    group: useCallback((id: string) => organization.groups[id], [organization]),
    groupOfItem: useCallback((itemId: string) => groupOf(organization, itemId), [organization]),
    size: useCallback((id: string) => tileSize(organization, id), [organization]),
    setSize: useCallback(
      (id, size, ids) => setOrganization((prev) => setTileSize(prev, id, size, ids)),
      [],
    ),
    groupWithNew,
    addTo: useCallback((itemId, groupId) => setOrganization((prev) => addToGroup(prev, itemId, groupId)), []),
    removeFrom: useCallback((itemId) => setOrganization((prev) => removeFromGroup(prev, itemId)), []),
    disband: useCallback((groupId) => setOrganization((prev) => disbandGroup(prev, groupId)), []),
    rename: useCallback((groupId, name) => setOrganization((prev) => renameGroup(prev, groupId, name)), []),
    commitOrder: useCallback((drawn: string[], container?: string | null) => {
      setOrganization((prev) => setDrawnOrder(prev, drawn, container));
    }, []),
    commitPlacements: useCallback(
      (columns: number, places: PlacementMap, ids: string[], container?: string | null) => {
        setOrganization((prev) => commitPlacements(prev, { columns, places, ids, container }));
      },
      [],
    ),
    setPromptPreset: useCallback(
      (groupId, presetId) => setOrganization((prev) => setGroupPromptPreset(prev, groupId, presetId)),
      [],
    ),
  };
}
