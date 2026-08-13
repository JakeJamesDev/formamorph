import { useEffect, useState, type CSSProperties } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useSettings } from '@/contexts/SettingsContext';
import { FONT_OPTIONS, fontStack, fontSizeAdjust, SYSTEM_FONT_STACK, type FontChoice } from '@/contexts/settingsDefaults';
import {
  FONT_TUNING_RANGES, boldWeightRange, boldWeightFor, fontTuningDefaults, isFontTuningDefault,
  resolveFontTuning, type FontTuning,
} from '@/lib/fontTuning';

const SAMPLE = 'The lantern guttered as you stepped into the hollow.';

/** One labeled slider over a numeric field of the draft. */
function TuneSlider({
  label, value, min, max, step, format, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-label">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-meta text-muted-foreground tabular-nums">{format(value)}</span>
      </span>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
    </label>
  );
}

/**
 * Per-font tuning for whichever font `font` names. The draft lives here and reaches nothing but the
 * sample text until Save — a game in progress must not reflow while the sliders move.
 */
function FontTuneDialog({ font, open, onOpenChange }: { font: FontChoice; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { fontTunings, setFontTuning } = useSettings();
  const [draft, setDraft] = useState<FontTuning>(() => resolveFontTuning(font, fontTunings));

  // Reopening — or opening from the other selector, on a different font — starts from what's in force.
  useEffect(() => {
    if (open) setDraft(resolveFontTuning(font, fontTunings));
    // Reading the stored map on open only; a later store change while open would discard the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, font]);

  const set = <K extends keyof FontTuning>(key: K) => (v: FontTuning[K]) => setDraft((d) => ({ ...d, [key]: v }));

  const label = FONT_OPTIONS.find((f) => f.value === font)?.label ?? font;
  const stack = fontStack(font);
  const boldRange = boldWeightRange(font);
  const bold = boldWeightFor(font, draft);

  // The sample renders from the draft alone: its own family, its own tuned size target, weights and skew.
  const sampleStyle: CSSProperties = {
    fontFamily: stack ? `${stack}, ${SYSTEM_FONT_STACK}` : SYSTEM_FONT_STACK,
    // A string, not a number: React unit-suffixes an unknown numeric property, and `0.572px` is
    // invalid enough that the declaration never lands and the sample stops resizing.
    fontSizeAdjust: String(fontSizeAdjust(font) * draft.scale),
    lineHeight: 1.5 * draft.lineHeight,
    letterSpacing: `${draft.letterSpacing}em`,
  };
  const skew: CSSProperties = draft.italicSkew > 0
    ? { display: 'inline-block', transform: `skewX(-${draft.italicSkew}deg)` }
    : {};

  const save = () => {
    setFontTuning(font, draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Customize {label}</DialogTitle>
          <DialogDescription>
            Tune how this font renders. Every font keeps its own settings, and they apply wherever you use it.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 rounded-md border border-border bg-muted/80 p-4 text-body space-y-1" style={sampleStyle}>
          <p>{SAMPLE}</p>
          <p style={{ fontWeight: bold }}>{SAMPLE}</p>
          <p style={{ fontStyle: 'italic' }}><span style={skew}>{SAMPLE}</span></p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1 pt-1">
          <TuneSlider
            label="Font Size"
            value={draft.scale}
            {...FONT_TUNING_RANGES.scale}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={set('scale')}
          />
          <TuneSlider
            label="Bold Weight"
            value={draft.boldWeight}
            {...boldRange}
            format={(v) => `${v} / ${bold}`}
            onChange={set('boldWeight')}
          />
          <TuneSlider
            label="Italic Slant"
            value={draft.italicSkew}
            {...FONT_TUNING_RANGES.italicSkew}
            format={(v) => (v === 0 ? 'None' : `${v}°`)}
            onChange={set('italicSkew')}
          />
          <TuneSlider
            label="Line Height"
            value={draft.lineHeight}
            {...FONT_TUNING_RANGES.lineHeight}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={set('lineHeight')}
          />
          <TuneSlider
            label="Letter Spacing"
            value={draft.letterSpacing}
            {...FONT_TUNING_RANGES.letterSpacing}
            format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(3)}em`}
            onChange={set('letterSpacing')}
          />
          <p className="text-helper text-muted-foreground">
            Bold Weight sets how heavy semibold text renders; bold sits a step above it, as far as this
            font goes. Both numbers appear beside the slider.
          </p>
        </div>

        <DialogFooter className="shrink-0 flex-row items-center justify-between sm:justify-between">
          <Button
            variant="ghost"
            disabled={isFontTuningDefault(font, draft)}
            onClick={() => setDraft(fontTuningDefaults(font))}
          >
            Reset to Defaults
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Button + dialog to tune one font; drop beside a font selector, passing that selector's active font. */
export function FontTuneButton({ font }: { font: FontChoice }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Customize…
      </Button>
      {open && <FontTuneDialog font={font} open={open} onOpenChange={setOpen} />}
    </>
  );
}
