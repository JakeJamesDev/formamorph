import { forwardRef, useId, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type ModeSelectValue = 'simple' | 'advanced';

type TriggerProps = Omit<ComponentPropsWithoutRef<typeof SelectTrigger>, 'children' | 'value' | 'defaultValue'>;

/**
 * The Simple/Advanced picker. The trigger keeps one width in both modes, so the controls beside it never
 * shift. The ref and every extra attribute go to the trigger, so tutorial notes, tour anchors and Take Me
 * There targets land on it.
 */
export const ModeSelect = forwardRef<ElementRef<typeof SelectTrigger>, TriggerProps & {
  mode: ModeSelectValue;
  onModeChange: (mode: ModeSelectValue) => void;
  /** The second line under each mode in the list. */
  descriptions: Record<ModeSelectValue, string>;
  /** Text for the dot and its tooltip. Absent: no dot. */
  hiddenNotice?: { label: string; tip: string };
}>(function ModeSelect({ mode, onModeChange, descriptions, hiddenNotice, className, 'aria-describedby': describedBy, ...rest }, ref) {
  const dotId = useId();
  // The trigger's own aria-label overrides its content, so the dot's text reaches a screen reader as a description.
  const describedByIds = [describedBy, hiddenNotice && dotId].filter(Boolean).join(' ') || undefined;
  return (
    <Select value={mode} onValueChange={(v) => onModeChange(v as ModeSelectValue)}>
      <SelectTrigger ref={ref} {...rest} aria-describedby={describedByIds} className={cn('relative w-[7.5rem] gap-2', className)}>
        <SelectValue>{mode === 'advanced' ? 'Advanced' : 'Simple'}</SelectValue>
        {/* The tip rides the dot, not the trigger: a Tip with no text drops its wrapper, so a trigger-wide
            tip would remount the trigger, and its focus with it, when the dot appears. */}
        {hiddenNotice && (
          <>
            <span id={dotId} className="sr-only">{hiddenNotice.label}</span>
            <Tip tip={hiddenNotice.tip} labelsChild={false}>
              <span aria-hidden className="absolute right-0 top-0 p-1">
                <span className="block h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
            </Tip>
          </>
        )}
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="simple">
          <span className="block">Simple</span>
          <span className="block text-meta text-muted-foreground">{descriptions.simple}</span>
        </SelectItem>
        <SelectItem value="advanced">
          <span className="block">Advanced</span>
          <span className="block text-meta text-muted-foreground">{descriptions.advanced}</span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
});
