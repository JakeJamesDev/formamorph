import { useRef, useEffect, type ChangeEvent } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { toast } from 'react-toastify';
import AudioPlayer from '../components/game/AudioPlayer';

const WorldOverviewManager = () => {
  const { worldOverview, updateWorldOverview } = useGameData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgmInputRef = useRef<HTMLInputElement>(null);
  const thumbnailRef = useRef<HTMLImageElement>(null);
  const vrmInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (worldOverview.thumbnail && thumbnailRef.current) {
      thumbnailRef.current.src = worldOverview.thumbnail;
    }
  }, [worldOverview.thumbnail]);

  const handleThumbnailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast.dark('Please select an image file', { type: 'error' });
        return;
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const base64String = e.target?.result as string;
          // Store the base64 string in the world overview
          updateWorldOverview({ thumbnail: base64String });
        } catch (error) {
          console.error('Error processing image:', error);
          toast.dark('Error processing image. Please try again.', { type: 'error' });
        }
      };

      reader.onerror = () => {
        console.error('Error reading file');
        toast.dark('Error reading file. Please try again.', { type: 'error' });
      };

      reader.readAsDataURL(file);
    }
  };

  const handleThumbnailClick = () => {
    fileInputRef.current?.click();
  };

  const handleBGMChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith('audio/')) {
        toast.dark('Please select an audio file', { type: 'error' });
        return;
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const base64String = e.target?.result as string;
          updateWorldOverview({ bgm: base64String });
        } catch (error) {
          console.error('Error processing audio:', error);
          toast.dark('Error processing audio. Please try again.', { type: 'error' });
        }
      };

      reader.onerror = () => {
        console.error('Error reading file');
        toast.dark('Error reading file. Please try again.', { type: 'error' });
      };

      reader.readAsDataURL(file);
    }
  };

  const handleBGMClick = () => {
    bgmInputRef.current?.click();
  };

  const handleVRMChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          updateWorldOverview({
            customPlayerVRM: { data: e.target?.result as string, type: file.type || 'model/vrm' },
          });
        } catch (error) {
          console.error('Error processing VRM:', error);
          toast.dark('Error processing VRM. Please try again.', { type: 'error' });
        }
      };
      reader.onerror = () => {
        toast.dark('Error reading file. Please try again.', { type: 'error' });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVRMClick = () => {
    vrmInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="worldName">World Name</Label>
        <Input
          id="worldName"
          value={worldOverview.name}
          onChange={(e) => updateWorldOverview({ name: e.target.value })}
          placeholder="Enter world name..."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="worldAuthor">Author</Label>
        <Input
          id="worldAuthor"
          value={worldOverview.author}
          onChange={(e) => updateWorldOverview({ author: e.target.value })}
          placeholder="Enter author name..."
        />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="use3DModel"
          checked={worldOverview.use3DModel}
          onCheckedChange={(checked) => updateWorldOverview({ use3DModel: checked === true })}
        />
        <Label htmlFor="use3DModel">Enable 3D Character Model (also allow the player to customize it)</Label>
      </div>
      {worldOverview.use3DModel && (
        <div className="space-y-2">
          <Label htmlFor="customVRM">Custom Player Model (VRM)</Label>
          <input
            ref={vrmInputRef}
            id="customVRM"
            type="file"
            accept=".vrm,.glb"
            onChange={handleVRMChange}
            className="hidden"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleVRMClick}
              className="flex-1"
            >
              {worldOverview.customPlayerVRM ? "Change Player VRM" : "Add Player VRM"}
            </Button>
            {worldOverview.customPlayerVRM && (
              <Button
                variant="destructive"
                onClick={() => updateWorldOverview({ customPlayerVRM: null })}
              >
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Overrides the default 3D player model.
          </p>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="thumbnail">Thumbnail Image</Label>
        <input
          ref={fileInputRef}
          id="thumbnail"
          type="file"
          accept="image/*"
          onChange={handleThumbnailChange}
          className="hidden"
        />
        <div
          onClick={handleThumbnailClick}
          className="w-[350px] h-[262.5px] relative bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200 transition-colors mx-auto"
        >
          {worldOverview.thumbnail ? (
            <>
              <img
                ref={thumbnailRef}
                src={worldOverview.thumbnail}
                alt="World thumbnail"
                className="absolute inset-0 w-full h-full object-cover rounded-md"
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); updateWorldOverview({ thumbnail: '' }); }}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                title="Remove image"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              Click to upload image
            </div>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="bgm">Background Music</Label>
        <input
          ref={bgmInputRef}
          id="bgm"
          type="file"
          accept="audio/*"
          onChange={handleBGMChange}
          className="hidden"
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleBGMClick}
            className="flex-1"
          >
            {worldOverview.bgm ? "Change BGM" : "Add BGM"}
          </Button>
          {worldOverview.bgm && (
            <Button
              variant="destructive"
              onClick={() => updateWorldOverview({ bgm: null })}
            >
              Remove
            </Button>
          )}
        </div>
        {worldOverview.bgm && (
          <div className="mt-2">
            <AudioPlayer src={worldOverview.bgm} className="w-full" />
          </div>
        )}
      </div>
    </div>
  );
};

export default WorldOverviewManager;
