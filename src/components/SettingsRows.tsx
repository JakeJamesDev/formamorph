// Shared label+control rows for the settings surfaces (SettingsModal tabs, LocalModelPanel).
// All build on the same two-column `grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)]` (a fixed 1:3 with a 0
// floor so a wide control can't squeeze the label column; stacked to one column below `sm`) with a
// right-aligned label on wider screens.
import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Streamdown } from 'streamdown';
import remarkGfm from 'remark-gfm';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Hint } from '@/components/ui/typography';
import 'streamdown/styles.css';

/** An `ⓘ` button that reveals its full explanation in a popover, so a setting row can show a terse lead
 *  inline and keep the long detail on demand. `children` is a **Markdown string** — write hints with a
 *  lead sentence and a short bullet list so the popover reads as structure, not a blob. Portaled (the
 *  default) so it floats above the settings ScrollArea instead of being clipped by its overflow; content
 *  is short and never scrolls, so the scroll-lock caveat in popover.tsx doesn't apply. Click-to-open so
 *  it works on touch. */
export function HintInfo({ children }: { children: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="More info"
          className="shrink-0 text-muted-foreground hover:text-foreground focus-visible:text-foreground outline-none"
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        collisionPadding={12}
        className="w-80 max-w-[calc(100vw-2rem)] text-helper leading-relaxed text-muted-foreground [&_p]:my-0 [&_*+p]:mt-2 [&_ul]:my-0 [&_*+ul]:mt-1.5 [&_ul]:list-disc [&_ul]:list-outside [&_ul]:pl-5 [&_li]:mt-0.5 [&_li]:pl-0.5 [&_strong]:font-medium [&_strong]:text-foreground [&_code]:text-[0.9em]"
      >
        <Streamdown remarkPlugins={[remarkGfm]} controls={false}>{children}</Streamdown>
      </PopoverContent>
    </Popover>
  );
}

/** A titled block of setting rows: a small-caps header with a hairline rule, so a long tab reads as a few
 *  named groups instead of one undifferentiated list. Sections space themselves via the tab's outer grid. */
export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <div className="space-y-1">
        <div className="flex items-baseline gap-3">
          <h3 className="text-meta font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
          <div className="h-px flex-1 bg-border" />
        </div>
        {hint && <Hint>{hint}</Hint>}
      </div>
      {children}
    </section>
  );
}

/** Wraps rows that only exist while a parent toggle is on. Currently visually neutral (a plain row group);
 *  kept as a seam so the dependency can be styled later without re-threading every call site. */
export function SubGroup({ children }: { children: ReactNode }) {
  return <div className="grid gap-4">{children}</div>;
}

/** The label cell for the hand-rolled two-column setting rows (the ones that don't fit `Row`/`CheckRow`).
 *  Owns the `text-left sm:text-right` alignment so it can't be forgotten per-row and drift out of line.
 *  `top` top-aligns against a multi-line control (else it centers on a single line); `muted` dims it.
 *  `info` renders an affordance (e.g. `HintInfo`) right after the label text, so a row's detail control
 *  sits in a consistent column at the label boundary rather than trailing variable-length lead text.
 *  Renders a `<label>` when `htmlFor` is given, else a `<span>` (for non-interactive controls). */
export function RowLabel({ htmlFor, top, muted, info, children }: {
  htmlFor?: string; top?: boolean; muted?: boolean; info?: ReactNode; children: ReactNode;
}) {
  const cls = `text-left sm:text-right ${top ? 'pt-2' : 'leading-4'}${muted ? ' text-muted-foreground' : ''}`;
  const label = htmlFor
    ? <label htmlFor={htmlFor} className={info ? 'text-left sm:text-right' : cls}>{children}</label>
    : <span className={info ? 'text-left sm:text-right' : cls}>{children}</span>;
  if (!info) return label;
  // The label keeps its text alignment; the flex cell owns the vertical align + muting and right-anchors
  // the [label · info] pair, so the info icon lands in the same column on every row.
  return (
    <div className={`flex items-center justify-start sm:justify-end gap-1.5 ${top ? 'pt-2' : 'leading-4'}${muted ? ' text-muted-foreground' : ''}`}>
      {label}
      {info}
    </div>
  );
}

/** A label + control row on the settings tabs' two-column grid. `center` vertically centers the label
 *  against a single-line control; the default top-aligns it (for controls with a hint or multiple lines). */
export function Row({ label, htmlFor, children, hint, center }: {
  label: string; htmlFor?: string; children: ReactNode; hint?: string; center?: boolean;
}) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] ${center ? 'sm:items-center' : 'items-start'} gap-4`}>
      <label htmlFor={htmlFor} className={center ? 'text-left sm:text-right' : 'text-left sm:text-right pt-1'}>{label}</label>
      <div className="space-y-1">
        {children}
        {hint && <Hint>{hint}</Hint>}
      </div>
    </div>
  );
}

/** A slider with its current value shown to the right. */
export function ValueSlider({ id, value, onChange, min, max, step, format }: {
  id?: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; format: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Slider id={id} className="flex-grow" value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
      <span className="w-24 text-right text-label tabular-nums">{format(value)}</span>
    </div>
  );
}

/** A checkbox row matching the settings tabs: right-anchored label + checkbox + secondary text beside it.
 *  `info` takes an affordance (e.g. `HintInfo`) rendered at the label boundary, so a row wanting the long
 *  explanation on demand doesn't have to be hand-built to get it. */
export function CheckRow({ label, htmlFor, checked, onChange, hint, info }: {
  label: string; htmlFor: string; checked: boolean; onChange: (v: boolean) => void; hint: string;
  info?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
      <RowLabel htmlFor={htmlFor} info={info}>{label}</RowLabel>
      <div className="flex items-start gap-2">
        <Checkbox id={htmlFor} checked={checked} onCheckedChange={(c) => onChange(c === true)} className="shrink-0" />
        <Hint as="span">{hint}</Hint>
      </div>
    </div>
  );
}
