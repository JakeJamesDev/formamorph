import { useCallback, useEffect, useState, type ChangeEvent, type MouseEvent, type ReactNode } from 'react';
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CornerDownLeft, ImagePlus, Link as LucideLink, Box as LucideBox, Music, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";
import ModelViewer from '../views/ModelViewer';
import AudioPlayer from '../components/game/AudioPlayer';
import { useDownscalePrompt } from './useDownscalePrompt';
import { ImageZoomViewer } from '../components/ImageZoomViewer';
import { ImageConvertOverlay } from '../components/ImageConvertOverlay';
import type { ImageCap } from './imageOptim';
import { readSdPromptFromFile } from './sdMetadata';
import { imageHost, isRemoteImage } from './imageSource';
import { isExpiringImageHost } from './imageBytes';
import { useRemoteImage } from './useRemoteImage';
import { fileToDataUrl } from './imageDrop';
import { useImageDropTarget } from './useImageDropTarget';
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
const Dropzone = ({ htmlFor, frameClassName, dragOver, overlay, children }: {
  htmlFor?: string;
  frameClassName?: string;
  /** A droppable drag is overhead — the frame says so rather than leaving the gesture to guesswork. */
  dragOver?: boolean;
  /** Covers the frame edge to edge. Anchored here rather than outside, because a caller's own
   *  `frameClassName` may centre and cap the frame's width — anchoring further out spills past the picture. */
  overlay?: ReactNode;
  children: ReactNode;
}) => {
  const frame = (
    <div
      className={cn(
        'relative border-2 border-dashed border-border rounded-md',
        frameClassName ?? 'flex items-center justify-center p-4',
        dragOver && 'border-primary ring-2 ring-primary',
      )}
    >
      {children}
      {/* Inside the label, so a click on it would otherwise re-open the file picker mid-encode. */}
      {overlay && <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>{overlay}</div>}
    </div>
  );
  // No target input (upload withheld) ⇒ a plain box: a Label pointing nowhere would still read as clickable.
  return htmlFor ? <Label htmlFor={htmlFor} className="cursor-pointer">{frame}</Label> : frame;
};

