import { HintInfo } from '@/components/SettingsRows';
import { SETTINGS_COPY, type SettingCopy, type SettingCopyKey, type SettingOptionCopy } from './settingsCopy';

/**
 * Spreads one setting's copy onto a `Row` or `CheckRow`, so a call site names the setting and nothing
 * else — label, description, badge and `ⓘ` all come from `settingsCopy`, where the guard test holds them
 * to the modal's copy rules. Shared by the Settings modal and the local-engine panel.
 */
export function rowCopy(key: SettingCopyKey) {
  const c: SettingCopy = SETTINGS_COPY[key];
  return {
    label: c.label,
    hint: c.description,
    experimental: c.experimental,
    info: c.info ? <HintInfo>{c.info}</HintInfo> : undefined,
  };
}

/**
 * The same copy for a segmented row, whose control already prints the picked option's help in the hint's
 * slot. The description moves to the label's `ⓘ` so the row says each thing once.
 *
 * Pass the selected option and the `ⓘ` also carries its `detail`, which is how an option explains its cost
 * or mechanism without the twelve-word line growing to hold it. The icon renders either way — an
 * affordance that came and went as you clicked through options would read as a fault.
 *
 * The detail sits under a header naming the option, because the same icon showing different text as you
 * click through a row otherwise reads as one blurb about the row rather than one about your selection.
 */
export function optionRowCopy(key: SettingCopyKey, selected?: SettingOptionCopy) {
  const c: SettingCopy = SETTINGS_COPY[key];
  const detail = selected?.detail && `#### ${selected.label}\n\n${selected.detail}`;
  const body = [c.description, c.info, detail].filter(Boolean).join('\n\n');
  return {
    label: c.label,
    experimental: c.experimental,
    info: <HintInfo>{body}</HintInfo>,
  };
}
