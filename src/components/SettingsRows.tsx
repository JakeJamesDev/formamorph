// Shared label+control rows for the settings surfaces (SettingsModal tabs, LocalModelPanel).
// All build on the same two-column `grid grid-cols-[1fr_3fr]` (stacked to one column below `sm`) with a
// right-aligned label on wider screens.
import type { ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';

/** A titled block of setting rows: a small-caps header with a hairline rule, so a long tab reads as a few
 *  named groups instead of one undifferentiated list. Sections space themselves via the tab's outer grid. */
export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <div className="space-y-1">
        <div className="flex items-baseline gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
          <div className="h-px flex-1 bg-border" />
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Indents rows that only exist while a parent toggle is on, so the dependency is visible rather than
 *  implied by the rows merely appearing. Nests for a second level (a child of a child). */
export function SubGroup({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 border-l-2 border-border pl-3 sm:pl-4">{children}</div>;
}

/** A label + control row on the settings tabs' two-column grid. `center` vertically centers the label
 *  against a single-line control; the default top-aligns it (for controls with a hint or multiple lines). */
export function Row({ label, htmlFor, children, hint, center }: {
  label: string; htmlFor?: string; children: ReactNode; hint?: string; center?: boolean;
}) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-[1fr_3fr] ${center ? 'sm:items-center' : 'items-start'} gap-4`}>
      <label htmlFor={htmlFor} className={center ? 'text-left sm:text-right' : 'text-left sm:text-right pt-1'}>{label}</label>
      <div className="space-y-1">
        {children}
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
      <span className="w-24 text-right text-sm tabular-nums">{format(value)}</span>
    </div>
  );
}

/** A checkbox row matching the settings tabs: right-anchored label + checkbox + secondary text beside it. */
export function CheckRow({ label, htmlFor, checked, onChange, hint }: {
  label: string; htmlFor: string; checked: boolean; onChange: (v: boolean) => void; hint: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_3fr] items-start gap-4">
      <label htmlFor={htmlFor} className="text-left sm:text-right leading-4">{label}</label>
      <div className="flex items-start gap-2">
        <Checkbox id={htmlFor} checked={checked} onCheckedChange={(c) => onChange(c === true)} className="shrink-0" />
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </div>
  );
}
