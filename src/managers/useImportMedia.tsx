import { useRef, type ChangeEvent } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { blobHash } from '@/lib/blobHash';
import { applyImageOptimize } from '@/lib/imageOptim';
import { toastError } from '@/lib/linkToast';
import { addedEntries, mediaContentKey, placeGalleryFile } from '@/lib/mediaGallery';
import { ENTRY_ITEM_PREFIX, UNUSED_IMAGE_CAP, avatarItemId } from '@/lib/mediaIndex';
import { mediaNameFromFile } from '@/lib/mediaList';
import { placeSound } from '@/lib/mediaSounds';
import { trackWork } from '@/lib/pendingWork';
import { readMediaFile } from '@/lib/UtilityComponents';
import { useDownscalePrompt } from '@/lib/useDownscalePrompt';
import { useMountedRef } from '@/lib/useMountedRef';
import { vrmDisplayName } from '@/lib/worldVrmStore';
import type { MediaList } from '@/types';
import { useAvatarStore } from './AvatarStore';
import { useMediaStep } from './useMediaItemActions';

const IMPORT_ACCEPT = 'image/*,audio/*,.vrm,.glb';

const isAvatarFile = (file: File) => /\.(vrm|glb)$/i.test(file.name);

/**
 * Import Media: images and sounds join the Media List under their file names, and VRMs join the Avatar store
 * (Q8). Images pass the downscale consent at the Unused budget, since no slot holds them yet. The selection
 * moves to the first new card. Render `input` and `dialog` once; `open` raises the file picker.
 */
export function useImportMedia(onSelect: (id: string) => void) {
  const { worldOverview, addMedia } = useGameData();
  const { add: addAvatar } = useAvatarStore();
  const step = useMediaStep();
  const mounted = useMountedRef();
  const { promptImagesBatch, dialog } = useDownscalePrompt();
  const ref = useRef<HTMLInputElement>(null);
  const listRef = useRef(worldOverview.mediaList);
  listRef.current = worldOverview.mediaList;

  const take = async (files: File[]) => {
    const avatars = files.filter(isAvatarFile);
    const media = files.filter((f) => !isAvatarFile(f) && /^(image|audio)\//.test(f.type));
    const read = await Promise.all(media.map(readMediaFile));
    // An image the list already holds is reused as is, so only new ones meet the downscale prompt.
    const held = new Set(Object.values(listRef.current ?? {}).filter((e) => e.kind === 'image').map((e) => mediaContentKey(e.data)));
    const fresh = (f: { type: string; data: string }) => f.type.startsWith('image/') && !held.has(mediaContentKey(f.data));
    const imageUrls = read.filter(fresh).map((f) => f.data);
    const mode = imageUrls.length ? await promptImagesBatch(imageUrls, UNUSED_IMAGE_CAP) : 'off';
    const placed = await Promise.all(read.map(async (f) => (fresh(f)
      ? { ...f, data: (await applyImageOptimize(f.data, mode, UNUSED_IMAGE_CAP)) ?? f.data }
      : f)));
    const vrms = await Promise.all(avatars.map(async (file) => ({ file, data: await readMediaFile(file), hash: await blobHash(file) })));
    if (!mounted.current) return;

    const before: MediaList = listRef.current ?? {};
    let list = before;
    const ids: string[] = [];
    for (const f of placed) {
      if (f.type.startsWith('image/')) {
        const next = placeGalleryFile(list, { data: f.data, name: mediaNameFromFile(f.name) }, 'image', undefined);
        list = next.list;
        ids.push(next.id);
      } else {
        const next = placeSound(list, f, undefined);
        list = next.list;
        ids.push(next.link.mediaId);
      }
    }
    const added = addedEntries(before, list);
    if (Object.keys(added).length) {
      const one = Object.keys(added).length === 1;
      await step(one ? `Import Media: ${Object.values(added)[0].name}` : 'Import Media', () => addMedia(added));
    }
    if (!mounted.current) return;
    // Browsers report an empty MIME for .vrm, so the filename is the format hint.
    const avatarIds = vrms.map(({ file, data, hash }) => addAvatar(vrmDisplayName(file.name), { ...data, type: file.type || 'model/vrm' }, hash));
    const first = ids[0] ? `${ENTRY_ITEM_PREFIX}${ids[0]}` : avatarIds[0] ? avatarItemId(avatarIds[0]) : undefined;
    if (first) onSelect(first);
  };

  const picked = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    // Cleared so picking the same files again still fires.
    e.target.value = '';
    if (files.length) void trackWork(take(files).catch((error: unknown) => toastError(error, { headline: "Couldn't import the files" })));
  };

  const input = (
    <input ref={ref} type="file" multiple accept={IMPORT_ACCEPT} aria-label="Media Files" data-media-import="" className="hidden" onChange={picked} />
  );
  return { open: () => ref.current?.click(), input, dialog };
}
