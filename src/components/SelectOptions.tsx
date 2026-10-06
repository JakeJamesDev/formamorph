import { memo } from 'react';
import { SelectItem } from '@/components/ui/select';

export interface SelectOption {
  value: string;
  label: string;
}

const Option = memo(({ value, label }: SelectOption) => <SelectItem value={value}>{label}</SelectItem>);
Option.displayName = 'SelectOption';

/**
 * The items of a Select over a long list. Radix mounts every item while the list is closed, so a parent
 * render re-renders each one; an item whose value and label are unchanged skips that render.
 */
export const SelectOptions = memo(({ options }: { options: readonly SelectOption[] }) => (
  <>
    {options.map((o) => <Option key={o.value} value={o.value} label={o.label} />)}
  </>
));
SelectOptions.displayName = 'SelectOptions';
