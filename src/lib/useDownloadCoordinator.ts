import { useState, useMemo, type Dispatch, type SetStateAction } from "react";
import { toast } from "react-toastify";
import WorldStorageService from "@/services/WorldStorageService";
import AuthService from "@/services/AuthService";
import { migrateWorld } from "@/lib/version";
import { getDownloadState, type DownloadState } from "@/lib/downloadState";
import { type WorldRecord } from "@/components/WorldDetails";
import type { World } from "@/types";

/**
 * Owns the "download a Discover world to the local library" flow: per-world progress, the contextual
 * decision state (download a copy vs overwrite an existing one), and the fetch/store handlers. Reads the
 * local `worlds` to group copies by their source Discover entry (driving the none/refresh/update button
 * state), and calls `setWorlds` to add/replace local copies.
 */
export function useDownloadCoordinator(
  worlds: WorldRecord[],
  setWorlds: Dispatch<SetStateAction<WorldRecord[]>>,
) {
  // In-flight downloads keyed by remote world id → fraction 0..1, or -1 when total size is unknown.
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  // The world awaiting a refresh/update decision (copy vs overwrite), or null when none is pending.
  const [contextualAction, setContextualAction] = useState<{ world: WorldRecord; mode: DownloadState } | null>(null);
  const [overwriteSelectedId, setOverwriteSelectedId] = useState<string | null>(null);
  const [showOverwriteSelect, setShowOverwriteSelect] = useState(false);

  // Local copies grouped by the Discover entry they were downloaded from (sourceId). Drives the
  // contextual download button: none/refresh/update per server world, plus the overwrite picker.
  const localCopiesBySource = useMemo(() => {
    const map = new Map<string, WorldRecord[]>();
    for (const w of worlds) {
      if (!w.sourceId) continue;
      const list = map.get(w.sourceId) ?? [];
      list.push(w);
      map.set(w.sourceId, list);
    }
    return map;
  }, [worlds]);

  const copiesForWorld = (world: WorldRecord): WorldRecord[] =>
    localCopiesBySource.get(world._id || world.id) ?? [];

  const downloadStateForWorld = (world: WorldRecord): DownloadState =>
    getDownloadState(world.updated_at, copiesForWorld(world));

  // Fetch + stream + migrate a remote world's content, reporting streaming progress on
  // downloadProgress[worldId]. Shared by the new-copy download and the in-place overwrite paths.
  const fetchWorldContent = async (
    world: WorldRecord,
    worldId: string,
  ): Promise<{ migrated: World; thumbnailUrl: string }> => {
    const response = await fetch(`${WorldStorageService.API_URL}/worlds/${worldId}/content`, {
      headers: AuthService.isAuthenticated() ? {
        'Authorization': `Bearer ${AuthService.token}`
      } : {}
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to download world');
    }

    // Stream the (often large) response body so we can report download progress. Falls back to a
    // plain json() read when streaming isn't available. Content-Length may be absent/compressed,
    // so we clamp the fraction and treat a missing total as indeterminate (-1).
    const total = Number(response.headers.get('Content-Length')) || 0;
    const reader = response.body?.getReader();
    let worldData: { success?: boolean; data?: { contentData?: unknown } };
    if (reader) {
      const decoder = new TextDecoder();
      let text = '';
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        text += decoder.decode(value, { stream: true });
        setDownloadProgress((p) => ({ ...p, [worldId]: total ? Math.min(received / total, 1) : -1 }));
      }
      text += decoder.decode();
      worldData = JSON.parse(text);
    } else {
      worldData = await response.json();
    }

    if (!worldData.success || !worldData.data) {
      throw new Error('Invalid world data received');
    }

    // Capture into a const so narrowing survives the awaits below (property narrowing would reset).
    const contentData = worldData.data.contentData;
    const migrated = migrateWorld(contentData);

    let thumbnailUrl = '';
    if (world.thumbnail_file) {
      thumbnailUrl = `${WorldStorageService.API_URL}/thumbnails/${world.thumbnail_file}`;
    } else if (world.thumbnail) {
      thumbnailUrl = world.thumbnail;
    }

    return { migrated, thumbnailUrl };
  };

  // Download a remote world as a new local entry.
  const handleDownloadWorld = async (world: WorldRecord) => {
    const worldId = world._id || world.id;
    // Mark this world as in-flight (indeterminate until we know the size) so the card swaps to a bar.
    setDownloadProgress((p) => ({ ...p, [worldId]: -1 }));
    try {
      const { migrated, thumbnailUrl } = await fetchWorldContent(world, worldId);

      const localWorldId = `downloaded-${Date.now()}`;
      const name = world.name || 'Downloaded World';
      const description = world.description || 'Downloaded from server';
      const author = world.author?.username || '';
      const now = new Date().toISOString();

      await WorldStorageService.storeWorld({
        id: localWorldId,
        name,
        description,
        thumbnail: thumbnailUrl,
        author,
        // Link back to the Discover entry so the "Downloaded" state survives reloads. Record the
        // source version we hold (server updated_at) and when, for refresh/update detection.
        sourceId: worldId,
        dirty: false,
        downloadedAt: now,
        sourceUpdatedAt: world.updated_at,
        // Sanitize at the download boundary so the stored copy is already current.
        data: migrated
      });

      setWorlds(prev => [...prev, {
        id: localWorldId,
        name,
        description,
        thumbnail: thumbnailUrl,
        author,
        tags: migrated.worldOverview?.tags || [],
        sourceId: worldId,
        dirty: false,
        downloadedAt: now,
        sourceUpdatedAt: world.updated_at,
        lastAccessed: now,
        isLoading: false
      }]);

      toast.success(`"${name}" downloaded successfully`);
    } catch (error) {
      console.error('Error downloading world:', error);
      toast.error((error as Error).message || 'Failed to download world');
    } finally {
      // Clear the in-flight bar whether it succeeded or failed.
      setDownloadProgress((p) => { const next = { ...p }; delete next[worldId]; return next; });
    }
  };

  // Overwrite an existing local copy in place with the current server content (refresh or update).
  const overwriteWorld = async (world: WorldRecord, localId: string) => {
    const worldId = world._id || world.id;
    setDownloadProgress((p) => ({ ...p, [worldId]: -1 }));
    try {
      const { migrated, thumbnailUrl } = await fetchWorldContent(world, worldId);

      const name = world.name || 'Downloaded World';
      const description = world.description || 'Downloaded from server';
      const author = world.author?.username || '';
      const now = new Date().toISOString();

      // Same local id ⇒ storeWorld overwrites the record in place; flags/stamps reset to a clean copy.
      await WorldStorageService.storeWorld({
        id: localId,
        name,
        description,
        thumbnail: thumbnailUrl,
        author,
        sourceId: worldId,
        dirty: false,
        downloadedAt: now,
        sourceUpdatedAt: world.updated_at,
        data: migrated
      });

      setWorlds(prev => prev.map(w => w.id === localId ? {
        ...w,
        name,
        description,
        thumbnail: thumbnailUrl,
        author,
        tags: migrated.worldOverview?.tags || [],
        sourceId: worldId,
        dirty: false,
        downloadedAt: now,
        sourceUpdatedAt: world.updated_at,
        lastAccessed: now,
      } : w));

      toast.success(`"${name}" updated successfully`);
    } catch (error) {
      console.error('Error updating world:', error);
      toast.error((error as Error).message || 'Failed to update world');
    } finally {
      setDownloadProgress((p) => { const next = { ...p }; delete next[worldId]; return next; });
    }
  };

  // Contextual button click: new worlds download immediately; already-downloaded ones open the
  // refresh/update decision dialog (copy vs overwrite).
  const handleContextualDownload = (world: WorldRecord, state: DownloadState) => {
    if (state === 'none') { handleDownloadWorld(world); return; }
    setContextualAction({ world, mode: state });
  };

  // "Overwrite an existing copy": overwrite directly when there's a single match, else pick which one.
  const handleChooseOverwrite = () => {
    if (!contextualAction) return;
    const copies = copiesForWorld(contextualAction.world);
    if (copies.length <= 1) {
      if (copies[0]) overwriteWorld(contextualAction.world, copies[0].id);
      setContextualAction(null);
      return;
    }
    setOverwriteSelectedId(copies[0]?.id ?? null);
    setShowOverwriteSelect(true);
  };

  // Confirm the chosen copy in the selection dialog.
  const handleConfirmOverwrite = () => {
    if (contextualAction && overwriteSelectedId) {
      overwriteWorld(contextualAction.world, overwriteSelectedId);
    }
    setShowOverwriteSelect(false);
    setContextualAction(null);
    setOverwriteSelectedId(null);
  };

  return {
    downloadProgress,
    contextualAction, setContextualAction,
    overwriteSelectedId, setOverwriteSelectedId,
    showOverwriteSelect, setShowOverwriteSelect,
    localCopiesBySource,
    copiesForWorld,
    downloadStateForWorld,
    handleContextualDownload,
    handleChooseOverwrite,
    handleConfirmOverwrite,
    handleDownloadWorld,
  };
}
