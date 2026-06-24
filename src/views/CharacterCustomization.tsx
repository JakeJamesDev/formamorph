import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { Undo2, Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import VRMViewer, { type VRMCapabilities, type VRMViewerHandle } from './VRMViewer';
import { useGameData } from '../contexts/GameDataContext';
import type { CharacterData, PlayerModel } from '@/types';
import { addModel, getAllModels, deleteModel } from '@/lib/modelLibrary';
import { usePlayerModelUrl } from '@/lib/usePlayerModelUrl';
import { toast } from 'react-toastify';

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

const CharacterCustomization = ({ onCharacterCustomized }: {
  onCharacterCustomized: (data: CharacterData) => void;
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

  return (
    <div className="flex h-screen">
      <Card className="w-2/3 m-4 bg-secondary">
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
              bellySize={bellySize}
              breastSize={breastsSize}
              bodyWeight={bodyWeight}
              hairColor={colorTouched.hair ? hairColor : undefined}
              eyeColor={colorTouched.eye ? eyeColor : undefined}
              skinColor={colorTouched.skin ? skinColor : undefined}
              hairTypes={hairTypes}
              currentHairStyle={currentHairStyle}
              hairLength={hairLength}
              bodyShape={bodyShape}
              modelUrl={resolvedModelUrl}
              extraColors={extraColors}
              onCapabilities={setCaps}
            />
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="w-1/3 m-4 overflow-y-auto">
        <CardHeader>
          <CardTitle>Character Customization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
        <Button onClick={handleFinalize} className="w-full mt-4">
            Finalize Character
          </Button>

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
                Upload .vrm
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
                    {caps.extras.map((name) => (
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
        </CardContent>
      </Card>
    </div>
  );
};

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
