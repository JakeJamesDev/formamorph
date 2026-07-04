import { useCallback, useState, type ChangeEvent, type MouseEvent } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, Box as LucideBox, Music, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ModelViewer from '../views/ModelViewer';
import AudioPlayer from '../components/game/AudioPlayer';
import { useDownscalePrompt } from './useDownscalePrompt';
import { ImageZoomViewer } from '../components/ImageZoomViewer';
import type { ImageCap } from './imageOptim';
import { readSdPromptFromFile } from './sdMetadata';

/** An uploaded media file, base64-encoded as a data URL. */
interface UploadedMedia {
  name: string;
  type: string;
  size: number;
  data: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const getModelType = (fileName: string) => {
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
      className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
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
      <Label htmlFor={`image-upload-${id}`} className="cursor-pointer">
        {previewClassName ? (
          <div className={previewClassName}>
            {value ? (
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
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                Click to upload image
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-md p-4">
            {value ? (
              <div className="relative">
                <img src={value} alt="Uploaded" onClick={openZoom} className="max-w-full max-h-32 object-contain" />
                {removeButton}
              </div>
            ) : (
              <>
                <ImagePlus className="mr-2" />
                <span>Add Image</span>
              </>
            )}
          </div>
        )}
      </Label>
    </div>
  );
};

export const SoundUpload = ({ onChange, id, value }: {
  onChange: (value: UploadedMedia) => void;
  id: string | number;
  value?: { name?: string; data?: string } | null;
}) => {
  const handleSoundChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        onChange({
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64String
        });
      };
      reader.readAsDataURL(file);
    }
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
      <Label htmlFor={`sound-upload-${id}`} className="cursor-pointer">
        <div className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-md p-4">
          {value ? (
            <div className="w-full" onClick={(e) => e.preventDefault()}>
              <AudioPlayer src={value.data} className="w-full" />
              <p className="text-sm text-gray-500 mt-2">{value.name}</p>
            </div>
          ) : (
            <>
              <Music className="mr-2" />
              <span>Add Sound</span>
            </>
          )}
        </div>
      </Label>
    </div>
  );
};

export const ModelUpload = ({ model, onModelChange, uniqueId }: {
  model?: { name?: string; type?: string; size?: number; data?: string } | null;
  onModelChange: (model: UploadedMedia) => void;
  uniqueId: string | number;
}) => {
  const [isModelViewerOpen, setIsModelViewerOpen] = useState(false);

  const handleModelChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        onModelChange({
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64String
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-2">
      {model ? (
        <div className="flex items-center space-x-2">
          <span>{model.name}</span>
          <Dialog open={isModelViewerOpen} onOpenChange={setIsModelViewerOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">View Model</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>3D Model Viewer</DialogTitle>
              </DialogHeader>
              <ModelViewer model={model} modelType={getModelType(model.name ?? '')} />
            </DialogContent>
          </Dialog>
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
          <Label htmlFor={`model-upload-${uniqueId}`} className="cursor-pointer">
            <div className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-md p-4">
              <LucideBox className="mr-2" />
              <span>Add 3D Model</span>
            </div>
          </Label>
        </div>
      )}
    </div>
  );
};
