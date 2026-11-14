import { memo } from 'react';
import { BlockedActionTip } from '@/components/BlockedActionTip';
import { SelectItem } from '@/components/ui/select';

export interface SelectOption {
  value: string;
  label: string;
  /** Shows the option disabled, with this reason as its tooltip. */
  blockedReason?: string | null;
}

const Option = memo(({ value, label, blockedReason }: SelectOption) => (
  <BlockedActionTip reason={blockedReason ?? null}>
    <SelectItem value={value} disabled={!!blockedReason}>{label}</SelectItem>
  </BlockedActionTip>
));
Option.displayName = 'SelectOption';

/**
 * The items of a Select over a long list. Radix mounts every item while the list is closed, so a parent
 * render re-renders each one; an item whose value and label are unchanged skips that render.
 */
export const SelectOptions = memo(({ options }: { options: readonly SelectOption[] }) => (
  <>
    {options.map((o) => <Option key={o.value} value={o.value} label={o.label} blockedReason={o.blockedReason} />)}
  </>
));
SelectOptions.displayName = 'SelectOptions';
