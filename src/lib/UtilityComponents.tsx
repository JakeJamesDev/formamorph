import { useCallback, useEffect, useState, type ChangeEvent, type MouseEvent, type ReactNode } from 'react';
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, ImagePlus, Link as LucideLink, Box as LucideBox, Music, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ModelViewer from '../views/ModelViewer';
import AudioPlayer from '../components/game/AudioPlayer';
import { useDownscalePrompt } from './useDownscalePrompt';
import { ImageZoomViewer } from '../components/ImageZoomViewer';
import type { ImageCap } from './imageOptim';
import { readSdPromptFromFile } from './sdMetadata';
import { imageHost, isRemoteImage } from './imageSource';
import { isExpiringImageHost } from './imageBytes';
import { useRemoteImage } from './useRemoteImage';
import type { MediaAsset } from '@/types';

/** An uploaded media file, base64-encoded as a data URL. */
interface UploadedMedia {
  name: string;
  type: string;
  size: number;
  data: string;
}

/** Read an uploaded file into the base64 data-URL envelope the media uploaders emit. */
function readMediaFile(file: File): Promise<UploadedMedia> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({ name: file.name, type: file.type, size: file.size, data: reader.result as string });
    reader.readAsDataURL(file);
  });
}

export type ModelType = 'glb' | 'fbx' | 'obj' | 'unknown';

const typeFromExtension = (fileName: string): ModelType => {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  switch (extension) {
    case 'glb':
    case 'gltf':
      return 'glb';
    case 'fbx':
      return 'fbx';
    case 'obj':
      return 'obj';
    default:
      return 'unknown';
  }
};

/** Browsers report model MIME types inconsistently — often empty for .fbx/.obj — so this map is a hint, not a source of truth. */
const MODEL_MIME_TYPES: Record<string, ModelType> = {
  'model/gltf-binary': 'glb',
  'model/gltf+json': 'glb',
  'model/obj': 'obj',
  'application/x-tgif': 'obj',
  'application/octet-stream': 'unknown',
};

