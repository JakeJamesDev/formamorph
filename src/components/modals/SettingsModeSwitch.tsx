import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tip } from '@/components/ui/tooltip';
import type { SettingsMode } from '@/lib/settingsMode';
import { cn } from '@/lib/utils';

type RootProps = Omit<ComponentPropsWithoutRef<typeof ToggleGroup>, 'type' | 'value' | 'defaultValue' | 'onValueChange'>;

/** The Settings Simple/Advanced switch. Forwards its ref and props so a tutorial note can anchor on it. */
export const SettingsModeSwitch = forwardRef<ElementRef<typeof ToggleGroup>, RootProps & {
  mode: SettingsMode;
  onModeChange: (mode: SettingsMode) => void;
  /** Simple hides a setting that is off its default. */
  hasHiddenValues: boolean;
}>(function SettingsModeSwitch({ mode, onModeChange, hasHiddenValues, className, ...rest }, ref) {
  return (
    <ToggleGroup
      ref={ref}
      {...rest}
      type="single"
      value={mode}
      onValueChange={(v) => { if (v) onModeChange(v as SettingsMode); }}
      aria-label="Settings mode"
      className={cn('h-8', className)}
    >
      <ToggleGroupItem value="simple" className="px-2 py-1">Simple</ToggleGroupItem>
      {/* The marker rides the switch that acts on it: it says "there is more through here",
          which is exactly what this control does. */}
      <Tip
        tip={hasHiddenValues ? 'Some hidden settings are off their defaults. Switch to Advanced to see them.' : undefined}
        labelsChild={false}
      >
        <ToggleGroupItem value="advanced" className="relative px-2 py-1">
          Advanced
          {hasHiddenValues && (
            <span
              aria-label="Hidden settings are off their defaults"
              className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary"
            />
          )}
        </ToggleGroupItem>
      </Tip>
    </ToggleGroup>
  );
});
