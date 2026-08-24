import React from 'react';
import type { PlayerStat } from '@/types';
import { statBarFrame, bandOrigin, formatStatDelta } from '@/lib/statBar';
import { activeDescriptor } from '@/lib/statContext';
import { statFieldStep, statFieldText } from '@/lib/statValueField';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

/** How long a value has to settle before its band is announced, so scrubbing through five bands is one
 *  announcement rather than five. */
const ANNOUNCE_DELAY_MS = 600;

/**
 * A stat bar with an animated +/- change band. One shared mechanism covers every case (an AI-computed
 * change, paging between turns, and a band draining on submit): the accent fill slides from the turn's
 * previous value to its current value, and a colored band (`bg-success` gain / `bg-destructive` loss) is
 * painted over the [prev, cur] region on top. `delta` is the signed change the band represents (`cur − prev`);
 * `draining` collapses last turn's band back toward the current value on submit (accent unmoved), leaving a
 * clean bar before the next turn grows. Geometry is the pure `statBarFrame`; under reduced-motion everything
 * snaps to its final state (no slide/grow, no drain band). `animKey` re-triggers the animation when the
 * value+delta coincide between turns (e.g. scrolling between two past turns) — pass the page number.
 */
const StatBar = ({ value, min, max, delta, draining, animKey }: {
  value: number; min: number; max: number; delta: number; draining: boolean;
  animKey?: string | number;
}) => {
  const reduce = usePrefersReducedMotion();
  // The band always spans the turn's previous value (`value − delta`) to its current value, whether it's
  // growing in or draining away; only the animation and the accent's motion differ.
  const frame = statBarFrame(value - delta, value, min, max);
  const key = `${value}-${delta}-${animKey ?? ''}`;
  return (
    <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
      <div
        // Accent slides prev→cur on a grow; on a drain the value is unchanged so it holds at its width.
        key={`fill-${key}`}
        className={`absolute inset-y-0 left-0 bg-primary ${!reduce && !draining ? 'stat-fill-slide' : ''}`}
        style={{
          width: `${frame.curPct}%`,
          ['--fill-from']: `${frame.prevPct}%`,
          ['--fill-to']: `${frame.curPct}%`,
        } as React.CSSProperties}
      />
      {frame.hasBand && !(reduce && draining) && (
        <div
          key={`${draining ? 'drain' : 'grow'}-${key}`}
          className={`${reduce ? '' : draining ? 'stat-delta-drain' : 'stat-delta-grow'} absolute inset-y-0 ${frame.gain ? 'bg-success' : 'bg-destructive'}`}
          style={{
            left: `${frame.bandLeftPct}%`,
            width: `${frame.bandWidthPct}%`,
            transformOrigin: bandOrigin(frame.gain, draining),
          }}
        />
      )}
    </div>
  );
};

/**
 * The stat's readout numeral, typeable. Every parseable keystroke commits through the same path the slider
 * uses, so the bar, the descriptor and the body morphs track typing exactly as they track a drag; what a
 * keystroke resolves to is the pure `statFieldStep`. The text follows the committed value while the field is
 * unfocused, so a turn's stat changes and a slider drag both write into it, and a blur snaps a blank field
 * back to the value the stat actually holds.
 */
const StatValueField = ({ stat, value, onCommit, onType }: {
  stat: PlayerStat;
  value: number;
  onCommit: (value: number) => void;
  /** Called before a keystroke's commit, so the row can tell a typed band change from a dealt one. */
  onType: () => void;
}) => {
  const [text, setText] = React.useState(() => statFieldText(value));
  const focused = React.useRef(false);
  React.useEffect(() => {
    if (!focused.current) setText(statFieldText(value));
  }, [value]);

  return (
    <Input
      type="number"
      // Raises the numeric keyboard on mobile rather than the full one.
      inputMode="numeric"
      aria-label={stat.name}
      // Native range semantics, and what the shared field's wheel stepping and spinners clamp against.
      min={stat.min}
      max={stat.max}
      step={1}
      size="sm"
      className="h-6 w-16 px-1 text-right"
      value={text}
      onFocus={(event) => { focused.current = true; event.target.select(); }}
      onBlur={() => { focused.current = false; setText(statFieldText(value)); }}
      onChange={(event) => {
        const step = statFieldStep(event.target.value, value, stat.min, stat.max);
        setText(step.text);
        if (step.commit === null) return;
        onType();
        onCommit(step.commit);
      }}
    />
  );
};

export interface StatRowProps {
  stat: PlayerStat;
  /** The viewed turn's signed change — the delta chip beside the readout. */
  change: number;
  /** The signed change the bar's band paints, which live and history resolve differently. */
  barDelta: number;
  /** Collapse the band back toward the current value instead of growing it in. */
  draining: boolean;
  /** The viewed page, re-keying the chip and the bar so a repeated change still animates. */
  page: number;
  /** History mode: the chip animates in, and nothing on the row can be edited. */
  isViewingPast: boolean;
  /** The live delta chip is on its way out. */
  fading: boolean;
  /** Edit mode is on and the turn is live, so the readout is typeable and the bar becomes a slider. */
  editable: boolean;
  /** Hold the descriptor line's height even when this value falls in no band, so a world with descriptors
   *  keeps every row the same height as its values move. */
  reserveDescriptorLine: boolean;
  onCommitValue: (value: number) => void;
}

