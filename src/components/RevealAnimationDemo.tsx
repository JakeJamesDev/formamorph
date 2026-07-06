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
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useSettings } from '@/contexts/SettingsContext';
import {
  REVEAL_EASINGS, REVEAL_DIRECTIONS, REVEAL_SCALE_MODES, revealActive, revealAnimName, revealVars,
  DEFAULT_REVEAL_EASING, DEFAULT_REVEAL_FADE, DEFAULT_REVEAL_MOVE, DEFAULT_REVEAL_MOVE_DIRECTION,
  DEFAULT_REVEAL_MOVE_DISTANCE, DEFAULT_REVEAL_SCALE, DEFAULT_REVEAL_SCALE_MODE, DEFAULT_REVEAL_SCALE_DIRECTION,
  DEFAULT_REVEAL_SCALE_AMOUNT, DEFAULT_REVEAL_BLUR, DEFAULT_REVEAL_BLUR_AMOUNT,
  DEFAULT_PREVIEW_DURATION, DEFAULT_PREVIEW_STAGGER, DEFAULT_REVEAL_MIN_DURATION, DEFAULT_REVEAL_MIN_STAGGER,
  type RevealDirection, type RevealScaleMode,
} from '@/lib/narrationRevealConfig';
import 'streamdown/styles.css';

const SAMPLE =
  'The lantern guttered as you stepped into the hollow. Cold air pressed close, and somewhere ahead water dripped in the dark. You are not alone here.';
const WORDS = SAMPLE.split(' ');

