/* eslint-disable react-refresh/only-export-components -- this hook file keeps its private ColorRow helper
   and the shared customization surface together as one unit; there's nothing to fast-refresh separately. */
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Undo2 } from 'lucide-react';
import type { CharacterData, HairTypeDef } from '@/types';
import type { VRMCapabilities, VRMViewerHandle } from '@/views/VRMViewer';
import { Tip } from '@/components/ui/tooltip';

/**
 * Owns the avatar-customization surface — the sliders and color pickers that read a model's detected
 * `VRMCapabilities` and drive a `VRMViewer`. Extracted from CharacterCustomization so the model-library
 * details modal can offer the same controls to test an exported model. Model selection, the enter-world
 * buttons, and the mobile drawer stay with each screen; only the customization itself lives here.
 */

// Friendly label for a model material/mesh name (e.g. "N00_001_Tops_01_CLOTH" → "N00 001 Tops 01 CLOTH").
const cleanLabel = (s: string) =>
  s.replace(/\([^)]*\)/g, '').replace(/[._]+/g, ' ').trim().replace(/^\w/, (c) => c.toUpperCase());

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
    <Tip tip="Revert to original">
      <Button variant="ghost" size="icon" onClick={onRevert}>
        <Undo2 className="h-4 w-4" />
      </Button>
    </Tip>
  </div>
);

const HAIR_TYPES: Record<string, HairTypeDef> = {
  ponytail: { shapekey: 'Hair', canChangeLength: true },
  bobcut: { shapekey: 'Hair001', canChangeLength: false },
};

// Body-morph slider bounds. The stored value is the absolute morph influence (0 = off, 1 = the model's
// authored full shape); this range only clamps the UI, so widening it later needs no save migration.
const BODY_MORPH_MIN = -0.25;
const BODY_MORPH_MAX = 1.25;
const BODY_MORPH_STEP = 0.05;

export interface VrmCustomization {
  /** Pass to `VRMViewer.onCapabilities` so the controls learn what the loaded model supports. */
  setCaps: (caps: VRMCapabilities) => void;
  /** Attach to the `VRMViewer` — the extras color revert reads its live material colors. */
  vrmViewerRef: React.RefObject<VRMViewerHandle>;
  /** Spread onto `VRMViewer`: the morph/color/hair inputs the sliders drive, plus the animate toggle. */
  viewerProps: {
    bodyMorphValues: Record<string, number>;
    hairColor?: string;
    eyeColor?: string;
    skinColor?: string;
    hairTypes: Record<string, HairTypeDef>;
    currentHairStyle: string;
    hairLength: number;
    extraColors: Record<string, string>;
    animate: boolean;
  };
  /** The rendered slider/picker controls, gated to the model's detected capabilities. */
  controls: ReactNode;
  /** The composed choices, for a caller that finalizes a character (CharacterCustomization). */
  characterData: Omit<CharacterData, 'playerModelId'>;
}

/**
 * @param includeAnimateToggle - whether the controls render the "Animate character" checkbox (the enter-world
 *   flow shows it; a preview that's just testing morphs may not want it). Defaults to true.
 */