/**
 * One stat in the in-game Stats tab: name, delta chip and readout, the bar (or the edit slider), and the
 * descriptor band the current value falls in.
 *
 * The band comes from the same `activeDescriptor` lookup the AI prompt and the Test Bench use, so the player
 * and the narrator can never disagree about a status. It flashes when a value the player did not type crosses
 * into a different band — a turn's changes, paging back through history, scrubbing the slider — which is what
 * makes "I just became Winded" legible without reading every number. Typing is excluded because the player is
 * already looking at the value they are setting; reduced motion drops the flash entirely.
 */
export const StatRow = ({
  stat, change, barDelta, draining, page, isViewingPast, fading, editable,
  reserveDescriptorLine, onCommitValue,
}: StatRowProps) => {
  const reduce = usePrefersReducedMotion();
  // Regen and stat code scale by the turn's measured hours, so values and deltas are often fractional. The
  // value reads whole; a change keeps a tenth when it has one, so a sub-point gain isn't printed as `+0`.
  // The underlying value keeps its full precision either way.
  const shownValue = Math.round(stat.value);
  const shownChange = formatStatDelta(change);
  const suffix = stat.type === 'percentage' ? '%' : ` / ${Math.round(stat.max)}`;
  const band = activeDescriptor(stat, stat.value);

  // A typed change is the player's own doing, so it never flashes; the ref is set by the field just before
  // its commit and cleared once the render that commit caused has been through.
  const typed = React.useRef(false);
  const previousBand = React.useRef<string | number | null | undefined>(undefined);
  const [flashKey, setFlashKey] = React.useState(0);
  const bandId = band?.id ?? null;
  React.useEffect(() => {
    // `undefined` is the mount pass: a row has no band change to flash on its first render.
    if (previousBand.current !== undefined && previousBand.current !== bandId && !typed.current && !reduce) {
      setFlashKey((key) => key + 1);
    }
    previousBand.current = bandId;
  }, [bandId, reduce]);
  React.useEffect(() => { typed.current = false; });

  // Screen readers get the band on its own, debounced: a scrub crosses several bands and should announce
  // where it landed, not every one it passed. Skipping the first pass keeps opening the tab quiet.
  const [announced, setAnnounced] = React.useState('');
  const announcedOnce = React.useRef(false);
  const bandText = band?.description ?? '';
  React.useEffect(() => {
    if (!announcedOnce.current) { announcedOnce.current = true; return; }
    const timer = setTimeout(() => setAnnounced(bandText), ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [bandText]);

  return (
    <div className="mb-2">
      <div className="flex justify-between items-center">
        <span>{stat.name}</span>
        <div className="flex items-center gap-2">
          {shownChange && (
            <span
              key={`${page}-${change}`}
              className={`${isViewingPast ? 'stat-delta-text-in' : (fading ? 'stat-delta-text-out' : 'stat-delta-text')} text-label ${change > 0 ? 'text-success' : 'text-destructive'}`}
            >
              {shownChange}
            </span>
          )}
          {editable ? (
            <span className="flex items-center gap-1">
              <StatValueField
                stat={stat}
                value={stat.value}
                onCommit={onCommitValue}
                onType={() => { typed.current = true; }}
              />
              <span>{suffix}</span>
            </span>
          ) : (
            <span>{shownValue}{suffix}</span>
          )}
        </div>
      </div>
      {editable ? (
        <Slider
          // Whole-step slider, so it tracks the rounded readout rather than a fractional value.
          value={[shownValue]}
          min={stat.min}
          max={stat.max}
          step={1}
          className="mt-2"
          onValueChange={(next) => onCommitValue(next[0])}
        />
      ) : (
        <StatBar
          value={stat.value}
          min={stat.min}
          max={stat.max}
          // While reviewing a past turn this is that turn's change, painted as a persistent animate-in band;
          // live it is the transient held/draining delta. Both feed the same (value − delta → value) geometry.
          delta={barDelta}
          draining={draining}
          animKey={isViewingPast ? page : undefined}
        />
      )}
      {(band || reserveDescriptorLine) && (
        // Truncated with the full text on hover, so a paragraph-length band can't push the list around.
        <p className="min-h-4 truncate text-meta text-muted-foreground" title={band?.description}>
          {band && (
            <span key={flashKey} className={flashKey > 0 ? 'stat-band-flash' : undefined}>
              {band.description}
            </span>
          )}
        </p>
      )}
      <span role="status" aria-live="polite" className="sr-only">{announced}</span>
    </div>
  );
};
