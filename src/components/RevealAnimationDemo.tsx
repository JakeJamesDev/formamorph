import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useSettings } from '@/contexts/SettingsContext';
import {
  REVEAL_ANIMATIONS, REVEAL_EASINGS, REVEAL_DIRECTIONS, revealOption, revealVars,
  DEFAULT_REVEAL_ANIMATION, DEFAULT_REVEAL_EASING, DEFAULT_REVEAL_DIRECTION,
  DEFAULT_REVEAL_DISTANCE, DEFAULT_REVEAL_SCALE, DEFAULT_PREVIEW_DURATION, DEFAULT_PREVIEW_STAGGER,
} from '@/lib/narrationRevealConfig';
import 'streamdown/styles.css'; // ensures sd-fadeIn / sd-blurIn / sd-slideUp keyframes are loaded

const SAMPLE =
  'The lantern guttered as you stepped into the hollow. Cold air pressed close, and somewhere ahead water dripped in the dark. You are not alone here.';
const WORDS = SAMPLE.split(' ');

function RevealAnimationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const {
    revealAnimation, setRevealAnimation,
    revealEasing, setRevealEasing,
    revealDirection, setRevealDirection,
    revealDistance, setRevealDistance,
    revealScale, setRevealScale,
  } = useSettings();

  // Preview-only: in game these follow the model's tokens/sec, so they never touch the saved settings.
  const [previewDuration, setPreviewDuration] = useState(DEFAULT_PREVIEW_DURATION);
  const [previewStagger, setPreviewStagger] = useState(DEFAULT_PREVIEW_STAGGER);
  const [loop, setLoop] = useState(true);
  const [playKey, setPlayKey] = useState(0);

  const opt = revealOption(revealAnimation);
  const animated = opt.anim !== null;

  // Re-trigger the preview whenever anything visible changes, for instant feedback.
  useEffect(() => {
    setPlayKey((k) => k + 1);
  }, [revealAnimation, revealEasing, revealDirection, revealDistance, revealScale, previewDuration, previewStagger, open]);

  const totalMs = previewDuration + (WORDS.length - 1) * previewStagger;
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (loopRef.current) clearInterval(loopRef.current);
    if (!open || !loop || !animated) return;
    loopRef.current = setInterval(() => setPlayKey((k) => k + 1), totalMs + 800);
    return () => {
      if (loopRef.current) clearInterval(loopRef.current);
    };
  }, [open, loop, animated, totalMs]);

  const reset = () => {
    setRevealAnimation(DEFAULT_REVEAL_ANIMATION);
    setRevealEasing(DEFAULT_REVEAL_EASING);
    setRevealDirection(DEFAULT_REVEAL_DIRECTION);
    setRevealDistance(DEFAULT_REVEAL_DISTANCE);
    setRevealScale(DEFAULT_REVEAL_SCALE);
    setPreviewDuration(DEFAULT_PREVIEW_DURATION);
    setPreviewStagger(DEFAULT_PREVIEW_STAGGER);
  };

  const containerVars = revealVars(revealAnimation, revealDirection, revealDistance, revealScale) as CSSProperties;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Narration reveal</DialogTitle>
          <DialogDescription>
            Choose how each sentence of narration appears. Changes save as you make them and preview live
            below. <strong>None</strong> uses the classic smooth character crawl.
          </DialogDescription>
        </DialogHeader>

        {/* Live preview */}
        <div
          className="narration-text rounded-md border border-border bg-muted/80 p-4 text-base leading-relaxed min-h-[8rem]"
          style={containerVars}
        >
          {!animated ? (
            <span className="text-muted-foreground">
              No entrance animation — narration types in with the smooth character crawl (paced by the
              model’s speed, so it isn’t previewable here).
            </span>
          ) : (
            WORDS.map((w, i) => (
              <Fragment key={`${playKey}-${i}`}>
                <span
                  style={{
                    display: 'inline-block',
                    whiteSpace: 'pre',
                    transformOrigin: 'var(--rl-origin, center)',
                    animationName: `sd-${opt.anim}`,
                    animationDuration: `${previewDuration}ms`,
                    animationTimingFunction: revealEasing,
                    animationDelay: `${i * previewStagger}ms`,
                    animationFillMode: 'both',
                  }}
                >
                  {w}
                </span>
                {i < WORDS.length - 1 ? ' ' : ''}
              </Fragment>
            ))
          )}
        </div>

        {/* Saved settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Animation</span>
            <Select value={revealAnimation} onValueChange={(v) => setRevealAnimation(v as typeof revealAnimation)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REVEAL_ANIMATIONS.map((a) => (
                  <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          {animated && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Easing</span>
              <Select value={revealEasing} onValueChange={setRevealEasing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REVEAL_EASINGS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}

          {animated && opt.directional && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Direction</span>
              <Select value={revealDirection} onValueChange={(v) => setRevealDirection(v as typeof revealDirection)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REVEAL_DIRECTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}

          {animated && opt.amount === 'distance' && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Distance: {revealDistance.toFixed(2)}em</span>
              <Slider value={[revealDistance]} min={0.1} max={2} step={0.05} onValueChange={(v) => setRevealDistance(v[0])} />
            </label>
          )}

          {animated && opt.amount === 'scale' && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Start scale: {revealScale.toFixed(2)}</span>
              <Slider value={[revealScale]} min={0.05} max={0.9} step={0.05} onValueChange={(v) => setRevealScale(v[0])} />
            </label>
          )}
        </div>

        {/* Preview-only: not saved, in game these follow the model's speed */}
        {animated && (
          <div className="rounded-md border border-dashed border-border p-3 space-y-3">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Preview only.</span> In game the speed follows the
              model’s tokens/sec, so these don’t affect gameplay — they’re just for feeling the animation here.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Fade duration: {previewDuration}ms</span>
                <Slider value={[previewDuration]} min={100} max={1400} step={50} onValueChange={(v) => setPreviewDuration(v[0])} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Word stagger: {previewStagger}ms</span>
                <Slider value={[previewStagger]} min={0} max={150} step={5} onValueChange={(v) => setPreviewStagger(v[0])} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={loop} onCheckedChange={(c) => setLoop(c === true)} />
              Loop preview
            </label>
          </div>
        )}

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <Button variant="ghost" onClick={reset}>Reset to defaults</Button>
          <div className="flex items-center gap-2">
            {animated && <Button variant="secondary" onClick={() => setPlayKey((k) => k + 1)}>Replay</Button>}
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Button + dialog to choose and preview the narration reveal animation; drop into settings. */
export function RevealAnimationDemoButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Choose reveal animation…
      </Button>
      <RevealAnimationDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
