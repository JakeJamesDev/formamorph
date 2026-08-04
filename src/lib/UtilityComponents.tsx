import { useCallback, useState, type ChangeEvent, type MouseEvent, type ReactNode } from 'react';
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, Box as LucideBox, Music, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ModelViewer from '../views/ModelViewer';
import AudioPlayer from '../components/game/AudioPlayer';
import { useDownscalePrompt } from './useDownscalePrompt';
import { ImageZoomViewer } from '../components/ImageZoomViewer';
import type { ImageCap } from './imageOptim';
import { readSdPromptFromFile } from './sdMetadata';
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
  const handleImageChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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

  return (
    <div>
      {dialog}
      {value && <ImageZoomViewer src={value} alt="" open={zoomOpen} onOpenChange={setZoomOpen} />}
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
              <img
                src={value}
                alt="Uploaded"
                onClick={openZoom}
                className={`absolute inset-0 w-full h-full rounded-md ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}`}
              />
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
              <img src={value} alt="Uploaded" onClick={openZoom} className="max-w-full max-h-32 object-contain" />
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
