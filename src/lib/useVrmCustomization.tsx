/* eslint-disable react-refresh/only-export-components -- this hook file keeps its private ColorRow helper
   and the shared customization surface together as one unit; there's nothing to fast-refresh separately. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { ColorPicker } from '@/components/ui/color-picker';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Undo2 } from 'lucide-react';
import type { BodyTraitOn, CharacterData, ColorChannel, HairTypeDef } from '@/types';
import type { VRMCapabilities, VRMViewerHandle } from '@/views/VRMViewer';
import { Tip } from '@/components/ui/tooltip';
import { Meta } from '@/components/ui/typography';
import { lockedLook, type AvatarLock } from '@/lib/customizationLock';
import { COLOR_CHANNELS } from '@/lib/avatarLook';
import { cleanLabel } from '@/lib/morphLabel';

/**
 * Owns the avatar-customization surface — the sliders and color pickers that read a model's detected
 * `VRMCapabilities` and drive a `VRMViewer`. Extracted from CharacterCustomization so the model-library
 * details modal can offer the same controls to test an exported model. Model selection, the enter-world
 * buttons, and the mobile drawer stay with each screen; only the customization itself lives here.
 */

// Undo for one control: enabled only when the control is off its base and no trait holds it.
const UndoButton = ({ label, onUndo, disabled }: { label: string; onUndo: () => void; disabled: boolean }) => (
  <Tip tip="Undo">
    <Button variant="ghost" size="icon" aria-label={`Undo ${label}`} onClick={onUndo} disabled={disabled}>
      <Undo2 className="h-4 w-4" />
    </Button>
  </Tip>
);

const sameHex = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// One consistent color control: swatch picker + an undo button that returns the color to its base.
const ColorRow = ({ label, value, base, onChange, onUndo, onPickStart, onPickEnd, heldBy }: {
  label: string;
  value: string;
  /** The color undo returns to. */
  base: string;
  onChange: (hex: string) => void;
  onUndo: () => void;
  onPickStart: () => void;
  onPickEnd: () => void;
  /** The checked trait that sets this color: the row shows it and cannot change it. */
  heldBy?: string;
}) => (
  <div className="space-y-1">
    <div className="flex items-center space-x-2">
      <Label className="flex-1">{label}</Label>
      {heldBy !== undefined ? (
        <span className="flex items-center gap-2 font-mono text-body">
          <span aria-hidden className="h-5 w-5 rounded-sm border border-border" style={{ backgroundColor: value }} />
          {value}
        </span>
      ) : (
        <ColorPicker value={value} aria-label={label} onChange={onChange} onPickStart={onPickStart} onPickEnd={onPickEnd} />
      )}
      <UndoButton label={label} onUndo={onUndo} disabled={heldBy !== undefined || sameHex(value, base)} />
    </div>
    {heldBy !== undefined && <Meta>Set by {heldBy}</Meta>}
  </div>
);

