import { useState, useEffect, type ChangeEvent } from 'react';
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { MobileControlsDrawer } from "@/components/MobileControlsDrawer"
import { useIsMobile } from "@/lib/useIsMobile"
import { cn } from "@/lib/utils"
import VRMViewer from './VRMViewer';
import { useGameData } from '../contexts/GameDataContext';
import type { CharacterData, ModelMetadata } from '@/types';
import ModelStorageService from '@/services/ModelStorageService';
import { usePlayerModelUrl } from '@/lib/usePlayerModelUrl';
import { useVrmCustomization } from '@/lib/useVrmCustomization';
import { DEFAULT_MODEL_ID, DEFAULT_MODEL_URL } from '@/lib/defaultModel';
import { toast } from 'react-toastify';

const CharacterCustomization = ({ onCharacterCustomized, onBack, onAbort }: {
  onCharacterCustomized: (data: CharacterData) => void;
  /** Step back in the enter-world flow. Undefined on the flow's first step, where the button becomes Abort. */
  onBack?: () => void;
  /** Cancel the whole enter-world flow (shown as Abort when there's no previous step to go back to). */
  onAbort?: () => void;
}) => {
  const { worldOverview } = useGameData();
  // The sliders and color pickers (and the state that drives the preview) live in the shared hook, so the
  // model-library details modal can offer the same controls to test an exported model.
  const { setCaps, vrmViewerRef, viewerProps, controls, characterData } = useVrmCustomization();

  // Player model selection + local model library (per-browser, persisted in IndexedDB).
  const [selectedModelId, setSelectedModelId] = useState<string>(worldOverview?.customPlayerVRM ? 'world' : DEFAULT_MODEL_ID);
  const [libraryModels, setLibraryModels] = useState<ModelMetadata[]>([]);
  const resolvedModelUrl = usePlayerModelUrl(selectedModelId);
  const refreshLibrary = () => ModelStorageService.getModelMetadata().then(setLibraryModels);
  // Seed the bundled default before listing, so the picker isn't blank if this screen is reached before
  // MainMenu has seeded (its default selection is DEFAULT_MODEL_ID, which must exist to show as selected).
  // Seeding is idempotent — a no-op once done.
  useEffect(() => {
    ModelStorageService.seedDefaultModel(DEFAULT_MODEL_URL).finally(refreshLibrary);
  }, []);

  const handleModelUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const model = await ModelStorageService.addModel(file);
      await refreshLibrary();
      setSelectedModelId(model.id);
    } catch (err) {
      console.error('Failed to add model', err);
      toast.error('Could not save that model (storage may be full).');
    }
  };

  const handleModelDelete = async (id: string) => {
    try {
      await ModelStorageService.deleteModel(id);
    } catch (err) {
      // The library refuses to drop its last model; surface why rather than failing the click silently.
      toast.error((err as Error).message);
      return;
    }
    if (selectedModelId === id) setSelectedModelId(worldOverview?.customPlayerVRM ? 'world' : DEFAULT_MODEL_ID);
    await refreshLibrary();
  };

  const handleFinalize = () => {
    onCharacterCustomized({ ...characterData, playerModelId: selectedModelId });
  };

  // A library model is still loading its blob URL — show a loader instead of transiently mounting the default
  // model (which would otherwise report default capabilities and leave the UI stuck on them after a few swaps).
  const resolvingModel = selectedModelId !== DEFAULT_MODEL_ID && selectedModelId !== 'world' && !resolvedModelUrl;

  // Portrait/narrow: the controls move into a bottom drawer that hovers over the viewer, so the model gets the
  // full width and the panel no longer truncates. Desktop keeps the side-by-side split.
  const isMobile = useIsMobile();

  const viewer = (
    <Card className={cn('m-4 bg-secondary overflow-hidden', isMobile ? 'flex-1 min-h-0' : 'w-2/3')}>
      <CardHeader>
        <CardTitle>Character Viewer</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center h-full">
        {/* Adjust the VRMViewer container */}
        <div className="w-full h-full flex items-center justify-center" style={{ aspectRatio: '3/4' }}>
          {resolvingModel ? (
            <Loader2 className="animate-spin" size={32} />
          ) : (
            <VRMViewer
              key={resolvedModelUrl ?? 'default'}
              ref={vrmViewerRef}
              {...viewerProps}
              modelUrl={resolvedModelUrl}
              onCapabilities={setCaps}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );

  const panel = (
    <>
      <div className="flex gap-2 mt-4">
            {onBack
              ? <Button onClick={onBack} variant="outline" className="flex-1">Back</Button>
              : <Button onClick={onAbort} variant="destructive" className="flex-1">Abort</Button>}
            <Button onClick={handleFinalize} className="flex-1">
              Finalize Character
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Character Model</h3>
            <Select value={selectedModelId} onValueChange={setSelectedModelId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {/* No hardcoded "Default" entry: the bundled model is seeded into the library, so it lists
                    itself below. Two entries for one file would be the same model twice. */}
                {worldOverview?.customPlayerVRM && <SelectItem value="world">World model</SelectItem>}
                {libraryModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-3">
              <Label htmlFor="model-upload" className="cursor-pointer text-sm text-primary underline">
                Add .vrm
              </Label>
              <Input id="model-upload" type="file" accept=".vrm,.glb" onChange={handleModelUpload} className="hidden" />
              {libraryModels.some((m) => m.id === selectedModelId) && (
                <Button variant="outline" size="sm" onClick={() => handleModelDelete(selectedModelId)}>
                  Delete
                </Button>
              )}
            </div>
          </div>

          {controls}
    </>
  );


  if (isMobile) {
    return (
      <div className="relative flex h-[100dvh] flex-col pt-[env(safe-area-inset-top)]">
        {viewer}
        <MobileControlsDrawer title="Character Customization">{panel}</MobileControlsDrawer>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh]">
      {viewer}
      <Card className="w-1/3 m-4 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 min-h-0">
          <CardHeader>
            <CardTitle>Character Customization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">{panel}</CardContent>
        </ScrollArea>
      </Card>
    </div>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const defaultCharacterData = {
  bodyShape: {
    pear: 0,
    apple: 0,
    hourglass: 0
  },
  bellySize: 0,
  breastsSize: 0,
  bodyWeight: 0,
  // No colors → the model keeps its own when customization is skipped.
  currentHairStyle: '',
  hairLength: 0,
  hairTypes: {
    ponytail: {
      shapekey: 'Hair',
      canChangeLength: true
    },
    bobcut: {
      shapekey: 'Hair001',
      canChangeLength: false
    }
  }
};

export default CharacterCustomization;