/** Last resort: read the file's leading bytes. GLB and binary FBX both carry a magic string; the text formats are matched by their opening tokens. */
const typeFromMagic = (data: string): ModelType => {
  const marker = data.indexOf(';base64,');
  if (marker === -1) return 'unknown';
  let head: string;
  try {
    head = atob(data.slice(marker + 8, marker + 8 + 64));
  } catch {
    return 'unknown';
  }
  if (head.startsWith('glTF')) return 'glb';
  if (head.startsWith('Kaydara FBX') || head.includes('FBXHeaderExtension')) return 'fbx';
  if (/^\s*\{/.test(head)) return 'glb'; // .gltf JSON — GLTFLoader reads both
  if (/^\s*(#|v\s|vt\s|vn\s|o\s|g\s|mtllib\s)/.test(head)) return 'obj';
  return 'unknown';
};

/** Pick the loader for an uploaded model: filename first, then MIME, then the file's own bytes. */
// eslint-disable-next-line react-refresh/only-export-components
export const resolveModelType = (model: Partial<MediaAsset>): ModelType => {
  const byName = model.name ? typeFromExtension(model.name) : 'unknown';
  if (byName !== 'unknown') return byName;
  const mime = (model.type || model.data?.slice(5, model.data.indexOf(';')) || '').toLowerCase();
  const byMime = MODEL_MIME_TYPES[mime];
  if (byMime && byMime !== 'unknown') return byMime;
  return model.data ? typeFromMagic(model.data) : 'unknown';
};

/** The shared dashed "click to upload" frame for the media uploaders (image / sound / 3D model). Pass
 *  `frameClassName` to give it a fixed size (e.g. the thumbnail crop); without it the box is compact and
 *  auto-sized. The dashed look lives here so every uploader stays in sync. */
const Dropzone = ({ htmlFor, frameClassName, children }: { htmlFor: string; frameClassName?: string; children: ReactNode }) => (
  <Label htmlFor={htmlFor} className="cursor-pointer">
    <div className={cn('border-2 border-dashed border-border rounded-md', frameClassName ?? 'flex items-center justify-center p-4')}>
      {children}
    </div>
  </Label>
);

export const ImageUpload = ({ onChange, id, value, cap, previewClassName, objectFit = 'contain', onPromptExtracted }: {
  onChange: (value: string) => void;
  id: string | number;
  value?: string | null;
  cap?: ImageCap;
  // Optional fixed-size preview box (e.g. the 4:3 thumbnail crop). When set, replaces the default dashed box.
  previewClassName?: string;
  objectFit?: 'contain' | 'cover';
  // Called with the embedded SD positive prompt when an A1111/Forge PNG is uploaded (before optimization
  // strips the metadata). Lets callers offer to reuse it (e.g. as Image Tags).
  onPromptExtracted?: (positivePrompt: string) => void;
}) => {
  const { promptImage, dialog } = useDownscalePrompt();
  const [zoomOpen, setZoomOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const remote = isRemoteImage(value);
  // Cached blob when there is one, live URL otherwise; an embedded value passes through untouched.
  // `status` is what tells the author this host won't hand its bytes over.
  const { src: displaySrc, status } = useRemoteImage(value);
  // Known before any request, so this shows the instant the link is pasted.
  const expiring = isExpiringImageHost(value);

  // A pasted link is stored verbatim — no downscale pass, since a remote image costs the payload nothing.
  const commitUrl = useCallback(() => {
    const trimmed = urlDraft.trim();
    if (!trimmed) return;
    if (!isRemoteImage(trimmed)) {
      setUrlError('Enter a link starting with http:// or https://');
      return;
    }
    setUrlError(null);
    setUrlDraft('');
    onChange(trimmed);
  }, [urlDraft, onChange]);

  const handleImageChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear the input so re-selecting the same file fires change again (a remove-then-reupload otherwise no-ops).
    e.target.value = '';
    if (file) {
      // Parse the raw file for an embedded SD prompt before the FileReader/optimize path re-encodes it.
      if (onPromptExtracted) void readSdPromptFromFile(file).then((p) => { if (p) onPromptExtracted(p); });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        // Offer to downscale before storing when the image exceeds its budget (no-op if within cap or no cap).
        onChange(cap ? await promptImage(base64String, cap) : base64String);
      };
      reader.readAsDataURL(file);
    }
  }, [onChange, cap, promptImage, onPromptExtracted]);

  const removeButton = (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(""); }}
      className="absolute top-1 right-1 rounded-full bg-overlay/60 p-1 text-white hover:bg-overlay/80"
      title="Remove image"
      aria-label="Remove image"
    >
      <X className="h-4 w-4" />
    </button>
  );

  // Clicking an uploaded image opens the shared pan/zoom viewer instead of re-triggering the file picker.
  const openZoom = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); setZoomOpen(true); };

  // A new resolved src gets a fresh chance to load — otherwise one bad link poisons the slot after it's
  // replaced. Keyed on displaySrc (not value): it lags value by a render, so a value-keyed reset can run
  // before a stale-src error lands and the failure would latch.
  useEffect(() => { setLoadFailed(false); }, [displaySrc]);

  // Marks a filled slot as pointing somewhere rather than carrying its own bytes, and says when that link
  // comes with a catch. An expiring host outranks an unreadable one: it breaks everything, just later.
  const badge = expiring
    ? {
        label: 'Expiring link',
        title: `Discord links like this one stop working after a while. Use a permanent host so the picture doesn't disappear later.\n${value ?? ''}`,
        className: 'bg-amber-500/90',
        icon: <AlertTriangle className="h-3 w-3" />,
      }
    : status === 'unreadable'
      ? {
          label: 'Linked image, display only',
          title: `${imageHost(value ?? '')} won't let Formamorph download this picture. It shows online, but won't work offline and can't be put into a character card.\n${value ?? ''}`,
          className: 'bg-amber-500/90',
          icon: <LucideLink className="h-3 w-3" />,
        }
      : {
          label: 'Linked image',
          title: value ?? '',
          className: 'bg-overlay/60',
          icon: <LucideLink className="h-3 w-3" />,
        };

  const remoteBadge = remote && (
    <span
      className={cn('absolute top-1 left-1 rounded-full p-1 text-white', badge.className)}
      title={badge.title}
      aria-label={badge.label}
    >
      {badge.icon}
    </span>
  );

  // A dead link is worth showing at authoring time rather than letting it surface mid-play.
  const brokenFrame = (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center text-muted-foreground">
      <span className="text-sm">Couldn&apos;t load this image</span>
      <span className="max-w-full truncate text-xs opacity-70">{value}</span>
    </div>
  );

  return (
    <div className="space-y-1">
      {dialog}
      {value && <ImageZoomViewer src={displaySrc} alt="" open={zoomOpen} onOpenChange={setZoomOpen} />}
      <Input
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        className="hidden"
        id={`image-upload-${id}`}
      />
      <Dropzone htmlFor={`image-upload-${id}`} frameClassName={previewClassName}>
        {previewClassName ? (
          value ? (
            <>
              {/* displaySrc lags value by a render; an <img src=""> fires error and would latch the broken frame. */}
              {loadFailed ? brokenFrame : displaySrc ? (
                <img
                  src={displaySrc}
                  alt="Uploaded"
                  onClick={openZoom}
                  onError={() => setLoadFailed(true)}
                  className={`absolute inset-0 w-full h-full rounded-md ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}`}
                />
              ) : null}
              {remoteBadge}
              {removeButton}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              Click to upload image
            </div>
          )
        ) : (
          value ? (
            <div className="relative">
              {loadFailed ? (
                <div className="flex h-32 w-48 items-center justify-center">{brokenFrame}</div>
              ) : displaySrc ? (
                <img
                  src={displaySrc}
                  alt="Uploaded"
                  onClick={openZoom}
                  onError={() => setLoadFailed(true)}
                  className="max-w-full max-h-32 object-contain"
                />
              ) : null}
              {remoteBadge}
              {removeButton}
            </div>
          ) : (
            <>
              <ImagePlus className="mr-2" />
              <span>Add Image</span>
            </>
          )
        )}
      </Dropzone>
      {/* The longest-fuse failure gets a line of its own, not just a tooltip — by the time it bites, the
          author is long past hovering this slot. */}
      {expiring && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          This Discord link will stop working. Re-upload the picture or use a permanent host.
        </p>
      )}
      {/* Only offered on an empty slot: a filled one is changed by removing it first, as it always was. */}
      {!value && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Input
              type="url"
              value={urlDraft}
              onChange={(e) => { setUrlDraft(e.target.value); setUrlError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitUrl(); } }}
              placeholder="Or paste an image URL"
              aria-label="Image URL"
              className="h-8 text-sm"
            />
            <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={commitUrl}>
              Use
            </Button>
          </div>
          {urlError && <p className="text-xs text-destructive">{urlError}</p>}
        </div>
      )}
    </div>
  );
};

