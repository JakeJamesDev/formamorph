import { OptionControl } from '@/components/game/SetupWorldOptions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hint } from '@/components/ui/typography';
import { optionValue } from '@/lib/worldOptions';
import type { WorldOption, WorldOptionValueOf, WorldOptionValues } from '@/types';

/** The in-game World Options tab: the Options flagged for change during play, each on its current value. */
export function WorldOptionsTab({ options, values, disabled, onChange, resolveText }: {
  /** Shown, mid-game Options in Options-tab order. */
  options: readonly WorldOption[];
  values: WorldOptionValues;
  /** Off while a turn runs, on a past page, or while a panel action still works. */
  disabled: boolean;
  onChange: (option: WorldOption, value: WorldOptionValueOf) => void;
  resolveText: (text: string) => string;
}) {
  return (
    <ScrollArea className="h-[calc(100%-1rem)]">
      <div className="space-y-6 px-2 pb-2" data-testid="world-options-tab">
        {options.map((option) => (
          <OptionControl
            key={option.id} option={option} value={optionValue(option, values)} disabled={disabled} commitOnRelease
            onChange={(next) => onChange(option, next)} resolveText={resolveText}
          />
        ))}
        {disabled && <Hint>Available between turns</Hint>}
      </div>
    </ScrollArea>
  );
}
