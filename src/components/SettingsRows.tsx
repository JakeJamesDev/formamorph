// Shared label+control rows for the settings surfaces (SettingsModal tabs, LocalModelPanel).
// All build on the same two-column `grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)]` (a fixed 1:3 with a 0
// floor so a wide control can't squeeze the label column; stacked to one column below `sm`) with a
// right-aligned label on wider screens.
import type { ReactNode } from 'react';
import { FlaskConical, Info, Sparkles } from 'lucide-react';
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
        // `h4` is reserved for the "this part is about your current selection" header a segmented row's
        // ⓘ puts above the option detail — styled like a Section title so it reads as a divider, not prose.
        className="w-80 max-w-[calc(100vw-2rem)] text-helper leading-relaxed text-muted-foreground [&_p]:my-0 [&_*+p]:mt-2 [&_ul]:my-0 [&_*+ul]:mt-1.5 [&_ul]:list-disc [&_ul]:list-outside [&_ul]:pl-5 [&_li]:mt-0.5 [&_li]:pl-0.5 [&_strong]:font-medium [&_strong]:text-foreground [&_code]:text-[0.9em] [&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:border-t [&_h4]:border-border [&_h4]:pt-3 [&_h4]:text-meta [&_h4]:font-semibold [&_h4]:uppercase [&_h4]:tracking-wider [&_h4]:text-foreground"
      >
        {/* Keyed by content: Streamdown memoizes blocks by their position in the source, so a hint whose
            text swaps with the selected option keeps the old block at that position otherwise. */}
        <Streamdown key={children} remarkPlugins={[remarkGfm]} controls={false}>{children}</Streamdown>
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

/** The label cell every settings row draws through — `Row` and `CheckRow` both delegate here, so the
 *  `text-left sm:text-right` alignment can't be forgotten per-row and drift out of line.
 *  `align` sets how the label sits against its control: the default `center` rides the grid's own
 *  centering, `top` pins it to the first line of a tall control (a stacked field, a textarea), and `check`
 *  lines it up on a checkbox's small box.
 *  `muted` dims it. `info` renders an affordance (e.g. `HintInfo`) right after the label text, so a row's
 *  detail control sits in a consistent column at the label boundary rather than trailing lead text.
 *  Renders a `<label>` when `htmlFor` is given, else a `<span>` (for non-interactive controls). */
export type RowAlign = 'top' | 'center' | 'check';

const ROW_ALIGN_CLASS: Record<RowAlign, string> = {
  top: 'self-start pt-2', center: '', check: 'leading-4',
};

export function RowLabel({ htmlFor, align = 'center', muted, info, experimental, className = '', children }: {
  htmlFor?: string; align?: RowAlign; muted?: boolean; info?: ReactNode;
  experimental?: boolean; className?: string; children: ReactNode;
}) {
  const alignClass = `${ROW_ALIGN_CLASS[align]}${className ? ` ${className}` : ''}`;
  const cls = `text-left sm:text-right ${alignClass}${muted ? ' text-muted-foreground' : ''}`;
  const adornment = (experimental || info) && (
    <>
      {experimental && <ExperimentalBadge />}
      {info}
    </>
  );
  const label = htmlFor
    ? <label htmlFor={htmlFor} className={adornment ? 'text-left sm:text-right' : cls}>{children}</label>
    : <span className={adornment ? 'text-left sm:text-right' : cls}>{children}</span>;
  if (!adornment) return label;
  // The label keeps its text alignment; the flex cell owns the vertical align + muting and right-anchors
  // the [label · info] pair, so the info icon lands in the same column on every row.
  return (
    <div className={`flex items-center justify-start sm:justify-end gap-1.5 ${alignClass}${muted ? ' text-muted-foreground' : ''}`}>
      {label}
      {adornment}
    </div>
  );
}

/** Marks a setting that may change or go away. An icon rather than a word in the description, so the
 *  caveat is said once per row instead of eating a third of a twelve-word line — and matched to the `ⓘ`
 *  beside it, since a bordered chip reads as louder than the caveat is. The `title` is the only carrier
 *  of the wording; it's a caveat, not something you need in order to operate the setting. */
function ExperimentalBadge() {
  return (
    <span title="Experimental — this setting may change or be removed." aria-label="Experimental" className="shrink-0 text-muted-foreground">
      <FlaskConical className="h-4 w-4" />
    </span>
  );
}

/** Marks the option a row recommends, on the item itself so the recommendation is visible before you
 *  pick it. Matched to the experimental flask so the two markers read as one family. */
export function RecommendedMark() {
  return (
    <span title="Recommended" aria-label="Recommended" className="ml-1.5 inline-flex shrink-0 text-muted-foreground">
      <Sparkles className="h-3.5 w-3.5" />
    </span>
  );
}

/**
 * A label + control row on the settings tabs' two-column grid — the one shape every non-checkbox setting
 * uses, so a tab reads as a single column of controls rather than a pile of bespoke grids.
 *
 * The hint sits on its own grid row rather than beneath the control inside one cell, which is what lets the
 * label center on the **control** instead of on the control-plus-hint stack. Centering by the stack drops
 * the label below the control's midline by half the hint's height, and by a different amount on every row.
 *
 * `top` opts out for a control taller than a line or two — a stacked field, a textarea — where centering
 * would strand the label in the middle of it. A row that stacks its own extra content under the control
 * (a status line that comes and goes) takes `top` too, and marks that wrapper `data-row-stacked` so the
 * alignment guard can tell it apart from a plain one-line control. Omitting `label` leaves the label cell
 * empty, which is how a row that is only a button or a status line still lands in the control column.
 */
export function Row({ label, htmlFor, children, hint, top, info, muted, experimental }: {
  label?: string; htmlFor?: string; children: ReactNode; hint?: string;
  top?: boolean; info?: ReactNode; muted?: boolean; experimental?: boolean;
}) {
  return (
    // Row gaps are margins rather than `gap-y`: the label needs a full gap under it when the grid stacks
    // on mobile, and the hint needs a tight one, which a single gap value can't give both.
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-center gap-x-4">
      {label === undefined
        // Holds the column open on wide screens only: on mobile the grid is one column, where an empty
        // cell would just be a gap above the control.
        ? <span className="hidden sm:block" />
        : <RowLabel
            htmlFor={htmlFor}
            className="mb-4 sm:mb-0"
            align={top ? 'top' : 'center'}
            muted={muted}
            info={info}
            experimental={experimental}
          >{label}</RowLabel>}
      <div className="min-w-0">{children}</div>
      {hint && <Hint className="mt-1 sm:col-start-2">{hint}</Hint>}
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
export function CheckRow({ label, htmlFor, checked, onChange, hint, info, experimental }: {
  label: string; htmlFor: string; checked: boolean; onChange: (v: boolean) => void; hint: string;
  info?: ReactNode; experimental?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
      <RowLabel htmlFor={htmlFor} info={info} experimental={experimental}>{label}</RowLabel>
      <div className="flex items-start gap-2">
        {/* The box is shorter than the line of text beside it, so a `1lh` sleeve centers it on that line —
            top-aligning it instead leaves its center above the label's and reads as a row out of true. */}
        <span className="flex h-[1lh] shrink-0 items-center">
          <Checkbox id={htmlFor} checked={checked} onCheckedChange={(c) => onChange(c === true)} className="shrink-0" />
        </span>
        <Hint as="span">{hint}</Hint>
      </div>
    </div>
  );
}
