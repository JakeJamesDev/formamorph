import { HintInfo } from '@/components/SettingsRows';
import { SETTINGS_COPY, type SettingCopy, type SettingCopyKey } from './settingsCopy';

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
