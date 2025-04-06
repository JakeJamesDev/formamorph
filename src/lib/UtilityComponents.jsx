import React, { useCallback, useState  } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Box as LucideBox, Music } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ModelViewer from '../views/ModelViewer';

export const getModelType = (fileName) => {
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

export const ImageUpload = ({ onChange, id, value }) => {
  const handleImageChange = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
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
            <img src={value} alt="Uploaded" className="max-w-full max-h-32 object-contain" />
          ) : (
            <>
              <Upload className="mr-2" />
              <span>Upload Image</span>
            </>
          )}
        </div>
      </Label>
    </div>
  );
};

export const SoundUpload = ({ onChange, id, value }) => {
  const handleSoundChange = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
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
            <div className="w-full">
              <audio src={value.data} controls className="w-full" />
              <p className="text-sm text-gray-500 mt-2">{value.name}</p>
            </div>
          ) : (
            <>
              <Music className="mr-2" />
              <span>Upload Sound</span>
            </>
          )}
        </div>
      </Label>
    </div>
  );
};

export const ModelUpload = ({ model, onModelChange, uniqueId }) => {
  const [isModelViewerOpen, setIsModelViewerOpen] = useState(false);

  const handleModelChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
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
              <span>Upload 3D Model</span>
            </div>
          </Label>
        </div>
      )}
    </div>
  );
};