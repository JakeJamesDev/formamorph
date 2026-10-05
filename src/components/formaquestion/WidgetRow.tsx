import type { ReactNode } from 'react';
import { HintInfo } from '@/components/SettingsRows';
import type { TargetAttribute } from '@/lib/surface/surfaceTargets';

/** A label with its hint behind an ⓘ, for the Mascot tab's narrow preview widget. */
export function WidgetLabel({ htmlFor, copy }: { htmlFor?: string; copy: { label: string; hint: string } }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {htmlFor ? <label htmlFor={htmlFor} className="truncate text-label">{copy.label}</label> : <span className="truncate text-label">{copy.label}</span>}
      <HintInfo>{copy.hint}</HintInfo>
    </span>
  );
}

/** One line of the preview widget: the label in a fixed column, the control beside it. */
export function WidgetRow({ id, copy, target, children }: {
  id: string;
  copy: { label: string; hint: string };
  /** Marks the row as a Take Me There target. */
  target?: TargetAttribute;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2" {...target}>
      <WidgetLabel htmlFor={id} copy={copy} />
      {children}
    </div>
  );
}
