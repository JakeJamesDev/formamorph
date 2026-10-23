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
import type { CharacterData, ModelMetadata, VrmPick } from '@/types';
import ModelStorageService from '@/services/ModelStorageService';
import { filesFrom } from '@/lib/importFiles';
import { useVrmSourceUrl } from '@/lib/useVrmSourceUrl';
import { useBackStop } from '@/hooks/useBackStop';
import { useVrmCustomization } from '@/lib/useVrmCustomization';
import { DEFAULT_AVATAR_ID, DEFAULT_AVATAR_URL, pickerStart, readUserDefaultAvatar } from '@/lib/defaultAvatar';
import { namedVrmSource } from '@/lib/vrmResolver';
import { useGameData } from '@/contexts/GameDataContext';
import { useMountedRef } from '@/lib/useMountedRef';
import { toastError } from '@/lib/linkToast';
import { SurfaceLayer } from '@/components/ui/surface';
import { targetAttribute } from '@/lib/surface/surfaceTargets';

const CharacterCustomization = ({ vrm, onCharacterCustomized, onBack, onAbort }: {
  /** The played entity's Avatar. User's Default offers the library picker; any other pick shows as set. */
  vrm?: VrmPick;
  onCharacterCustomized: (data: CharacterData) => void;
  /** Step back in the enter-world flow. Undefined on the flow's first step, where the button becomes Abort. */
  onBack?: () => void;
  /** Cancel the whole enter-world flow (shown as Abort when there's no previous step to go back to). */
  onAbort?: () => void;
}) => {
  // This screen replaces the menu rather than layering over it, so the Android back button cannot see it
  // and would offer to close the app instead. Whichever way out the flow gave us is the back step.
  useBackStop(onBack ?? onAbort);
  // The sliders and color pickers (and the state that drives the preview) live in the shared hook, so the
  // model-library details modal can offer the same controls to test an exported model.
  const { setCaps, vrmViewerRef, viewerProps, controls, characterData } = useVrmCustomization();

  const { worldOverview } = useGameData();
  const locked = vrm && vrm.kind !== 'default' ? vrm : undefined;
  // Player model selection + local model library (per-browser, persisted in IndexedDB).
  const [selectedModelId, setSelectedModelId] = useState<string>(DEFAULT_AVATAR_ID);
  const [libraryModels, setLibraryModels] = useState<ModelMetadata[]>();
  const lockedSource = locked && libraryModels
    && namedVrmSource(locked, { store: worldOverview?.vrmStore, libraryIds: new Set(libraryModels.map((m) => m.id)) });
  const { url: resolvedModelUrl, resolving: resolvingModel } = useVrmSourceUrl(
    locked ? lockedSource : { kind: 'library', id: selectedModelId });
  const isMountedRef = useMountedRef();
  const refreshLibrary = () => ModelStorageService.getModelMetadata().then((models) => {
    if (isMountedRef.current) setLibraryModels(models);
    return models;
  });
  // Seed the bundled default before listing, so the picker isn't blank if this screen is reached before
  // MainMenu has seeded. Seeding is idempotent — a no-op once done. The controls wait for this first list,
  // so the start pick never overwrites one the player made.
  useEffect(() => {
    void ModelStorageService.seedDefaultModel(DEFAULT_AVATAR_URL).catch(() => undefined).then(refreshLibrary)
      .catch((err: unknown) => {
        console.error('Failed to list the Avatar library', err);
        return [];
      })
      .then((models) => {
        if (!isMountedRef.current) return;
        setLibraryModels(models);
        setSelectedModelId(pickerStart(models.map((m) => m.id), readUserDefaultAvatar()));
      });
  }, [isMountedRef]);
  const listing = !libraryModels;

  const handleModelUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const [file] = filesFrom(e);
    if (!file) return;
    try {
      const model = await ModelStorageService.addModel(file);
      await refreshLibrary();
      setSelectedModelId(model.id);
    } catch (err) {
      console.error('Failed to add model', err);
      toastError(err, { headline: 'Could not save that player avatar (storage may be full).' });
    }
  };

  const handleFinalize = () => {
    onCharacterCustomized({ ...characterData, chosenVrm: locked ? null : { pick: { kind: 'library', id: selectedModelId } } });
  };

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
          {resolvingModel || (locked && listing) ? (
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
            <Button onClick={handleFinalize} disabled={listing} className="flex-1" {...targetAttribute('avatar', 'finalize-character')}>
              Finalize Character
            </Button>
          </div>

          {!locked && (
          <div className="space-y-2">
            <h3 className="text-title font-semibold">Player Avatar</h3>
            <Select value={selectedModelId} onValueChange={setSelectedModelId} disabled={listing}>
              <SelectTrigger>
                <SelectValue placeholder="Select a Player Avatar" />
              </SelectTrigger>
              <SelectContent>
                {/* No hardcoded "Default" entry: the bundled model is seeded into the library, so it lists
                    itself below. Two entries for one file would be the same model twice. */}
                {libraryModels?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-3">
              <Label htmlFor="model-upload" className="cursor-pointer text-label text-primary underline">
                Add .vrm
              </Label>
              <Input id="model-upload" type="file" accept=".vrm,.glb" onChange={handleModelUpload} disabled={listing} className="hidden" />
            </div>
          </div>
          )}

          {controls}
    </>
  );


  if (isMobile) {
    return (
      <div className="relative flex app-viewport flex-col pt-[env(safe-area-inset-top)]">
        <SurfaceLayer id="avatar" />
        {viewer}
        <MobileControlsDrawer title="Character Customization">{panel}</MobileControlsDrawer>
      </div>
    );
  }

  return (
    <div className="flex app-viewport pt-[env(safe-area-inset-top)]">
      <SurfaceLayer id="avatar" />
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

export default CharacterCustomization;
