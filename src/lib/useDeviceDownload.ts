import { useCallback, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { toastError } from '@/lib/linkToast';
import type { AvatarListingContent, Dictionary, Entity, World } from '@/types';
import type { WorldRecord } from '@/components/WorldDetails';
import WorldStorageService from '@/services/WorldStorageService';
import type { ComponentFileLinks } from './componentFileLinks';
import { CATALOG_KINDS, kindOf, KIND_LABELS, type CatalogKind } from './catalogKinds';
import type { SharedPreset } from './promptPresetShare';
import { APP_VERSION } from './version';
import { fetchCatalogContent } from './fetchCatalogContent';
import { downloadBlob } from './downloadBlob';
import { serializeJsonBlob } from './jsonFileWorkerUtils';
import { exportEntityCard } from './entityFile';
import { buildDictionaryFile } from './dictionaryFile';
import { serializeWorldFile } from './worldFile';
import { avatarListingBlob } from './avatarDownload';
import { readLibraryDetails } from './contentAuthor';

/**
 * What a listing's own file says about where it came from and which worlds it suits.
 *
 * The listing is the source here: there is no local library item behind a device download. A server that
 * cannot answer leaves the associations out, which is what an offline reader of the file then sees.
 */
async function listingLinks(listingId: string, listing: WorldRecord): Promise<ComponentFileLinks> {
  const details = await WorldStorageService.fetchListingDetails(listingId);
  const associations = details?.compatibleWorlds ?? [];
  return {
    source: { sourceId: listingId, sourceName: String(listing.name ?? '') || 'Untitled' },
    ...(associations.length ? { associations } : {}),
  };
}

const UNKNOWN_KIND = "This kind of listing can't be saved to your device.";

/** The kind a listing saves as: a listing with no kind is a world, and one this build doesn't know is null. */
function savedKind(listing: WorldRecord): CatalogKind | null {
  const raw: unknown = listing.kind;
  return !raw || (CATALOG_KINDS as readonly unknown[]).includes(raw) ? kindOf(listing) : null;
}

/** The file a listing saves as: the file the app's own export of that kind writes. */
async function deviceFile(kind: CatalogKind, content: unknown, listingId: string, listing: WorldRecord): Promise<{ blob: Blob; filename: string }> {
  switch (kind) {
    case 'world': {
      const world = content as World;
      return { blob: await serializeWorldFile(world), filename: `${world.worldOverview?.name || listing.name || 'rpg_world'}.json` };
    }
    case 'entity': {
      const entity = content as Entity;
      const blob = await exportEntityCard(entity, undefined, await listingLinks(listingId, listing), readLibraryDetails(content, listing.author?.username));
      return { blob, filename: `${entity.name || listing.name || 'character'}.webp` };
    }
    case 'dictionary': {
      const file = buildDictionaryFile(content as Dictionary, undefined, await listingLinks(listingId, listing), readLibraryDetails(content, listing.author?.username));
      return { blob: await serializeJsonBlob(file, 2), filename: `${file.name || listing.name || 'dictionary'}.json` };
    }
    case 'model':
      // The `.vrm` file itself, not a JSON wrapper: the one kind whose device download is the raw asset.
      return { blob: await avatarListingBlob(content as AvatarListingContent), filename: `${listing.name || 'avatar'}.vrm` };
    case 'prompt': {
      // Loaded on use, so the browser chunk the website mounts never carries the preset modules.
      const { parseSharedContent, presetFileName, serializeSharedJson } = await import('./promptPresetShare');
      const { id: _listingId, ...shared } = content as SharedPreset & { id?: string };
      const parsed = parseSharedContent(shared, APP_VERSION);
      if (!parsed.ok) throw new Error(parsed.error ?? 'This listing is not a prompt preset.');
      return { blob: new Blob([serializeSharedJson(shared)], { type: 'application/json' }), filename: presetFileName(shared.name) };
    }
    case 'mascot': {
      // Loaded on use, so the browser chunk the website mounts never carries the Mascot modules.
      const [{ parseMascotCardData }, { mascotCardFileFromData }] = await Promise.all([import('./formaquestion/mascotCard'), import('./formaquestion/mascotCardFile')]);
      const card = parseMascotCardData(content);
      return { blob: await mascotCardFileFromData(card), filename: `${card.name || listing.name || 'mascot'}.webp` };
    }
    default: {
      const unhandled: never = kind;
      throw new Error(`${UNKNOWN_KIND} (${String(unhandled)})`);
    }
  }
}

/** Downloads a published listing as its normal importable file without touching the local library. */
export function useDeviceDownload() {
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const activeDownloads = useRef(new Set<string>());

  const download = useCallback(async (listing: WorldRecord) => {
    const listingId = String(listing._id || listing.id);
    if (activeDownloads.current.has(listingId)) return;

    activeDownloads.current.add(listingId);
    setDownloadProgress((progress) => ({ ...progress, [listingId]: -1 }));
    const kind = savedKind(listing);
    const label = kind ? KIND_LABELS[kind].one : 'Listing';
    try {
      if (!kind) throw new Error(UNKNOWN_KIND);
      const content = await fetchCatalogContent(listingId, (fraction) =>
        setDownloadProgress((progress) => ({ ...progress, [listingId]: fraction })));
      const { blob, filename } = await deviceFile(kind, content, listingId, listing);
      downloadBlob(blob, filename);
      toast.success(`"${listing.name || label}" downloaded`);
    } catch (error) {
      console.error(`Error downloading ${kind ?? String(listing.kind)} for device:`, error);
      toastError(error, `Failed to download ${label.toLowerCase()}`);
    } finally {
      activeDownloads.current.delete(listingId);
      setDownloadProgress((progress) => {
        const next = { ...progress };
        delete next[listingId];
        return next;
      });
    }
  }, []);

  return { download, downloadProgress };
}
