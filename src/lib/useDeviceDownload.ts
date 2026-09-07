import { useCallback, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import type { Dictionary, Entity, World } from '@/types';
import type { WorldRecord } from '@/components/WorldDetails';
import { kindOf, KIND_LABELS } from './catalogKinds';
import { fetchCatalogContent } from './fetchCatalogContent';
import { downloadBlob } from './downloadBlob';
import { serializeJsonBlob } from './jsonFileWorkerUtils';
import { exportEntityCard } from './entityFile';
import { buildDictionaryFile } from './dictionaryFile';
import { serializeWorldFile } from './worldFile';

/** Downloads a published listing as its normal importable file without touching the local library. */
export function useDeviceDownload() {
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const activeDownloads = useRef(new Set<string>());

  const download = useCallback(async (listing: WorldRecord) => {
    const listingId = String(listing._id || listing.id);
    if (activeDownloads.current.has(listingId)) return;

    activeDownloads.current.add(listingId);
    setDownloadProgress((progress) => ({ ...progress, [listingId]: -1 }));
    try {
      const content = await fetchCatalogContent(listingId, (fraction) =>
        setDownloadProgress((progress) => ({ ...progress, [listingId]: fraction })));
      const kind = kindOf(listing);
      let filename: string;
      let blob: Blob;

      if (kind === 'world') {
        const world = content as World;
        blob = await serializeWorldFile(world);
        filename = `${world.worldOverview?.name || listing.name || 'rpg_world'}.json`;
      } else if (kind === 'entity') {
        const entity = content as Entity;
        blob = await exportEntityCard(entity);
        filename = `${entity.name || listing.name || 'character'}.webp`;
      } else {
        const dictionary = content as Dictionary;
        const file = buildDictionaryFile(dictionary);
        blob = await serializeJsonBlob(file, 2);
        filename = `${file.name || listing.name || 'dictionary'}.json`;
      }

      downloadBlob(blob, filename);
      toast.success(`"${listing.name || KIND_LABELS[kind].one}" downloaded successfully`);
    } catch (error) {
      console.error(`Error downloading ${kindOf(listing)} for device:`, error);
      toast.error((error as Error).message || `Failed to download ${KIND_LABELS[kindOf(listing)].one.toLowerCase()}`);
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
