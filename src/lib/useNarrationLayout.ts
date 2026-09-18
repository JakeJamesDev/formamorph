import { useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import type { NarrationLayout } from '@/contexts/settingsDefaults';
import { useDevRoute } from '@/lib/devRouter';
import { statsSnap, type PageView } from '@/lib/chatReadingLine';

/** The narration layout in force: the setting, or in DEV a `mode=chat|pages` route override that is not saved. */
export function useNarrationLayout(): NarrationLayout {
  const { narrationLayout } = useSettings();
  const devRoute = useDevRoute();
  const routeLayout = import.meta.env.DEV && (devRoute?.mode === 'chat' || devRoute?.mode === 'pages') ? devRoute.mode : null;
  return routeLayout ?? narrationLayout;
}

/** Whether the stat bars snap on this render, per `statsSnap` over the previous render's page view. */
export function useStatsSnap(page: number, totalPages: number, chat: boolean): boolean {
  const [seen, setSeen] = useState<PageView & { snap: boolean }>({ page, totalPages, snap: false });
  if (seen.page !== page || seen.totalPages !== totalPages) {
    const snap = statsSnap(seen.snap, seen, { page, totalPages }, chat);
    setSeen({ page, totalPages, snap });
    return snap;
  }
  return seen.snap && chat;
}
