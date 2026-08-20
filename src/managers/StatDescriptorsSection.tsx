/**
 * The Stat Descriptors editor section: a coverage bar over the stat's whole range, one captioned row per
 * band, and the unit the thresholds are written in.
 *
 * A threshold is the top of its band, so what an author needs to see is the extent each one claims and the
 * range left with no status at all — the bar and the captions draw exactly what `lib/statDescriptorGeometry`
 * computes, which is the same geometry the prompt's band lookup and the Bench's rules read.
 */
import { useLayoutEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { activeDescriptor } from '@/lib/statContext';
import {
  convertDescriptorUnits, descriptorSpans, startCaptionLeft, statMax, statMin, statStartValue,
  thresholdInputWidthRem, thresholdTagInsetRem, thresholdUnitOf, thresholdUnitTag, uncoveredSpan,
} from '@/lib/statDescriptorGeometry';
import type { Stat, StatDescriptor, ThresholdUnit } from '@/types';

export interface StatDescriptorsSectionProps {
  stat: Partial<Stat>;
  newDescriptor: { threshold: number | string; description: string };
  setNewDescriptor: (next: { threshold: number | string; description: string }) => void;
  onDescriptorChange: (index: number, field: string, value: string | number) => void;
  onDescriptorBlur: () => void;
  onAddDescriptor: () => void;
  onRemoveDescriptor: (id: string | number) => void;
  /** The unit and the converted list, written together: a second write would build on the first's draft. */
  onUnitChange: (unit: ThresholdUnit, descriptors: StatDescriptor[]) => void;
}

/** Tints for consecutive bands, so neighbors read apart without carrying meaning of their own. */
const BAND_TINTS = ['bg-primary/30', 'bg-primary/50', 'bg-primary/70', 'bg-primary/85', 'bg-primary'];

/** A threshold input wearing its unit inside the right edge — a placeholder says it only until you type. */
const UnitInput = ({ value, unit, onChange, onBlur, placeholder, ariaLabel }: {
  value: number | string; unit: string; placeholder?: string; ariaLabel: string;
  onChange: (v: string) => void; onBlur?: () => void;
}) => (
  <div className="relative flex-shrink-0" style={{ width: `${thresholdInputWidthRem(unit)}rem` }}>
    <Input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      aria-label={ariaLabel}
      // Width and padding both track the tag's length, so the tag never crowds out the value.
      style={{ paddingRight: `${thresholdTagInsetRem(unit)}rem` }}
      className="[appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
    />
    <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-helper text-muted-foreground">
      {unit}
    </span>
  </div>
);

/** A band of the bar. Its label wraps to two centered lines and steps its font down until it fits, so long
 *  descriptor prose narrows the text rather than dictating it. */
const BarSegment = ({ text, width, className, title }: {
  text: string; width: string; className: string; title: string;
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = boxRef.current;
    const span = box?.firstElementChild as HTMLElement | null;
    if (!box || !span) return;
    let size = 12;
    box.style.fontSize = `${size}px`;
    while (size > 8 && (span.scrollHeight > span.clientHeight + 1 || span.scrollWidth > span.clientWidth + 1)) {
      size -= 1;
      box.style.fontSize = `${size}px`;
    }
  }, [text, width]);
  return (
    <div
      ref={boxRef}
      className={`flex items-center justify-center overflow-hidden px-1 text-center leading-tight ${className}`}
      style={{ width }}
      title={title}
    >
      <span className="line-clamp-2">{text}</span>
    </div>
  );
};

/** The turn-one marker under the bar: an arrow at the exact starting value, and a caption that centers
 *  under it when it can and hugs the bar's edges when it can't — the arrow never moves for the caption. */
