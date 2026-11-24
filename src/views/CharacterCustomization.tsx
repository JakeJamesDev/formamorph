import { useState, useEffect, useRef, type ChangeEvent, type ReactNode } from 'react';
import { AvatarEmptyState } from '@/components/AvatarEmptyState';
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
import type { CharacterData, ChosenVrm, ModelMetadata, VrmPick } from '@/types';
import ModelStorageService from '@/services/ModelStorageService';
import { filesFrom } from '@/lib/importFiles';
import { useVrmSourceUrl } from '@/lib/useVrmSourceUrl';
import { useBackStop } from '@/hooks/useBackStop';
import { useVrmCustomization } from '@/lib/useVrmCustomization';
import type { AvatarLock } from '@/lib/customizationLock';
import { Hint } from '@/components/ui/typography';
import { DEFAULT_AVATAR_ID, pickerStart, readUserDefaultAvatar } from '@/lib/defaultAvatar';
import { namedVrmSource } from '@/lib/vrmResolver';
import { useGameData } from '@/contexts/GameDataContext';
import { useMountedRef } from '@/lib/useMountedRef';
import { toastError } from '@/lib/linkToast';
import { SurfaceLayer } from '@/components/ui/surface';
import { targetAttribute } from '@/lib/surface/surfaceTargets';

export interface AvatarCustomizerInput {
  /** The played entity's Avatar. User's Default offers the library picker; any other pick shows as set. */
  vrm?: VrmPick;
  /** The checked traits that hold sliders and colors. Absent when the screen has no world. */
  lock?: AvatarLock;
  /** The stored look the controls and picker start from. Absent at entry. */
  initial?: CharacterData;
}

/**
 * The Avatar picker, preview and controls both hosts share: the enter-world step and the in-game editor.
 * The host adds its own buttons and decides what Finalize or Save writes.
 */
