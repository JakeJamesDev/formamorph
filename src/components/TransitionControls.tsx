import { Play } from 'lucide-react';
import { WidgetLabel, WidgetRow } from '@/components/formaquestion/WidgetRow';
import { OptionSwitcher, ValueSlider } from '@/components/SettingsRows';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { Hint } from '@/components/ui/typography';
import {
  DISSOLVE_RANGES, JELLY_RANGES, MASCOT_TRANSITION_MODES, type JellyTuning, type MascotTransition, type MascotTransitionMode, type TuningRange,
} from '@/lib/formaquestion/mascotTransition';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

type LabelCopy = { readonly label: string; readonly hint: string };

/** The words of one surface's transition controls. */
export interface TransitionCopy {
  readonly mode: LabelCopy;
  readonly modes: { readonly [K in MascotTransitionMode]: string };
  readonly reducedMotion: string;
  readonly jelly: { readonly [K in keyof JellyTuning]: LabelCopy };
  readonly dissolveDuration: LabelCopy;
  readonly play?: LabelCopy;
}

const ms = (value: number) => `${value} ms`;
const percent = (value: number) => `${Math.round(value * 100)}%`;

const JELLY_FORMATS: { readonly [K in keyof JellyTuning]: (value: number) => string } = {
  durationMs: ms,
  squash: percent,
  overshoot: percent,
  settle: String,
};

/** One tuning slider, held to its range, on one line of the widget. */
function TuningRow({ id, copy, range, value, format, disabled, onChange, onCommit }: {
  id: string;
  disabled: boolean;
  copy: LabelCopy;
  range: TuningRange;
  value: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
}) {
  return (
    <WidgetRow id={id} copy={copy}>
      <ValueSlider
        id={id}
        ariaLabel={copy.label}
        value={value}
        min={range.min}
        max={range.max}
        step={range.step}
        format={format}
        disabled={disabled}
        onChange={onChange}
        onCommit={onCommit}
        valueClassName="w-14 shrink-0 whitespace-nowrap"
      />
    </WidgetRow>
  );
}

/** A transition's mode, with Play when `onPlay` is given, and the chosen mode's tuning. */
export function TransitionControls({ transition, copy, idPrefix, readOnly, onTransition, onCommit, onPlay, playDisabled }: {
  transition: MascotTransition;
  copy: TransitionCopy;
  /** Prefixes each slider's id. */
  idPrefix: string;
  readOnly: boolean;
  /** `group` names the slider being dragged, so its edits join one undo step. */
  onTransition: (next: MascotTransition, group?: string) => void;
  /** The transition when a slider drag ends. */
  onCommit?: (next: MascotTransition) => void;
  onPlay?: () => void;
  playDisabled?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const options = MASCOT_TRANSITION_MODES.map((mode) => ({ value: mode, label: copy.modes[mode] }));
  const withJelly = (key: keyof JellyTuning, value: number): MascotTransition => ({ ...transition, jelly: { ...transition.jelly, [key]: value } });
  const withDissolve = (durationMs: number): MascotTransition => ({ ...transition, dissolve: { durationMs } });
  return (
    <div className="grid gap-2">
      <WidgetLabel copy={copy.mode} />
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <OptionSwitcher ariaLabel={copy.mode.label} value={transition.mode} options={options} onChange={(mode) => onTransition({ ...transition, mode })} disabled={readOnly} />
        </div>
        {onPlay && copy.play && (
          <Tip tip={copy.play.hint} labelsChild={false}>
            <Button variant="outline" size="sm" disabled={playDisabled} onClick={onPlay}>
              <Play className="mr-1 h-4 w-4" />{copy.play.label}
            </Button>
          </Tip>
        )}
      </div>
      {reduced && <Hint>{copy.reducedMotion}</Hint>}
      {transition.mode === 'jelly' && (Object.keys(JELLY_RANGES) as (keyof JellyTuning)[]).map((key) => (
        <TuningRow
          key={key}
          id={`${idPrefix}-jelly-${key}`}
          copy={copy.jelly[key]}
          range={JELLY_RANGES[key]}
          value={transition.jelly[key]}
          format={JELLY_FORMATS[key]}
          disabled={readOnly}
          onChange={(value) => onTransition(withJelly(key, value), `jelly-${key}`)}
          onCommit={onCommit && ((value) => onCommit(withJelly(key, value)))}
        />
      ))}
      {transition.mode === 'dissolve' && (
        <TuningRow
          id={`${idPrefix}-dissolve-duration`}
          copy={copy.dissolveDuration}
          range={DISSOLVE_RANGES.durationMs}
          value={transition.dissolve.durationMs}
          format={ms}
          disabled={readOnly}
          onChange={(durationMs) => onTransition(withDissolve(durationMs), 'dissolve-duration')}
          onCommit={onCommit && ((durationMs) => onCommit(withDissolve(durationMs)))}
        />
      )}
    </div>
  );
}
