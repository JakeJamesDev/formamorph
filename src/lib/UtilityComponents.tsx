import { useCallback, useState, type ChangeEvent } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, Box as LucideBox, Music, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ModelViewer from '../views/ModelViewer';
import AudioPlayer from '../components/game/AudioPlayer';

/** An uploaded media file, base64-encoded as a data URL. */
interface UploadedMedia {
  name: string;
  type: string;
  size: number;
  data: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const getModelType = (fileName: string) => {
  const extension = fileName.split('.').pop().toLowerCase();
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

export const ImageUpload = ({ onChange, id, value }: {
  onChange: (value: string) => void;
  id: string | number;
  value?: string | null;
}) => {
  const handleImageChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        onChange(base64String);
      };
      reader.readAsDataURL(file);
    }
  }, [onChange]);

  return (
    <div>
      <Input
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        className="hidden"
        id={`image-upload-${id}`}
      />
      <Label htmlFor={`image-upload-${id}`} className="cursor-pointer">
        <div className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-md p-4">
          {value ? (
            <div className="relative">
              <img src={value} alt="Uploaded" className="max-w-full max-h-32 object-contain" />
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(""); }}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                title="Remove image"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <ImagePlus className="mr-2" />
              <span>Add Image</span>
            </>
          )}
        </div>
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
    const file = e.target.files[0];
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
    const file = e.target.files[0];
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
              <ModelViewer model={model} modelType={getModelType(model.name)} />
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
