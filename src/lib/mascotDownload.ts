import type { LibraryRecord, LibraryTarget } from '@/lib/useLibraryDownload';
import { deleteMascotImage } from '@/lib/formaquestion/mascotImageStore';
import { mascotCardName, parseMascotCardData } from '@/lib/formaquestion/mascotCard';
import { storeMascotCard } from '@/lib/formaquestion/mascotCardFile';
import {
  putDownloadedMascot, uniqueMascotName, unreferencedMascotImages, type MascotPresetStore,
} from '@/lib/formaquestion/mascotPresets';
import { mascotImageIds } from '@/lib/formaquestion/mascotRigEdits';

/** The Mascot preset store as the settings hold it: read the latest, and write a new one. */
export interface MascotStoreAccess {
  read: () => MascotPresetStore;
  write: (store: MascotPresetStore) => void;
}

/** A Mascot listing's content: the mascot card data, read through the card parser on arrival. */
export type MascotListingContent = { id?: string } & Record<string, unknown>;

/** What the community browser downloads Mascots through. Built by the app host, so the browser, which the website also mounts, never imports the Mascot modules. */
export interface MascotLibrary {
  target: LibraryTarget<MascotListingContent>;
}

export interface MascotDownloadDeps {
  /** Stores the card's images and gives the rig that names them. */
  storeCard: typeof storeMascotCard;
  /** Deletes images from the mascot image store. */
  dropImages: (ids: readonly string[]) => void;
}

const DEFAULT_DEPS: MascotDownloadDeps = {
  storeCard: storeMascotCard,
  dropImages: (ids) => {
    for (const id of ids) void deleteMascotImage(id).catch((cause: unknown) => console.error('Could not delete a mascot image:', cause));
  },
};

/** How a Mascot listing reaches the preset store, as the library download flow drives it. */
export function mascotLibraryTarget(
  mascots: readonly LibraryRecord[], access: MascotStoreAccess, overrides: Partial<MascotDownloadDeps> = {},
): LibraryTarget<MascotListingContent> {
  const deps = { ...DEFAULT_DEPS, ...overrides };
  return {
    kind: 'mascot',
    records: [...mascots],
    store: async (id, content, link, listingName) => {
      const card = parseMascotCardData(content);
      // Stored first: a card that fails here leaves the preset store as it was.
      const rig = await deps.storeCard(card);
      const current = access.read();
      const held = current.mascots.find((mascot) => mascot.id === id);
      const others = { ...current, mascots: current.mascots.filter((mascot) => mascot.id !== id) };
      const next = putDownloadedMascot(current, {
        id,
        name: uniqueMascotName(others, mascotCardName(card, listingName)),
        rig,
        sourceId: link.sourceId,
        downloadedAt: link.downloadedAt,
        ...(link.sourceUpdatedAt ? { sourceUpdatedAt: link.sourceUpdatedAt } : {}),
        ...(link.sourceAuthorId ? { sourceAuthorId: link.sourceAuthorId } : {}),
        ...(link.sourceAuthorName ? { sourceAuthorName: link.sourceAuthorName } : {}),
      });
      access.write(next);
      // The replaced copy's images go once nothing holds them, a duplicate's shared ones excepted.
      if (held) deps.dropImages(unreferencedMascotImages(mascotImageIds(held.rig), next));
    },
    // The store is React state, so the browser re-renders on its own.
    refresh: () => {},
  };
}