const StartMarker = ({ fraction, start }: { fraction: number; start: number }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const row = rowRef.current;
    const caption = captionRef.current;
    if (!row || !caption) return;
    const place = () => {
      caption.style.left = `${startCaptionLeft(fraction * row.clientWidth, caption.offsetWidth, row.clientWidth)}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(row);
    return () => observer.disconnect();
  }, [fraction, start]);
  return (
    <div ref={rowRef} className="absolute inset-x-0 top-9">
      <div
        className="absolute h-0 w-0 -translate-x-1/2 border-x-[5px] border-b-[6px] border-x-transparent border-b-foreground motion-safe:transition-[left] motion-safe:duration-100"
        style={{ left: `${fraction * 100}%` }}
      />
      <span ref={captionRef} className="absolute top-[7px] whitespace-nowrap text-helper leading-none text-muted-foreground motion-safe:transition-[left] motion-safe:duration-100">
        starts at {start}
      </span>
    </div>
  );
};

export const StatDescriptorsSection = ({
  stat, newDescriptor, setNewDescriptor, onDescriptorChange, onDescriptorBlur, onAddDescriptor,
  onRemoveDescriptor, onUnitChange,
}: StatDescriptorsSectionProps) => {
  const min = statMin(stat);
  const max = statMax(stat);
  const range = max - min;
  const unit = thresholdUnitOf(stat);
  const tag = thresholdUnitTag(stat);
  const spans = descriptorSpans(stat);
  const spanById = new Map(spans.map((span) => [span.id, span]));
  const gap = uncoveredSpan(stat);
  const start = statStartValue(stat);
  // The band a fresh game opens in, through the game's own lookup so the bar can't disagree with play.
  // Undefined means the start sits in the uncovered zone, which is then what applies.
  const startBand = activeDescriptor(stat, start);
  const descriptors = stat.descriptors ?? [];
  // A Percentage stat is pinned to 0–100, where both readings are the same number — no choice to offer.
  const offersUnits = stat.type?.toLowerCase() !== 'percentage';
  // A degenerate range has no width to divide, so the bar is dropped rather than drawn at zero.
  const width = (from: number, to: number) => `${Math.max(0, ((to - from) / range) * 100)}%`;

  const switchUnit = (next: ThresholdUnit) => {
    if (next === unit) return;
    onUnitChange(next, convertDescriptorUnits(stat, next));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>Stat Descriptors</Label>
        {offersUnits && (
          <div className="flex items-center gap-2">
            <span className="text-helper text-muted-foreground">Thresholds in</span>
            <ToggleGroup
              type="single"
              value={unit}
              onValueChange={(v) => { if (v) switchUnit(v as ThresholdUnit); }}
              aria-label="Threshold units"
              className="h-8"
            >
              <ToggleGroupItem value="raw" className="h-6 px-2 text-helper">Raw Unit</ToggleGroupItem>
              <ToggleGroupItem value="percent" className="h-6 px-2 text-helper">% of Max</ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}
      </div>

      {spans.length > 0 && range > 0 && (
        // Clearance for the start marker is padding: space-y pins a child's margin-bottom to 0.
        <div className="relative pb-8">
          <div className="flex h-9 w-full overflow-hidden rounded-md border border-border">
            {spans.map((span, i) => (
              <BarSegment
                key={span.id}
                text={span.description}
                width={width(span.from, span.to)}
                className={`${BAND_TINTS[i % BAND_TINTS.length]} text-primary-foreground${span.id === startBand?.id ? ' font-semibold' : ''}`}
                title={`${span.from} – ${span.to}: ${span.description}`}
              />
            ))}
            {gap && (
              <BarSegment
                text="no status"
                width={width(gap.from, gap.to)}
                className={`bg-destructive/15 text-destructive${startBand ? '' : ' font-semibold'}`}
                title={`${gap.from} – ${gap.to}: no status`}
              />
            )}
          </div>
          <StartMarker fraction={Math.min(1, Math.max(0, (start - min) / range))} start={start} />
        </div>
      )}

      {descriptors.map((descriptor, index) => {
        const span = spanById.get(descriptor.id);
        return (
          <div key={descriptor.id}>
            <div className="flex items-center space-x-2">
              <UnitInput
                value={descriptor.threshold}
                unit={tag}
                ariaLabel={`Threshold for ${descriptor.description || 'descriptor'}`}
                onChange={(v) => onDescriptorChange(index, 'threshold', Number(v))}
                onBlur={onDescriptorBlur}
              />
              <Input
                value={descriptor.description}
                onChange={(e) => onDescriptorChange(index, 'description', e.target.value)}
                placeholder="Description"
                className="flex-grow"
              />
              <Button variant="ghost" size="icon" onClick={() => onRemoveDescriptor(descriptor.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {span && (
              <p className="ml-1 mt-0.5 text-helper text-muted-foreground">
                covers {span.from} – {span.to}{unit === 'percent' ? ` of ${max}` : ''}
              </p>
            )}
          </div>
        );
      })}

      <div className="flex items-center space-x-2">
        <UnitInput
          value={newDescriptor.threshold}
          unit={tag}
          placeholder="Up to"
          ariaLabel="New threshold"
          onChange={(v) => setNewDescriptor({ ...newDescriptor, threshold: v === '' ? '' : Number(v) })}
        />
        <Input
          value={newDescriptor.description}
          onChange={(e) => setNewDescriptor({ ...newDescriptor, description: e.target.value })}
          placeholder="New Description"
          className="flex-grow"
        />
        <Button onClick={onAddDescriptor} size="icon" className="h-9 w-9 shrink-0" aria-label="Add Descriptor" title="Add Descriptor"><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
  );
};

export default StatDescriptorsSection;
