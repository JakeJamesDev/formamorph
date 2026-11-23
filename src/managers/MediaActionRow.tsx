import { useRef, useState, type ChangeEvent } from 'react';
import { Download, ExternalLink, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/downloadBlob';
import { fileToDataUrl } from '@/lib/imageDrop';
import { trackWork } from '@/lib/pendingWork';
import { toastError } from '@/lib/linkToast';
import { labelPlaceholders } from '@/lib/placementLetters';
import { useDownscalePrompt } from '@/lib/useDownscalePrompt';
import { useMountedRef } from '@/lib/useMountedRef';
import { useSupporterCopyBlock } from '@/lib/useSupporterCopyBlock';
import { Tip } from '@/components/ui/tooltip';
import { mediaFileName, type MediaItem, type MediaKind } from '@/lib/mediaIndex';
import { layeredEntry } from '@/lib/mediaList';
import { resolveLayered, type LayerReads } from '@/lib/layeredImages';
import { useEntityLookReads } from '@/contexts/RuleSourceContext';
import { FLAT_LOSSLESS, pictureFile } from '@/lib/layeredFlatten';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import type { MediaAsset, MediaList, Placeholder } from '@/types';
import { EditLayersButton } from './LayeredImageEditor';
import { entityParentId } from './MediaGallery';

/** The files Replace offers for each kind. */
const ACCEPT: Record<MediaKind, string> = {
  image: 'image/*',
  sound: 'audio/*',
  model: '.glb,.gltf,.fbx,.obj',
  layered: '',
  avatar: '.vrm,.glb',
};

/** A Layered Image slot's picture under `reads`, flattened lossless. */
async function layeredFile(item: MediaItem, list: MediaList | undefined, reads: LayerReads): Promise<string> {
  const entry = item.mediaId ? layeredEntry(list, item.mediaId) : undefined;
  const picture = entry && resolveLayered(entry, list, reads);
  if (!picture) throw new Error('This Layered Image has no images to show');
  return pictureFile(picture, undefined, FLAT_LOSSLESS);
}

/** Download: embedded bytes under a name from the parent and slot, or the link itself for a linked image. */
function DownloadButton({ item, placeholders }: { item: MediaItem; placeholders: readonly Placeholder[] }) {
  const mounted = useMountedRef();
  const [busy, setBusy] = useState(false);
  const blocked = useSupporterCopyBlock('downloadMedia');
  const list = useGameDataOptional()?.worldOverview.mediaList;
  const reads = useEntityLookReads(entityParentId(item));
  if (item.linked) {
    return (
      <Button variant="outline" size="sm" asChild>
        <a href={item.value} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Open Link</a>
      </Button>
    );
  }
  if (blocked) {
    return (
      <Tip tip={blocked} labelsChild={false}>
        <Button variant="outline" size="sm" aria-disabled aria-description={blocked} className="cursor-not-allowed opacity-50">
          <Download className="mr-1 h-4 w-4" />Download
        </Button>
      </Tip>
    );
  }
  const save = async () => {
    setBusy(true);
    try {
      const data = item.kind === 'layered' ? await layeredFile(item, list, reads) : item.value;
      const blob = await (await fetch(data)).blob();
      downloadBlob(blob, mediaFileName({ ...item, value: data }, labelPlaceholders(item.parent.name, placeholders)));
    } catch (e: unknown) {
      toastError(e, { headline: "Couldn't save the file" });
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={() => void save()}>
      <Download className="mr-1 h-4 w-4" />Download
    </Button>
  );
}

/**
 * A media item's actions: Replace, Download (Open Link for a linked image) and Remove. Replace hands over the
 * picked file as a data URL; an image passes the downscale consent against its budget first.
 */
export function MediaActionRow({ item, placeholders, onReplace, onRemove, removeLabel = 'Remove', className = 'flex flex-wrap gap-2' }: {
  item: MediaItem;
  className?: string;
  placeholders: readonly Placeholder[];
  onReplace?: (media: MediaAsset) => void;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const mounted = useMountedRef();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const { promptImage, dialog } = useDownscalePrompt();

  const take = async (file: File) => {
    if (!onReplace) return;
    setReading(true);
    try {
      const read = await fileToDataUrl(file);
      const data = item.kind === 'image' && item.budget ? await promptImage(read, item.budget) : read;
      if (mounted.current) onReplace({ data, type: file.type, name: file.name, size: file.size });
    } catch (e: unknown) {
      toastError(e, { headline: "Couldn't read the file" });
    } finally {
      if (mounted.current) setReading(false);
    }
  };
  const picked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Cleared so picking the same file again still fires.
    e.target.value = '';
    if (file) void trackWork(take(file));
  };

  return (
    <div className={className}>
      {onReplace && (
        <>
          <input ref={input} data-media-replace="" type="file" accept={ACCEPT[item.kind]} className="hidden" onChange={picked} />
          <Button variant="outline" size="sm" disabled={reading} onClick={() => input.current?.click()}>
            <Upload className="mr-1 h-4 w-4" />{item.blank ? 'Upload' : 'Replace'}
          </Button>
        </>
      )}
      {!item.blank && <DownloadButton item={item} placeholders={placeholders} />}
      {item.kind === 'layered' && item.mediaId && <EditLayersButton entryId={item.mediaId} previewAs={entityParentId(item)} size="sm" />}
      {onRemove && (
        <Button variant="outline" size="sm" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />{removeLabel}
        </Button>
      )}
      {dialog}
    </div>
  );
}
