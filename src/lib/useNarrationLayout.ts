import { useSettings } from '@/contexts/SettingsContext';
import type { NarrationLayout } from '@/contexts/settingsDefaults';
import { useDevRoute } from '@/lib/devRouter';

/** The narration layout in force: the setting, or in DEV a `mode=chat|pages` route override that is not saved. */
export function useNarrationLayout(): NarrationLayout {
  const { narrationLayout } = useSettings();
  const devRoute = useDevRoute();
  const routeLayout = import.meta.env.DEV && (devRoute?.mode === 'chat' || devRoute?.mode === 'pages') ? devRoute.mode : null;
  return routeLayout ?? narrationLayout;
}