export const SoundUpload = ({ onChange, id, value }: {
  onChange: (value: UploadedMedia | undefined) => void;
  id: string | number;
  value?: { name?: string; data?: string } | null;
}) => {
  const handleSoundChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readMediaFile(file).then(onChange);
  }, [onChange]);

  return (
    <div>
      <Input
        type="file"
        accept="audio/*"
        onChange={handleSoundChange}
        className="hidden"
        id={`sound-upload-${id}`}
      />
      <Dropzone htmlFor={`sound-upload-${id}`}>
        {value ? (
          <div className="w-full" onClick={(e) => e.preventDefault()}>
            <AudioPlayer src={value.data} className="w-full" />
            <div className="flex items-center justify-between gap-2 mt-2">
              <p className="text-sm text-muted-foreground truncate">{value.name}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(undefined); }}
                title="Remove sound"
                aria-label="Remove sound"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Music className="mr-2" />
            <span>Add Sound</span>
          </>
        )}
      </Dropzone>
    </div>
  );
};

export const ModelUpload = ({ model, onModelChange, uniqueId }: {
  model?: Partial<MediaAsset> | null;
  onModelChange: (model: UploadedMedia | undefined) => void;
  uniqueId: string | number;
}) => {
  const [isModelViewerOpen, setIsModelViewerOpen] = useState(false);

  const handleModelChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readMediaFile(file).then(onModelChange);
  };

  return (
    <div className="space-y-2">
      {model ? (
        <div className="flex items-center space-x-2">
          <span className="truncate">{model.name ?? '3D model'}</span>
          <Dialog open={isModelViewerOpen} onOpenChange={setIsModelViewerOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">View Model</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>3D Model Viewer</DialogTitle>
              <DialogDescription className="sr-only">Interactive 3D model. Drag to rotate, scroll to zoom.</DialogDescription>
              </DialogHeader>
              <ModelViewer model={model} modelType={resolveModelType(model)} />
            </DialogContent>
          </Dialog>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onModelChange(undefined)}
            title="Remove model"
            aria-label="Remove model"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div>
          <Input
            type="file"
            accept=".glb,.gltf,.fbx,.obj"
            onChange={handleModelChange}
            className="hidden"
            id={`model-upload-${uniqueId}`}
          />
          <Dropzone htmlFor={`model-upload-${uniqueId}`}>
            <LucideBox className="mr-2" />
            <span>Add 3D Model</span>
          </Dropzone>
        </div>
      )}
    </div>
  );
};