function DirectionSelect({ value, onChange }: { value: RevealDirection; onChange: (v: RevealDirection) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as RevealDirection)}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {REVEAL_DIRECTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function RevealAnimationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const {
    revealSpec,
    revealFade, setRevealFade,
    revealMove, setRevealMove,
    revealMoveDirection, setRevealMoveDirection,
    revealMoveDistance, setRevealMoveDistance,
    revealScale, setRevealScale,
    revealScaleMode, setRevealScaleMode,
    revealScaleDirection, setRevealScaleDirection,
    revealScaleAmount, setRevealScaleAmount,
    revealBlur, setRevealBlur,
    revealBlurAmount, setRevealBlurAmount,
    revealEasing, setRevealEasing,
    revealMinDuration, setRevealMinDuration,
    revealMinStagger, setRevealMinStagger,
    prefersReducedMotion,
  } = useSettings();

  const [loop, setLoop] = useState(true);
  const [playKey, setPlayKey] = useState(0);
  // The minimum sliders double as the preview speed; when a minimum is unlimited (0), preview at a
  // visible default so the animation still shows.
  const previewDuration = revealMinDuration || DEFAULT_PREVIEW_DURATION;
  const previewStagger = revealMinStagger || DEFAULT_PREVIEW_STAGGER;

  const active = revealActive(revealSpec);
  const keyframe = `sd-${revealAnimName(revealSpec)}`;

  useEffect(() => {
    setPlayKey((k) => k + 1);
  }, [revealSpec, revealEasing, previewDuration, previewStagger, open]);

  const totalMs = previewDuration + (WORDS.length - 1) * previewStagger;
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (loopRef.current) clearInterval(loopRef.current);
    if (!open || !loop || !active) return;
    loopRef.current = setInterval(() => setPlayKey((k) => k + 1), totalMs + 800);
    return () => {
      if (loopRef.current) clearInterval(loopRef.current);
    };
  }, [open, loop, active, totalMs]);

  const reset = () => {
    setRevealFade(DEFAULT_REVEAL_FADE);
    setRevealMove(DEFAULT_REVEAL_MOVE);
    setRevealMoveDirection(DEFAULT_REVEAL_MOVE_DIRECTION);
    setRevealMoveDistance(DEFAULT_REVEAL_MOVE_DISTANCE);
    setRevealScale(DEFAULT_REVEAL_SCALE);
    setRevealScaleMode(DEFAULT_REVEAL_SCALE_MODE);
    setRevealScaleDirection(DEFAULT_REVEAL_SCALE_DIRECTION);
    setRevealScaleAmount(DEFAULT_REVEAL_SCALE_AMOUNT);
    setRevealBlur(DEFAULT_REVEAL_BLUR);
    setRevealBlurAmount(DEFAULT_REVEAL_BLUR_AMOUNT);
    setRevealEasing(DEFAULT_REVEAL_EASING);
    setRevealMinDuration(DEFAULT_REVEAL_MIN_DURATION);
    setRevealMinStagger(DEFAULT_REVEAL_MIN_STAGGER);
  };

  const containerVars = revealVars(revealSpec) as CSSProperties;

  const atDefaults =
    revealFade === DEFAULT_REVEAL_FADE &&
    revealMove === DEFAULT_REVEAL_MOVE &&
    revealMoveDirection === DEFAULT_REVEAL_MOVE_DIRECTION &&
    revealMoveDistance === DEFAULT_REVEAL_MOVE_DISTANCE &&
    revealScale === DEFAULT_REVEAL_SCALE &&
    revealScaleMode === DEFAULT_REVEAL_SCALE_MODE &&
    revealScaleDirection === DEFAULT_REVEAL_SCALE_DIRECTION &&
    revealScaleAmount === DEFAULT_REVEAL_SCALE_AMOUNT &&
    revealBlur === DEFAULT_REVEAL_BLUR &&
    revealBlurAmount === DEFAULT_REVEAL_BLUR_AMOUNT &&
    revealEasing === DEFAULT_REVEAL_EASING &&
    revealMinDuration === DEFAULT_REVEAL_MIN_DURATION &&
    revealMinStagger === DEFAULT_REVEAL_MIN_STAGGER;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[705px] max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Narration reveal</DialogTitle>
        </DialogHeader>

        {/* Frozen live preview */}
        <div
          className="shrink-0 narration-text rounded-md border border-border bg-muted/80 p-4 text-base leading-relaxed min-h-[8rem]"
          style={containerVars}
        >
          {!active ? (
            <span className="text-muted-foreground">
              No effects — narration types in with the smooth character crawl (paced by the model’s speed,
              so it isn’t previewable here).
            </span>
          ) : (
            WORDS.map((w, i) => (
              <Fragment key={`${playKey}-${i}`}>
                <span
                  style={{
                    display: 'inline-block',
                    whiteSpace: 'pre',
                    transformOrigin: 'var(--rl-origin, center)',
                    animationName: keyframe,
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

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
        <DialogDescription>
          Stack any of these effects to build how each sentence appears. Changes save as you make them and
          preview live below.
        </DialogDescription>

        {/* Effects */}
        <div className="space-y-3">
          {/* Fade */}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={revealFade} onCheckedChange={(c) => setRevealFade(c === true)} />
            <span className="font-medium">Fade</span>
            <span className="text-xs text-muted-foreground">opacity 0 → 1</span>
          </label>

          {prefersReducedMotion && (
            <p className="text-xs text-warning">
              Your system’s <strong>Reduce Motion</strong> setting is on, so <strong>Move</strong> and{' '}
              <strong>Scale</strong> are disabled to respect it. Fade and Blur still apply. Turn it off in
              your OS accessibility settings to use them.
            </p>
          )}

          {/* Move */}
          <div className={`space-y-2 ${prefersReducedMotion ? 'opacity-50' : ''}`}>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={revealMove} disabled={prefersReducedMotion} onCheckedChange={(c) => setRevealMove(c === true)} />
              <span className="font-medium">Move in</span>
              <span className="text-xs text-muted-foreground">slides in from a direction</span>
            </label>
            {revealMove && !prefersReducedMotion && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">Direction</span>
                  <DirectionSelect value={revealMoveDirection} onChange={setRevealMoveDirection} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">Distance: {revealMoveDistance.toFixed(2)}em</span>
                  <Slider value={[revealMoveDistance]} min={0.1} max={2} step={0.05} onValueChange={(v) => setRevealMoveDistance(v[0])} />
                </label>
              </div>
            )}
          </div>

          {/* Scale */}
          <div className={`space-y-2 ${prefersReducedMotion ? 'opacity-50' : ''}`}>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={revealScale} disabled={prefersReducedMotion} onCheckedChange={(c) => setRevealScale(c === true)} />
              <span className="font-medium">Scale</span>
              <span className="text-xs text-muted-foreground">grows into place</span>
            </label>
            {revealScale && !prefersReducedMotion && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">Mode</span>
                  <Select value={revealScaleMode} onValueChange={(v) => setRevealScaleMode(v as RevealScaleMode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REVEAL_SCALE_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                {revealScaleMode === 'axis' && (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">Direction</span>
                    <DirectionSelect value={revealScaleDirection} onChange={setRevealScaleDirection} />
                  </label>
                )}
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">Start scale: {revealScaleAmount.toFixed(2)}</span>
                  <Slider value={[revealScaleAmount]} min={0.05} max={0.9} step={0.05} onValueChange={(v) => setRevealScaleAmount(v[0])} />
                </label>
              </div>
            )}
          </div>

          {/* Blur */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={revealBlur} onCheckedChange={(c) => setRevealBlur(c === true)} />
              <span className="font-medium">Blur</span>
              <span className="text-xs text-muted-foreground">sharpens into focus</span>
            </label>
            {revealBlur && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">Amount: {revealBlurAmount}px</span>
                  <Slider value={[revealBlurAmount]} min={1} max={12} step={1} onValueChange={(v) => setRevealBlurAmount(v[0])} />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Shared easing */}
        {active && (
          <label className="flex flex-col gap-1 text-sm sm:max-w-xs">
            <span className="text-muted-foreground">Easing (all effects)</span>
            <Select value={revealEasing} onValueChange={setRevealEasing}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REVEAL_EASINGS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
        )}

        {/* Minimum speed — floors the in-game reveal so a fast model stays readable; 0 = unlimited. */}
        {active && (
          <div className="rounded-md border border-dashed border-border p-3 space-y-3">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Minimum speed.</span> In game the pace follows the
              model’s tokens/sec, but never goes faster than these floors. 0 = no limit. The preview above runs
              at your minimum (or a default when unlimited).
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Min fade duration: {revealMinDuration === 0 ? 'Unlimited' : `${revealMinDuration}ms`}</span>
                <Slider value={[revealMinDuration]} min={0} max={1400} step={50} onValueChange={(v) => setRevealMinDuration(v[0])} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Min word stagger: {revealMinStagger === 0 ? 'Unlimited' : `${revealMinStagger}ms`}</span>
                <Slider value={[revealMinStagger]} min={0} max={150} step={5} onValueChange={(v) => setRevealMinStagger(v[0])} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={loop} onCheckedChange={(c) => setLoop(c === true)} />
              Loop preview
            </label>
          </div>
        )}
        </div>

        <DialogFooter className="shrink-0 flex-row items-center justify-between sm:justify-between">
          <ConfirmDialog
            title="Reset reveal animation"
            description="Reset all narration reveal settings to their defaults?"
            onConfirm={reset}
          >
            <Button variant="ghost" disabled={atDefaults}>Reset to defaults</Button>
          </ConfirmDialog>
          <div className="flex items-center gap-2">
            {active && <Button variant="secondary" onClick={() => setPlayKey((k) => k + 1)}>Replay</Button>}
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Button + dialog to compose and preview the narration reveal animation; drop into settings. */
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
