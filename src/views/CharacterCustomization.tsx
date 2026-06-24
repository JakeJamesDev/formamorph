import { useState, useEffect, type ChangeEvent } from 'react';
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import VRMViewer, { type VRMCapabilities } from './VRMViewer';
import { useGameData } from '../contexts/GameDataContext';
import type { CharacterData, PlayerModel } from '@/types';
import { addModel, getAllModels, deleteModel } from '@/lib/modelLibrary';
import { usePlayerModelUrl } from '@/lib/usePlayerModelUrl';
import { toast } from 'react-toastify';

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
  const [currentHairStyle, setCurrentHairStyle] = useState('ponytail');
  const [hairLength, setHairLength] = useState(0);
  // Which customization morphs the loaded model supports; null until it loads. Sliders stay hidden unless present.
  const [caps, setCaps] = useState<VRMCapabilities | null>(null);

  // Seed the color pickers from the model's actual colors once it loads, so edits start from its real look.
  useEffect(() => {
    if (!caps?.colors) return;
    if (caps.colors.hair) setHairColor(caps.colors.hair);
    if (caps.colors.skin) setSkinColor(caps.colors.skin);
    if (caps.colors.eye) setEyeColor(caps.colors.eye);
  }, [caps]);

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
      hairColor,
      eyeColor,
      skinColor,
      currentHairStyle,
      hairLength
    };
    onCharacterCustomized({ ...characterData, hairTypes: hairTypes, playerModelId: selectedModelId });
  };

  const handleBodyShapeChange = (shape: string, value: number[]) => {
    setBodyShape(prev => ({ ...prev, [shape]: value[0] }));
  };

  const handleHairStyleChange = (value: string) => {
    setCurrentHairStyle(value);
    if (!hairTypes[value].canChangeLength) {
      setHairLength(0);
    }
  };

  // Only surface sliders whose backing morph exists in the loaded model.
  const shapeMorph: Record<string, string> = { pear: 'B_Pear', apple: 'B_Apple', hourglass: 'B_HourGlass' };
  const visibleShapes = Object.entries(bodyShape).filter(([shape]) => caps?.bodyMorphs.includes(shapeMorph[shape]));
  const bodyFeatures = [
    { label: 'Breasts Size', value: breastsSize, setValue: setBreastsSize, morph: 'Breasts' },
    { label: 'Body Weight', value: bodyWeight, setValue: setBodyWeight, morph: 'Fat' },
  ].filter(f => caps?.bodyMorphs.includes(f.morph));
  const visibleHairStyles = caps?.hairStyles ?? [];

  return (
    <div className="flex h-screen">
      <Card className="w-2/3 m-4 bg-secondary">
        <CardHeader>
          <CardTitle>Character Viewer</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-full">
          {/* Adjust the VRMViewer container */}
          <div className="w-full h-full" style={{ aspectRatio: '3/4' }}>
            <VRMViewer
              key={resolvedModelUrl ?? 'default'}
              bellySize={bellySize}
              breastSize={breastsSize}
              bodyWeight={bodyWeight}
              hairColor={hairColor}
              eyeColor={eyeColor}
              skinColor={skinColor}
              hairTypes={hairTypes}
              currentHairStyle={currentHairStyle}
              hairLength={hairLength}
              bodyShape={bodyShape}
              modelUrl={resolvedModelUrl}
              onCapabilities={setCaps}
            />
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

        {visibleHairStyles.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Hair Style</h3>
            <Select onValueChange={handleHairStyleChange} value={currentHairStyle}>
              <SelectTrigger>
                <SelectValue placeholder="Select a hair style" />
              </SelectTrigger>
              <SelectContent>
                {visibleHairStyles.map((style) => (
                  <SelectItem key={style} value={style}>
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {caps?.hairLength && hairTypes[currentHairStyle]?.canChangeLength && (
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
            {[
              { label: 'Hair Color', value: hairColor, setValue: setHairColor },
              { label: 'Eye Color', value: eyeColor, setValue: setEyeColor },
              { label: 'Skin Color', value: skinColor, setValue: setSkinColor },
            ].map(({ label, value, setValue }) => (
              <div key={label} className="flex items-center space-x-2">
                <Label htmlFor={label.toLowerCase().replace(' ', '-')}>{label}</Label>
                <Input
                  id={label.toLowerCase().replace(' ', '-')}
                  type="color"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-10 h-10 p-0 border-0"
                />
                <span className="text-sm text-muted-foreground">{value}</span>
              </div>
            ))}

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
  hairColor: '#7d0909',
  eyeColor: '#86ff70',
  skinColor: '#fcdec7',
  currentHairStyle: 'ponytail',
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
