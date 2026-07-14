import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { Undo2, Loader2, SlidersHorizontal, ChevronUp, ChevronDown, X } from "lucide-react";
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose, DrawerOverlay } from "@/components/ui/drawer"
import { useIsMobile } from "@/lib/useIsMobile"
import { cn } from "@/lib/utils"
import VRMViewer, { type VRMCapabilities, type VRMViewerHandle } from './VRMViewer';
import { useGameData } from '../contexts/GameDataContext';
import type { CharacterData, PlayerModel } from '@/types';
import { addModel, getAllModels, deleteModel } from '@/lib/modelLibrary';
import { usePlayerModelUrl } from '@/lib/usePlayerModelUrl';
import { toast } from 'react-toastify';

// The two fixed heights the customization drawer toggles between — both fully scrollable. The shorter one
// keeps the character visible above the sheet; the taller shows more controls at once.
const DRAWER_HEIGHTS = { short: 'h-[40dvh]', tall: 'h-[90dvh]' } as const;

// Friendly label for a model material/mesh name (e.g. "N00_001_Tops_01_CLOTH" → "N00 001 Tops 01 CLOTH").
const cleanLabel = (s: string) =>
  s.replace(/\([^)]*\)/g, '').replace(/[._]+/g, ' ').trim().replace(/^\w/, c => c.toUpperCase());

// One consistent color control: swatch picker + a revert (↩) button that restores the model's original.
const ColorRow = ({ label, value, onChange, onRevert }: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onRevert: () => void;
}) => (
  <div className="flex items-center space-x-2">
    <Label className="flex-1">{label}</Label>
    <Input type="color" value={value} onChange={onChange} className="w-10 h-10 p-0 border-0" />
    <Button variant="ghost" size="icon" onClick={onRevert} title="Revert to original">
      <Undo2 className="h-4 w-4" />
    </Button>
  </div>
);

