import { useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';

/**
 * Acts on a parked `requestSettings(...)` call and clears it, so a surface too deep to reach the Settings
 * modal can still deep-link into one of its tabs. Used by the two views that own the modal (MainMenu,
 * GameViewer); `open` receives the requested tab and, for AI Endpoints, its sub-tab.
 */
export function useSettingsOpenRequest(open: (tab: string, endpointTab?: string) => void) {
  const { settingsRequest, clearSettingsRequest } = useSettings();
  useEffect(() => {
    if (!settingsRequest) return;
    open(settingsRequest.tab, settingsRequest.endpointTab);
    clearSettingsRequest();
    // `open` is intentionally out of the deps: the request is cleared here, so a caller passing a fresh
    // closure every render can't re-fire it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsRequest, clearSettingsRequest]);
}