export function useAvatarCustomizer({ vrm, lock, initial }: AvatarCustomizerInput) {
  const { setCaps, vrmViewerRef, viewerProps, controls, characterData, changed: lookChanged } = useVrmCustomization({ lock, initial });

  const { worldOverview } = useGameData();
  const locked = vrm && vrm.kind !== 'default' ? vrm : undefined;
  // Player model selection + local model library (per-browser, persisted in IndexedDB).
  const [selectedModelId, setSelectedModelId] = useState<string>(DEFAULT_AVATAR_ID);
  // The pick the picker started on, so a host can tell a switch from no switch.
  const [startModelId, setStartModelId] = useState<string>();
  // The stored pick the picker starts on, read once at the first library list.
  const initialPick = useRef(initial?.chosenVrm?.pick).current;
  const [libraryModels, setLibraryModels] = useState<ModelMetadata[]>();
  const lockedSource = locked && libraryModels
    && namedVrmSource(locked, {
      store: worldOverview?.vrmStore, libraryIds: new Set(libraryModels.map((m) => m.id)), deviceDefault: readUserDefaultAvatar(),
    });
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
    void ModelStorageService.seedBundledAvatars().catch(() => undefined).then(refreshLibrary)
      .catch((err: unknown) => {
        console.error('Failed to list the Avatar library', err);
        return [];
      })
      .then((models) => {
        if (!isMountedRef.current) return;
        setLibraryModels(models);
        const ids = models.map((m) => m.id);
        const start = initialPick?.kind === 'library' && ids.includes(initialPick.id)
          ? initialPick.id
          : pickerStart(ids, readUserDefaultAvatar());
        setSelectedModelId(start);
        setStartModelId(start);
      });
  }, [isMountedRef, initialPick]);
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
      toastError(err, { headline: "Couldn't save that Avatar. Storage may be full." });
    }
  };

  const noAvatars = !locked && !!libraryModels && libraryModels.length === 0;
  // With no Avatar on screen there is nothing to customize.
  const showsAvatar = !noAvatars && !(locked && !listing && !lockedSource);
  const uploadRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // Outside the panel, which the mobile drawer unmounts while closed.
  const uploadInput = <Input id="model-upload" ref={uploadRef} type="file" accept=".vrm,.glb" onChange={handleModelUpload} disabled={listing} className="hidden" />;

  const viewer = (
    <Card className={cn('m-4 bg-secondary overflow-hidden', isMobile ? 'flex-1 min-h-0' : 'w-2/3')}>
      <CardHeader>
        <CardTitle>Avatar Preview</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center h-full">
        <div className="w-full h-full flex items-center justify-center" style={{ aspectRatio: '3/4' }}>
          {resolvingModel || (locked && listing) ? (
            <Loader2 className="animate-spin" size={32} />
          ) : noAvatars ? (
            <AvatarEmptyState onAdd={() => uploadRef.current?.click()} />
          ) : locked && !lockedSource ? (
            <Hint className="text-center">This world&apos;s Avatar isn&apos;t available.</Hint>
          ) : (
            <VRMViewer
              key={resolvedModelUrl ?? 'none'}
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

  const body = (
    <>
      {!locked && (
        <div className="space-y-2">
          <h3 className="text-title font-semibold">Player Avatar</h3>
          <Select value={noAvatars ? '' : selectedModelId} onValueChange={setSelectedModelId} disabled={listing || noAvatars}>
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
          </div>
        </div>
      )}
      {showsAvatar && controls}
    </>
  );

  const libraryChoice: ChosenVrm = { pick: { kind: 'library', id: selectedModelId } };
  const switched = !locked && !noAvatars && startModelId !== undefined && selectedModelId !== startModelId;
  return {
    viewer, body, uploadInput, isMobile, characterData, listing, switched,
    /** The library pick on screen, or null when the world locks the Avatar or the library is empty. */
    chosenVrm: locked || noAvatars ? null : libraryChoice,
    changed: switched || lookChanged,
  };
}

/** The shared screen layout: preview beside the panel on desktop, the panel in a drawer on mobile. */
export function AvatarCustomizerLayout({ customizer: { viewer, body, uploadInput, isMobile }, actions, desktopRoot, surface }: {
  customizer: ReturnType<typeof useAvatarCustomizer>;
  /** The host's button row, above the picker and controls. */
  actions: ReactNode;
  /** The desktop root's sizing, which the host owns. */
  desktopRoot: string;
  surface?: ReactNode;
}) {
  const panel = (
    <>
      <div className="flex gap-2 mt-4">{actions}</div>
      {body}
    </>
  );
  if (isMobile) {
    return (
      <div className="relative flex app-viewport flex-col pt-[env(safe-area-inset-top)]">
        {surface}
        {uploadInput}
        {viewer}
        <MobileControlsDrawer title="Avatar Customization">{panel}</MobileControlsDrawer>
      </div>
    );
  }
  return (
    <div className={cn('flex', desktopRoot)}>
      {surface}
      {uploadInput}
      {viewer}
      {/* Its scrolling controls start below the header line, clear of the window buttons. */}
      <Card className="w-1/3 m-4 flex flex-col overflow-hidden [[data-window-overlay]_&]:mt-[var(--header-line)]">
        <ScrollArea className="flex-1 min-h-0">
          <CardHeader>
            <CardTitle>Avatar Customization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">{panel}</CardContent>
        </ScrollArea>
      </Card>
    </div>
  );
}

/** The enter-world flow's Avatar step. */
const CharacterCustomization = ({ vrm, lock, onCharacterCustomized, onBack, onAbort }: {
  vrm?: VrmPick;
  lock?: AvatarLock;
  onCharacterCustomized: (data: CharacterData) => void;
  /** Step back in the enter-world flow. Undefined on the flow's first step, where the button becomes Abort. */
  onBack?: () => void;
  /** Cancel the whole enter-world flow (shown as Abort when there's no previous step to go back to). */
  onAbort?: () => void;
}) => {
  // This screen replaces the menu rather than layering over it, so the Android back button cannot see it
  // and would offer to close the app instead. Whichever way out the flow gave us is the back step.
  useBackStop(onBack ?? onAbort);
  const customizer = useAvatarCustomizer({ vrm, lock });
  const { characterData, chosenVrm, listing } = customizer;
  return (
    <AvatarCustomizerLayout
      customizer={customizer}
      desktopRoot="app-viewport pt-[env(safe-area-inset-top)]"
      surface={<SurfaceLayer id="avatar" />}
      actions={(
        <>
          {onBack
            ? <Button onClick={onBack} variant="outline" className="flex-1">Back</Button>
            : <Button onClick={onAbort} variant="destructive" className="flex-1">Abort</Button>}
          <Button
            onClick={() => onCharacterCustomized({ ...characterData, chosenVrm })}
            disabled={listing}
            className="flex-1"
            {...targetAttribute('avatar', 'finalize-character')}
          >
            Finalize Avatar
          </Button>
        </>
      )}
    />
  );
};

export default CharacterCustomization;