const CharacterCustomization = ({ onCharacterCustomized, onBack }: {
  onCharacterCustomized: (data: CharacterData) => void;
  /** Step back in the enter-world flow. Undefined on the flow's first step (the Back button then fades). */
  onBack?: () => void;
}) => {
  const { worldOverview } = useGameData();
  const [bodyShape, setBodyShape] = useState({
    pear: 0,
    apple: 0,
    hourglass: 0
  });
  const [bellySize] = useState(0);
  const [breastsSize, setBreastsSize] = useState(0);
  const [bodyWeight, setBodyWeight] = useState(0);
  const [hairColor, setHairColor] = useState('#7d0909');
  const [eyeColor, setEyeColor] = useState('#86ff70');
  const [skinColor, setSkinColor] = useState('#fcdec7');

  const [hairTypes] = useState({
    ponytail: {
      shapekey: 'Hair',
      canChangeLength: true
    },
    bobcut: {
      shapekey: 'Hair001',
      canChangeLength: false
    }
  });
  const [currentHairStyle, setCurrentHairStyle] = useState('');
  const [hairLength, setHairLength] = useState(0);
  // Colors are applied only after the player actually changes them — keeps unedited (and custom) models pristine.
  const [colorTouched, setColorTouched] = useState({ hair: false, eye: false, skin: false });
  // Which customization morphs the loaded model supports; null until it loads. Sliders stay hidden unless present.
  const [caps, setCaps] = useState<VRMCapabilities | null>(null);
  const vrmViewerRef = useRef<VRMViewerHandle>(null);
  // Extra (non-channel) colorables, e.g. clothing: which one is selected, applied overrides, and picker values.
  const [extraSel, setExtraSel] = useState('');
  const [extraColors, setExtraColors] = useState<Record<string, string>>({});
  const [extraPicker, setExtraPicker] = useState<Record<string, string>>({});

  // Seed the color pickers from the model's actual colors once it loads, so edits start from its real look.
  useEffect(() => {
    if (!caps?.colors) return;
    if (caps.colors.hair) setHairColor(caps.colors.hair);
    if (caps.colors.skin) setSkinColor(caps.colors.skin);
    if (caps.colors.eye) setEyeColor(caps.colors.eye);
  }, [caps]);

  // Pick a valid hairstyle when the model loads or changes; avoids a bald avatar after a model swap.
  useEffect(() => {
    if (!caps) return;
    if (!caps.hairStyles.includes(currentHairStyle)) {
      setCurrentHairStyle(caps.hairStyles[0] ?? '');
      setHairLength(0);
    }
  }, [caps, currentHairStyle]);

  // Player model selection + local model library (per-browser, persisted in IndexedDB).
  const [selectedModelId, setSelectedModelId] = useState<string>(worldOverview?.customPlayerVRM ? 'world' : 'default');
  const [libraryModels, setLibraryModels] = useState<PlayerModel[]>([]);
  const resolvedModelUrl = usePlayerModelUrl(selectedModelId);
  const refreshLibrary = () => getAllModels().then(setLibraryModels);
  useEffect(() => { refreshLibrary(); }, []);

  const handleModelUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const model = await addModel(file);
      await refreshLibrary();
      setSelectedModelId(model.id);
    } catch (err) {
      console.error('Failed to add model', err);
      toast.error('Could not save that model (storage may be full).');
    }
  };

  const handleModelDelete = async (id: string) => {
    await deleteModel(id);
    if (selectedModelId === id) setSelectedModelId(worldOverview?.customPlayerVRM ? 'world' : 'default');
    await refreshLibrary();
  };

  const handleFinalize = () => {
    const characterData = {
      bodyShape,
      bellySize,
      breastsSize,
      bodyWeight,
      hairColor: colorTouched.hair ? hairColor : undefined,
      eyeColor: colorTouched.eye ? eyeColor : undefined,
      skinColor: colorTouched.skin ? skinColor : undefined,
      currentHairStyle,
      hairLength,
      extraColors: Object.keys(extraColors).length ? extraColors : undefined,
    };
    onCharacterCustomized({ ...characterData, hairTypes: hairTypes, playerModelId: selectedModelId });
  };

  const handleBodyShapeChange = (shape: string, value: number[]) => {
    setBodyShape(prev => ({ ...prev, [shape]: value[0] }));
  };

  const handleHairStyleChange = (value: string) => setCurrentHairStyle(value);

  // --- Color channel + extra handlers ---
  const channelSetters = { hair: setHairColor, eye: setEyeColor, skin: setSkinColor } as const;

  const changeChannel = (channel: 'hair' | 'eye' | 'skin', value: string) => {
    setColorTouched(t => ({ ...t, [channel]: true }));
    channelSetters[channel](value);
  };
  // Revert: stop applying (model reverts to its own) and reset the picker to the calculated original.
  const revertChannel = (channel: 'hair' | 'eye' | 'skin') => {
    setColorTouched(t => ({ ...t, [channel]: false }));
    channelSetters[channel](caps?.colors?.[channel] ?? '#ffffff');
  };

  const selectExtra = (name: string) => {
    setExtraSel(name);
    // Calculate this material's current color once and seed its picker; nothing is applied yet.
    if (name && !(name in extraPicker)) {
      const c = vrmViewerRef.current?.calcColor(name);
      if (c) setExtraPicker(p => ({ ...p, [name]: c }));
    }
  };
  const changeExtra = (name: string, value: string) => {
    setExtraColors(c => ({ ...c, [name]: value }));
    setExtraPicker(p => ({ ...p, [name]: value }));
  };
  const revertExtra = (name: string) => {
    setExtraColors(c => { const n = { ...c }; delete n[name]; return n; });
    const calc = vrmViewerRef.current?.calcColor(name);
    if (calc) setExtraPicker(p => ({ ...p, [name]: calc }));
  };

  // Only surface sliders whose backing morph exists in the loaded model.
  const shapeMorph: Record<string, string> = { pear: 'B_Pear', apple: 'B_Apple', hourglass: 'B_HourGlass' };
  const visibleShapes = Object.entries(bodyShape).filter(([shape]) => caps?.bodyMorphs.includes(shapeMorph[shape]));
  const bodyFeatures = [
    { label: 'Breasts Size', value: breastsSize, setValue: setBreastsSize, morph: 'Breasts' },
    { label: 'Body Weight', value: bodyWeight, setValue: setBodyWeight, morph: 'Fat' },
  ].filter(f => caps?.bodyMorphs.includes(f.morph));
  const visibleHairStyles = caps?.hairStyles ?? [];
  // A library model is still loading its blob URL — show a loader instead of transiently mounting the default
  // model (which would otherwise report default capabilities and leave the UI stuck on them after a few swaps).
  const resolvingModel = selectedModelId !== 'default' && selectedModelId !== 'world' && !resolvedModelUrl;

  // Portrait/narrow: the controls move into a bottom drawer that hovers over the viewer, so the model gets the
  // full width and the panel no longer truncates. Desktop keeps the side-by-side split.
  const isMobile = useIsMobile();
  const [animatePreview, setAnimatePreview] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Toggles the drawer between its short and tall heights (see DRAWER_HEIGHTS). Opens short so the character
  // stays visible; the header's expand button grows it. Both heights scroll their full content.
  const [drawerExpanded, setDrawerExpanded] = useState(false);

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
              bodyMorphValues={{
                Belly: bellySize,
                Breasts: breastsSize,
                Fat: bodyWeight,
                B_Pear: bodyShape.pear,
                B_HourGlass: bodyShape.hourglass,
                B_Apple: bodyShape.apple,
              }}
              hairColor={colorTouched.hair ? hairColor : undefined}
              eyeColor={colorTouched.eye ? eyeColor : undefined}
              skinColor={colorTouched.skin ? skinColor : undefined}
              hairTypes={hairTypes}
              currentHairStyle={currentHairStyle}
              hairLength={hairLength}
              modelUrl={resolvedModelUrl}
              extraColors={extraColors}
              onCapabilities={setCaps}
              animate={animatePreview}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );

  const controls = (
    <>
      <div className="flex gap-2 mt-4">
            <Button onClick={onBack} variant="outline" className="flex-1" disabled={!onBack}>Back</Button>
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
                <SelectItem value="default">Default</SelectItem>
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

        {(visibleHairStyles.length > 1 || caps?.hairLength) && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Hair</h3>
            {visibleHairStyles.length > 1 && (
              <Select onValueChange={handleHairStyleChange} value={currentHairStyle}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a hair style" />
                </SelectTrigger>
                <SelectContent>
                  {visibleHairStyles.map((style) => (
                    <SelectItem key={style} value={style}>
                      {cleanLabel(style)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {caps?.hairLength && (
              <div className="space-y-2">
                <Label htmlFor="hair-length">Hair Length</Label>
                <Slider
                  id="hair-length"
                  min={0}
                  max={2}
                  step={0.1}
                  value={[hairLength]}
                  onValueChange={([newValue]) => setHairLength(newValue)}
                />
                <span className="text-sm text-muted-foreground">{hairLength.toFixed(1)}</span>
              </div>
            )}
          </div>
        )}

          {visibleShapes.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Body Shape</h3>
            {visibleShapes.map(([shape, value]) => (
              <div key={shape} className="space-y-2">
                <Label htmlFor={shape}>{shape.charAt(0).toUpperCase() + shape.slice(1)}</Label>
                <Slider
                  id={shape}
                  min={0}
                  max={2}
                  step={0.1}
                  value={[value]}
                  onValueChange={(newValue) => handleBodyShapeChange(shape, newValue)}
                />
                <span className="text-sm text-muted-foreground">{value.toFixed(1)}</span>
              </div>
            ))}
          </div>
          )}



          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={animatePreview}
              onCheckedChange={(v) => setAnimatePreview(v === true)}
            />
            <span className="text-sm font-medium">Animate character</span>
          </label>

          {bodyFeatures.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Initial Body Features</h3>
            {bodyFeatures.map(({ label, value, setValue }) => (
              <div key={label} className="space-y-2">
                <Label htmlFor={label.toLowerCase().replace(' ', '-')}>{label}</Label>
                <Slider
                  id={label.toLowerCase().replace(' ', '-')}
                  min={-0.3}
                  max={0.3}
                  step={0.05}
                  value={[value]}
                  onValueChange={([newValue]) => setValue(newValue)}
                />
                <span className="text-sm text-muted-foreground">{value.toFixed(1)}</span>
              </div>
            ))}
          </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Colors</h3>
            {([
              { label: 'Hair Color', channel: 'hair' as const, value: hairColor },
              { label: 'Eye Color', channel: 'eye' as const, value: eyeColor },
              { label: 'Skin Color', channel: 'skin' as const, value: skinColor },
            ]).map(({ label, channel, value }) => (
              <ColorRow
                key={channel}
                label={label}
                value={value}
                onChange={(e) => changeChannel(channel, e.target.value)}
                onRevert={() => revertChannel(channel)}
              />
            ))}

            {(caps?.extras?.length ?? 0) > 0 && (
              <div className="space-y-2 pt-2">
                <Label>Other Colors</Label>
                <Select value={extraSel} onValueChange={selectExtra}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an Option" />
                  </SelectTrigger>
                  <SelectContent>
                    {caps?.extras.map((name) => (
                      <SelectItem key={name} value={name}>{cleanLabel(name)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {extraSel && (
                  <ColorRow
                    label={cleanLabel(extraSel)}
                    value={extraPicker[extraSel] ?? '#ffffff'}
                    onChange={(e) => changeExtra(extraSel, e.target.value)}
                    onRevert={() => revertExtra(extraSel)}
                  />
                )}
              </div>
            )}
          </div>
    </>
  );

  if (isMobile) {
    return (
      <div className="relative flex h-screen flex-col">
        {viewer}
        {!drawerOpen && (
          <Button
            onClick={() => { setDrawerExpanded(false); setDrawerOpen(true); }}
            className="fixed inset-x-0 bottom-0 z-40 mx-4 mb-4 gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" /> Customize
          </Button>
        )}
        {/* Modal: the overlay blocks the WebGL canvas so drawer gestures don't fight OrbitControls. It's kept
            faint so the character still reads above the (short) sheet; collapse the drawer to orbit/inspect. */}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerOverlay className="bg-black/40" />
          <DrawerContent className={cn('transition-[height] duration-200', drawerExpanded ? DRAWER_HEIGHTS.tall : DRAWER_HEIGHTS.short)}>
            <DrawerHeader className="flex flex-row items-center justify-between py-2">
              <DrawerTitle>Character Customization</DrawerTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={drawerExpanded ? 'Shrink panel' : 'Expand panel'}
                  onClick={() => setDrawerExpanded((v) => !v)}
                >
                  {drawerExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                </Button>
                <DrawerClose asChild>
                  <Button variant="ghost" size="icon" aria-label="Close panel">
                    <X className="h-5 w-5" />
                  </Button>
                </DrawerClose>
              </div>
            </DrawerHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-6 px-4 pb-8">{controls}</div>
            </ScrollArea>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {viewer}
      <Card className="w-1/3 m-4 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 min-h-0">
          <CardHeader>
            <CardTitle>Character Customization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">{controls}</CardContent>
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
