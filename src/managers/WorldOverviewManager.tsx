import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from 'react-toastify';
import AudioPlayer from '../components/game/AudioPlayer';
import { ImageUpload } from '../lib/UtilityComponents';
import { IMAGE_CAPS } from '../lib/imageOptim';
import { GenerateImageButton } from '../components/GenerateImageButton';
import { ModelDetailsPanel } from '../components/modals/ModelDetailsPanel';
import { readVrmMeta } from '../lib/vrmMeta';
import type { VrmLicense } from '@/types';

/**
 * The world's custom player VRM in the same details view the model library uses. The world stores the model
 * inline as a data URL rather than as a library record, so the bytes are decoded here and its license is read
 * from the file itself. Its own component so the work happens only while the preview is open.
 */
const PlayerVrmPreview = ({ data, open, onClose }: { data: string; open: boolean; onClose: () => void }) => {
  const [url, setUrl] = useState<string | undefined>();
  const [meta, setMeta] = useState<{ license?: VrmLicense; size?: number }>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    fetch(data)
      .then((r) => r.blob())
      .then(async (blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        const { license } = await readVrmMeta(blob);
        if (!cancelled) setMeta({ license, size: blob.size });
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [data]);

  return (
    <ModelDetailsPanel
      open={open}
      name="Player Model"
      url={url}
      license={meta.license}
      size={meta.size}
      failed={failed}
      onClose={onClose}
    />
  );
};

const WorldOverviewManager = () => {
  const { worldOverview, updateWorldOverview } = useGameData();
  const bgmInputRef = useRef<HTMLInputElement>(null);
  const vrmInputRef = useRef<HTMLInputElement>(null);
  const [vrmPreviewOpen, setVrmPreviewOpen] = useState(false);
  // Mounted on first open and kept mounted from then on: decoding a VRM's tens of megabytes shouldn't happen
  // just because the tab is showing, but unmounting on close would cut the dialog's close animation short.
  const [vrmPreviewMounted, setVrmPreviewMounted] = useState(false);

  const handleBGMChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith('audio/')) {
        toast.error('Please select an audio file');
        return;
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const base64String = e.target?.result as string;
          updateWorldOverview({ bgm: base64String });
        } catch (error) {
          console.error('Error processing audio:', error);
          toast.error('Error processing audio. Please try again.');
        }
      };

      reader.onerror = () => {
        console.error('Error reading file');
        toast.error('Error reading file. Please try again.');
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
          toast.error('Error processing VRM. Please try again.');
        }
      };
      reader.onerror = () => {
        toast.error('Error reading file. Please try again.');
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
              <>
                <Button variant="outline" onClick={() => { setVrmPreviewMounted(true); setVrmPreviewOpen(true); }}>
                  Preview
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => updateWorldOverview({ customPlayerVRM: null })}
                >
                  Remove
                </Button>
              </>
            )}
          </div>
          {worldOverview.customPlayerVRM?.data && vrmPreviewMounted && (
            <PlayerVrmPreview
              data={worldOverview.customPlayerVRM.data}
              open={vrmPreviewOpen}
              onClose={() => setVrmPreviewOpen(false)}
            />
          )}
          <p className="text-xs text-muted-foreground">
            Overrides the default 3D player model.
          </p>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="image-upload-thumbnail">Thumbnail Image</Label>
        <ImageUpload
          id="thumbnail"
          value={worldOverview.thumbnail}
          onChange={(v) => updateWorldOverview({ thumbnail: v })}
          cap={IMAGE_CAPS.thumbnail}
          objectFit="cover"
          previewClassName="w-full max-w-[400px] aspect-video relative rounded-md hover:border-muted-foreground transition-colors mx-auto"
        />
        <div className="flex justify-center">
          <GenerateImageButton
            subject={{ name: worldOverview.name || '', description: worldOverview.description || worldOverview.systemPrompt || '', kind: 'world' }}
            cap={IMAGE_CAPS.thumbnail}
            onChange={(v) => updateWorldOverview({ thumbnail: v })}
          />
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