export const ImageUpload = ({ onChange, id, value, cap, previewClassName, objectFit = 'contain', onPromptExtracted, onFiles, allowUpload = true, uploadBlockedNote }: {
  onChange: (value: string) => void;
  // Several pictures arriving at once (a multi-file drop). A caller holding more than one slot takes them
  // all; without this the first file is used and the rest are ignored, which is right for a single slot.
  onFiles?: (files: File[]) => void;
  id: string | number;
  value?: string | null;
  cap?: ImageCap;
  // False withdraws the file picker from an empty slot while leaving the URL box — the caller has spent its
  // allowance for pictures carrying their own bytes. `uploadBlockedNote` says why, in the picker's place.
  allowUpload?: boolean;
  uploadBlockedNote?: string;
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
  // The picture currently being re-encoded, shown dimmed under a bar. Null whenever nothing is converting.
  const [encoding, setEncoding] = useState<string | null>(null);
  const remote = isRemoteImage(value);
  // Cached blob when there is one, live URL otherwise; an embedded value passes through untouched.
  // `status` is what tells the author this host won't hand its bytes over.
  const { src: displaySrc, status } = useRemoteImage(value);
  // Known before any request, so this shows the instant the link is pasted.
  const expiring = isExpiringImageHost(value);

  // Whether the draft is something the slot could take, which lights the commit button.
  const urlCommittable = isRemoteImage(urlDraft.trim());

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

  /** Store one picked or dropped file into this slot. */
  const takeFile = useCallback(async (file: File) => {
    // Parse the raw file for an embedded SD prompt before the FileReader/optimize path re-encodes it.
    if (onPromptExtracted) void readSdPromptFromFile(file).then((p) => { if (p) onPromptExtracted(p); });
    const dataUrl = await fileToDataUrl(file);
    if (!cap) { onChange(dataUrl); return; }
    // The overlay shows the file itself, not the data URL about to be encoded — an <img> given a
    // multi-megabyte base64 string blocks the main thread long enough to swallow the overlay whole.
    const thumb = URL.createObjectURL(file);
    try {
      // Offer to downscale before storing when the image exceeds its budget. The overlay is raised from
      // inside the prompt, once a choice is made — not here, or it would sit behind the consent dialog.
      onChange(await promptImage(dataUrl, cap, () => setEncoding(thumb)));
    } finally {
      setEncoding(null);
      URL.revokeObjectURL(thumb);
    }
  }, [onChange, cap, promptImage, onPromptExtracted]);

  const handleImageChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    // Clear the input so re-selecting the same file fires change again (a remove-then-reupload otherwise no-ops).
    e.target.value = '';
    if (!files.length) return;
    if (files.length > 1 && onFiles) onFiles(files);
    else void takeFile(files[0]);
  }, [takeFile, onFiles]);

  const takeDropped = useCallback((files: File[]) => {
    if (files.length > 1 && onFiles) onFiles(files);
    else void takeFile(files[0]);
  }, [onFiles, takeFile]);

  // A filled slot never takes a drop: it is changed by removing it first, exactly as the URL box already
  // works. Dropping onto a picture and silently replacing it is the hard gesture to take back.
  const { dragOver, dropProps } = useImageDropTarget({
    enabled: !value,
    allowFiles: allowUpload,
    onUrl: onChange,
    onFiles: takeDropped,
  });

  const removeButton = (
    <Tip tip="Remove image">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(""); }}
        className="absolute top-1 right-1 rounded-full bg-overlay/60 p-1 text-white hover:bg-overlay/80"
      >
        <X className="h-4 w-4" />
      </button>
    </Tip>
  );

  // Clicking an uploaded image opens the shared pan/zoom viewer instead of re-triggering the file picker.
  const openZoom = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); setZoomOpen(true); };

  /** Only offered on an empty slot: a filled one is changed by removing it first, as it always was. */
  const urlBox = (
    // Sited inside the frame, this sits within the Label. preventDefault, not stopPropagation: opening the
    // picker is the label's default action for the click, so halting the React event does not cancel it.
    // The input and the button are exempt already — a label never activates for interactive content — but
    // the gap between them and the line held for an error are not.
    <div className="w-full space-y-1" onClick={(e) => e.preventDefault()}>
      {/* Field and button are one widget: the button fills the field's right edge, divided from it by a
          border rather than a gap, so it reads as a second cell and not a second control. `pr-10` keeps
          typed text clear of it. */}
      <div className="group relative">
        <Input
          type="url"
          value={urlDraft}
          onChange={(e) => { setUrlDraft(e.target.value); setUrlError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitUrl(); } }}
          // "Or" only while uploading is still on offer; with the allowance spent this is the way in.
          placeholder={allowUpload ? 'Or paste an image URL' : 'Paste an image URL'}
          aria-label="Image URL"
          // The focus ring is drawn by the overlay below instead, so it lands over both cells rather than
          // being covered by the button along the edge they share.
          className="pr-10 focus-visible:ring-0"
        />
        {/* Icon-only: the label was the width of the word for an action the Enter key already performs, and
            the icon says so. Lit only once the draft is a link it can take — until then it's inert, so the
            cell says whether pressing it would do anything. */}
        <Tip tip="Use this image URL">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!urlCommittable}
            className={cn(
              // Only the divider edge is bordered, so the cell shares the field's own frame on its other three
              // sides. `disabled:opacity-100` keeps that divider at full strength while inert — the muted
              // foreground carries the off state on its own.
              'absolute inset-y-0 right-0 h-auto w-10 rounded-l-none border-y-0 border-r-0 border-l border-l-input disabled:opacity-100',
              urlCommittable
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-transparent text-muted-foreground',
            )}
            onClick={commitUrl}
          >
            <CornerDownLeft className="h-4 w-4" />
          </Button>
        </Tip>
        {/* Last child, so the focus ring paints over the button cell too and reads as one widget's glow
            rather than stopping at the divider. Inert to the pointer, so it never eats a click. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-md ring-ring ring-inset group-focus-within:ring-2"
        />
      </div>
      {/* The line is held whether or not it says anything, so a rejected link doesn't shift the box either. */}
      <p className="min-h-4 text-meta text-destructive">{urlError}</p>
    </div>
  );

  // A new resolved src gets a fresh chance to load — otherwise one bad link poisons the slot after it's
  // replaced. Keyed on displaySrc (not value): it lags value by a render, so a value-keyed reset can run
  // before a stale-src error lands and the failure would latch.
  useEffect(() => { setLoadFailed(false); }, [displaySrc]);

  // Marks a filled slot as pointing somewhere rather than carrying its own bytes, and says when that link
  // comes with a catch. An expiring host outranks an unreadable one: it breaks everything, just later.
  const badge = expiring
    ? {
        label: 'Expiring link',
        tip: `Discord links like this one stop working after a while. Use a permanent host so the picture doesn't disappear later.\n${value ?? ''}`,
        className: 'bg-amber-500/90',
        icon: <AlertTriangle className="h-3 w-3" />,
      }
    : status === 'unreadable'
      ? {
          label: 'Linked image, display only',
          tip: `${imageHost(value ?? '')} won't let Formamorph download this picture. It shows online, but won't work offline and can't be put into a character card.\n${value ?? ''}`,
          className: 'bg-amber-500/90',
          icon: <LucideLink className="h-3 w-3" />,
        }
      : {
          label: 'Linked image',
          tip: value ?? '',
          className: 'bg-overlay/60',
          icon: <LucideLink className="h-3 w-3" />,
        };

  // A marker with nothing but its tip to go on, so it takes a tab stop rather than staying mouse-only.
  const remoteBadge = remote && (
    <Tip tip={badge.tip}>
      <span
        tabIndex={0}
        className={cn('absolute top-1 left-1 rounded-full p-1 text-white', badge.className)}
        aria-label={badge.label}
      >
        {badge.icon}
      </span>
    </Tip>
  );

  // A dead link is worth showing at authoring time rather than letting it surface mid-play.
  const brokenFrame = (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center text-muted-foreground">
      <span className="text-label">Couldn&apos;t load this image</span>
      <span className="max-w-full truncate text-meta opacity-70">{value}</span>
    </div>
  );

  return (
    <div className="space-y-1">
      {dialog}
      {value && <ImageZoomViewer src={displaySrc} alt="" open={zoomOpen} onOpenChange={setZoomOpen} />}
      {allowUpload && (
        <Input
          type="file"
          accept="image/*"
          multiple={!!onFiles}
          onChange={handleImageChange}
          className="hidden"
          id={`image-upload-${id}`}
        />
      )}
      {/* Wrapped rather than handled inside Dropzone: the frame is a Label when it is clickable, and a drop
          on a label's own child would otherwise re-open the file picker on the way through. */}
      <div {...dropProps} className="relative">
      <Dropzone
        htmlFor={allowUpload ? `image-upload-${id}` : undefined}
        frameClassName={previewClassName}
        dragOver={dragOver}
        overlay={encoding && <ImageConvertOverlay thumb={encoding} done={0} total={1} objectFit={objectFit} />}
      >
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
            // The link field lives in the empty frame rather than under it: the frame is already this tall,
            // so nothing below the slot moves when an empty one comes into view.
            // The overlay's thumbnail is dimmed rather than opaque, so anything left underneath shows through it.
            encoding ? null : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-muted-foreground">
                <span className="text-label">
                  {dragOver ? 'Drop to add' : allowUpload ? 'Click to upload image' : uploadBlockedNote}
                </span>
                <div className="w-full max-w-[280px]">{urlBox}</div>
              </div>
            )
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
            encoding ? null : allowUpload ? (
              <>
                <ImagePlus className="mr-2" />
                <span>{dragOver ? 'Drop to add' : 'Add Image'}</span>
              </>
            ) : (
              <span className="text-center text-helper text-muted-foreground">{uploadBlockedNote}</span>
            )
          )
        )}
      </Dropzone>
      </div>
      {/* The longest-fuse failure gets a line of its own, not just a tooltip — by the time it bites, the
          author is long past hovering this slot. */}
      {expiring && (
        <p className="text-meta text-amber-600 dark:text-amber-500">
          This Discord link will stop working. Re-upload the image or use a permanent host.
        </p>
      )}
      {/* A frame sized by its caller holds this inside itself; a compact box has no room, so it sits below. */}
      {!value && !previewClassName && !encoding && urlBox}
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
              <p className="text-helper text-muted-foreground truncate">{value.name}</p>
              <Tip tip="Remove sound">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(undefined); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </Tip>
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
              <Button variant="outline">View 3D Model</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>3D Model Viewer</DialogTitle>
              <DialogDescription className="sr-only">Interactive 3D model. Drag to rotate, scroll to zoom.</DialogDescription>
              </DialogHeader>
              <ModelViewer model={model} modelType={resolveModelType(model)} />
            </DialogContent>
          </Dialog>
          <Tip tip="Remove model">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onModelChange(undefined)}
            >
              <X className="h-4 w-4" />
            </Button>
          </Tip>
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