// One slider with its undo button in the label row.
const SliderRow = ({ id, label, value, base, min, max, step, format, onChange, heldBy }: {
  id: string;
  label: string;
  value: number;
  /** The value undo returns to. */
  base: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  /** The checked trait that sets this slider: the row shows it and cannot change it. */
  heldBy?: string;
}) => (
  <div className="space-y-2">
    <div className="flex items-center space-x-2">
      <Label htmlFor={id} className="flex-1">{label}</Label>
      <UndoButton label={label} onUndo={() => onChange(base)} disabled={heldBy !== undefined || value === base} />
    </div>
    <Slider id={id} min={min} max={max} step={step} value={[value]} disabled={heldBy !== undefined} onValueChange={([v]) => onChange(v)} />
    <Meta>{format(value)}{heldBy !== undefined && ` · Set by ${heldBy}`}</Meta>
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
// Head keys run between their two modeled shapes; past either end the mesh distorts.
const HEAD_MORPH_MIN = 0;
const HEAD_MORPH_MAX = 1;
// The model's own value for every slider, and what undo returns to.
const SLIDER_BASE = 0;
// Picker colors for a model that reports none; also what undo returns to then.
const DEFAULT_COLORS = { hair: '#7d0909', eye: '#86ff70', skin: '#fcdec7' } as const;

export interface VrmCustomization {
  /** Pass to `VRMViewer.onCapabilities` so the controls learn what the loaded model supports. */
  setCaps: (caps: VRMCapabilities) => void;
  /** Attach to the `VRMViewer` — the extras color revert reads its live material colors. */
  vrmViewerRef: React.RefObject<VRMViewerHandle | null>;
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
  characterData: Omit<CharacterData, 'chosenVrm'>;
}

/**
 * @param includeAnimateToggle - whether the controls render the "Animate Avatar" checkbox (the enter-world
 *   flow shows it; a preview that's just testing morphs may not want it). Defaults to true.
 * @param lock - the checked traits whose pins hold sliders and colors. Absent in the Model Library, which locks nothing.
 */
export function useVrmCustomization(includeAnimateToggle = true, lock?: AvatarLock): VrmCustomization {
  const [caps, setCaps] = useState<VRMCapabilities | null>(null);
  const vrmViewerRef = useRef<VRMViewerHandle>(null);

  // Chosen morph influences keyed by morph name; one slider is derived per morph the loaded model exposes.
  const [bodyMorphs, setBodyMorphs] = useState<Record<string, number>>({});
  const [hairColor, setHairColor] = useState<string>(DEFAULT_COLORS.hair);
  const [eyeColor, setEyeColor] = useState<string>(DEFAULT_COLORS.eye);
  const [skinColor, setSkinColor] = useState<string>(DEFAULT_COLORS.skin);
  const [currentHairStyle, setCurrentHairStyle] = useState('');
  const [hairLength, setHairLength] = useState(0);
  // Colors are applied only after the player actually changes them — keeps unedited (and custom) models pristine.
  const [colorTouched, setColorTouched] = useState({ hair: false, eye: false, skin: false });
  const [extraSel, setExtraSel] = useState('');
  const [extraColors, setExtraColors] = useState<Record<string, string>>({});
  const [extraPicker, setExtraPicker] = useState<Record<string, string>>({});
  // Each material's own color, read when it was first selected.
  const [extraBase, setExtraBase] = useState<Record<string, string>>({});
  const [animate, setAnimate] = useState(true);
  // The Avatar holds still while the eyedropper samples it.
  const [picking, setPicking] = useState(false);

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
  // Undo: stop applying (the model shows its own) and reset the picker to the calculated original.
  const undoChannel = (channel: 'hair' | 'eye' | 'skin') => {
    setColorTouched((t) => ({ ...t, [channel]: false }));
    channelSetters[channel](caps?.colors?.[channel] ?? DEFAULT_COLORS[channel]);
  };

  const selectExtra = (name: string) => {
    setExtraSel(name);
    // Calculate this material's current color once and seed its picker; nothing is applied yet.
    if (name && !(name in extraPicker)) {
      const calc = vrmViewerRef.current?.calcColor(name);
      if (calc) {
        setExtraPicker((p) => ({ ...p, [name]: calc }));
        setExtraBase((b) => ({ ...b, [name]: calc }));
      }
    }
  };
  const changeExtra = (name: string, value: string) => {
    setExtraColors((c) => ({ ...c, [name]: value }));
    setExtraPicker((p) => ({ ...p, [name]: value }));
  };
  const undoExtra = (name: string) => {
    setExtraColors((c) => {
      const n = { ...c };
      delete n[name];
      return n;
    });
    const own = extraBase[name] ?? vrmViewerRef.current?.calcColor(name);
    if (own) setExtraPicker((p) => ({ ...p, [name]: own }));
  };

  // One slider per body morph the loaded model actually exposes — fully model-driven, nothing hardcoded.
  const bodyMorphSliders = caps?.bodyMorphs ?? [];
  const headMorphSliders = caps?.headMorphs ?? [];
  const visibleHairStyles = caps?.hairStyles ?? [];

  // The pins the checked traits put on this model. The player's own values stay stored under them.
  const pinned = useMemo(() => (lock && caps
    ? lockedLook(lock, {
      catalog: [...caps.bodyMorphs, ...caps.headMorphs],
      channels: COLOR_CHANNELS.filter((channel) => caps.colors?.[channel]),
    })
    : null), [lock, caps]);
  const holderName = (holder: BodyTraitOn | undefined) => (holder && lock ? lock.nameOf(holder) : undefined);
  const pinnedColor = (channel: ColorChannel) => (pinned?.colorHolders[channel] ? pinned.colors[channel]?.set : undefined);
  const heldColor = (channel: ColorChannel) => holderName(pinned?.colorHolders[channel]);
  const shownMorphs = pinned ? { ...bodyMorphs, ...Object.fromEntries(Object.keys(pinned.holders).map((key) => [key, pinned.morphs[key]])) } : bodyMorphs;

  const viewerProps: VrmCustomization['viewerProps'] = {
    bodyMorphValues: shownMorphs,
    hairColor: pinnedColor('hair') ?? (colorTouched.hair ? hairColor : undefined),
    eyeColor: pinnedColor('eye') ?? (colorTouched.eye ? eyeColor : undefined),
    skinColor: pinnedColor('skin') ?? (colorTouched.skin ? skinColor : undefined),
    hairTypes: HAIR_TYPES,
    currentHairStyle,
    hairLength,
    extraColors,
    animate: animate && !picking,
  };

  const characterData: Omit<CharacterData, 'chosenVrm'> = {
    bodyMorphs,
    hairColor: colorTouched.hair ? hairColor : undefined,
    eyeColor: colorTouched.eye ? eyeColor : undefined,
    skinColor: colorTouched.skin ? skinColor : undefined,
    currentHairStyle,
    hairLength,
    extraColors: Object.keys(extraColors).length ? extraColors : undefined,
    hairTypes: HAIR_TYPES,
  };

  const morphSlider = (morph: string, min: number, max: number) => {
    const heldBy = holderName(pinned?.holders[morph]);
    const value = heldBy !== undefined ? pinned!.morphs[morph] : bodyMorphs[morph] ?? SLIDER_BASE;
    return (
      <SliderRow
        key={morph}
        id={`morph-${morph}`}
        label={cleanLabel(morph)}
        value={value}
        base={SLIDER_BASE}
        min={min}
        max={max}
        step={BODY_MORPH_STEP}
        format={(v) => v.toFixed(2)}
        onChange={(v) => setBodyMorph(morph, v)}
        heldBy={heldBy}
      />
    );
  };

  const controls = (
    <>
      {includeAnimateToggle && (
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={animate} onCheckedChange={(v) => setAnimate(v === true)} />
          <span className="text-label font-medium">Animate Avatar</span>
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
            <SliderRow
              id="hair-length"
              label="Hair Length"
              value={hairLength}
              base={SLIDER_BASE}
              min={0}
              max={2}
              step={0.1}
              format={(v) => v.toFixed(1)}
              onChange={setHairLength}
            />
          )}
        </div>
      )}

      {headMorphSliders.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-title font-semibold">Head Features</h3>
          {headMorphSliders.map((morph) => morphSlider(morph, HEAD_MORPH_MIN, HEAD_MORPH_MAX))}
        </div>
      )}

      {bodyMorphSliders.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-title font-semibold">Initial Body Features</h3>
          {bodyMorphSliders.map((morph) => morphSlider(morph, BODY_MORPH_MIN, BODY_MORPH_MAX))}
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
            value={pinnedColor(channel) ?? value}
            base={caps?.colors?.[channel] ?? DEFAULT_COLORS[channel]}
            onChange={(hex) => changeChannel(channel, hex)}
            onUndo={() => undoChannel(channel)}
            onPickStart={() => setPicking(true)}
            onPickEnd={() => setPicking(false)}
            heldBy={heldColor(channel)}
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
                base={extraBase[extraSel] ?? extraPicker[extraSel] ?? '#ffffff'}
                onChange={(hex) => changeExtra(extraSel, hex)}
                onUndo={() => undoExtra(extraSel)}
                onPickStart={() => setPicking(true)}
                onPickEnd={() => setPicking(false)}
              />
            )}
          </div>
        )}
      </div>
    </>
  );

  return { setCaps, vrmViewerRef, viewerProps, controls, characterData };
}