export function useVrmCustomization(includeAnimateToggle = true): VrmCustomization {
  const [caps, setCaps] = useState<VRMCapabilities | null>(null);
  const vrmViewerRef = useRef<VRMViewerHandle>(null);

  // Chosen morph influences keyed by morph name; one slider is derived per morph the loaded model exposes.
  const [bodyMorphs, setBodyMorphs] = useState<Record<string, number>>({});
  const [hairColor, setHairColor] = useState('#7d0909');
  const [eyeColor, setEyeColor] = useState('#86ff70');
  const [skinColor, setSkinColor] = useState('#fcdec7');
  const [currentHairStyle, setCurrentHairStyle] = useState('');
  const [hairLength, setHairLength] = useState(0);
  // Colors are applied only after the player actually changes them — keeps unedited (and custom) models pristine.
  const [colorTouched, setColorTouched] = useState({ hair: false, eye: false, skin: false });
  const [extraSel, setExtraSel] = useState('');
  const [extraColors, setExtraColors] = useState<Record<string, string>>({});
  const [extraPicker, setExtraPicker] = useState<Record<string, string>>({});
  const [animate, setAnimate] = useState(true);

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

  const setBodyMorph = (morph: string, value: number) =>
    setBodyMorphs((prev) => ({ ...prev, [morph]: value }));

  const channelSetters = { hair: setHairColor, eye: setEyeColor, skin: setSkinColor } as const;
  const changeChannel = (channel: 'hair' | 'eye' | 'skin', value: string) => {
    setColorTouched((t) => ({ ...t, [channel]: true }));
    channelSetters[channel](value);
  };
  // Revert: stop applying (model reverts to its own) and reset the picker to the calculated original.
  const revertChannel = (channel: 'hair' | 'eye' | 'skin') => {
    setColorTouched((t) => ({ ...t, [channel]: false }));
    channelSetters[channel](caps?.colors?.[channel] ?? '#ffffff');
  };

  const selectExtra = (name: string) => {
    setExtraSel(name);
    // Calculate this material's current color once and seed its picker; nothing is applied yet.
    if (name && !(name in extraPicker)) {
      const calc = vrmViewerRef.current?.calcColor(name);
      if (calc) setExtraPicker((p) => ({ ...p, [name]: calc }));
    }
  };
  const changeExtra = (name: string, value: string) => {
    setExtraColors((c) => ({ ...c, [name]: value }));
    setExtraPicker((p) => ({ ...p, [name]: value }));
  };
  const revertExtra = (name: string) => {
    setExtraColors((c) => {
      const n = { ...c };
      delete n[name];
      return n;
    });
    const calc = vrmViewerRef.current?.calcColor(name);
    if (calc) setExtraPicker((p) => ({ ...p, [name]: calc }));
  };

  // One slider per body morph the loaded model actually exposes — fully model-driven, nothing hardcoded.
  const bodyMorphSliders = caps?.bodyMorphs ?? [];
  const visibleHairStyles = caps?.hairStyles ?? [];

  const viewerProps: VrmCustomization['viewerProps'] = {
    bodyMorphValues: bodyMorphs,
    hairColor: colorTouched.hair ? hairColor : undefined,
    eyeColor: colorTouched.eye ? eyeColor : undefined,
    skinColor: colorTouched.skin ? skinColor : undefined,
    hairTypes: HAIR_TYPES,
    currentHairStyle,
    hairLength,
    extraColors,
    animate,
  };

  const characterData: Omit<CharacterData, 'playerModelId'> = {
    bodyMorphs,
    hairColor: colorTouched.hair ? hairColor : undefined,
    eyeColor: colorTouched.eye ? eyeColor : undefined,
    skinColor: colorTouched.skin ? skinColor : undefined,
    currentHairStyle,
    hairLength,
    extraColors: Object.keys(extraColors).length ? extraColors : undefined,
    hairTypes: HAIR_TYPES,
  };

  const controls = (
    <>
      {includeAnimateToggle && (
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={animate} onCheckedChange={(v) => setAnimate(v === true)} />
          <span className="text-label font-medium">Animate character</span>
        </label>
      )}

      {(visibleHairStyles.length > 1 || caps?.hairLength) && (
        <div className="space-y-4">
          <h3 className="text-title font-semibold">Hair</h3>
          {visibleHairStyles.length > 1 && (
            <Select onValueChange={setCurrentHairStyle} value={currentHairStyle}>
              <SelectTrigger>
                <SelectValue placeholder="Select a hair style" />
              </SelectTrigger>
              <SelectContent>
                {visibleHairStyles.map((style) => (
                  <SelectItem key={style} value={style}>{cleanLabel(style)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {caps?.hairLength && (
            <div className="space-y-2">
              <Label htmlFor="hair-length">Hair Length</Label>
              <Slider id="hair-length" min={0} max={2} step={0.1} value={[hairLength]} onValueChange={([v]) => setHairLength(v)} />
              <span className="text-helper text-muted-foreground">{hairLength.toFixed(1)}</span>
            </div>
          )}
        </div>
      )}

      {bodyMorphSliders.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-title font-semibold">Initial Body Features</h3>
          {bodyMorphSliders.map((morph) => {
            const value = bodyMorphs[morph] ?? 0;
            return (
              <div key={morph} className="space-y-2">
                <Label htmlFor={`morph-${morph}`}>{cleanLabel(morph)}</Label>
                <Slider
                  id={`morph-${morph}`}
                  min={BODY_MORPH_MIN}
                  max={BODY_MORPH_MAX}
                  step={BODY_MORPH_STEP}
                  value={[value]}
                  onValueChange={([v]) => setBodyMorph(morph, v)}
                />
                <span className="text-helper text-muted-foreground">{value.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-title font-semibold">Colors</h3>
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

  return { setCaps, vrmViewerRef, viewerProps, controls, characterData };
}
