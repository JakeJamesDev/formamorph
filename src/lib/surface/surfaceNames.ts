import type { DEV_MODAL_TABS } from '@/lib/devRoutes';
import type { SurfaceId } from '@/lib/docs/surfaceMap';

// Narrows what the shared report props accept to the app's surface ids and tab ledgers. It lives here,
// not in the shared file, so the account site does not reach the surface map through a dialog.
declare module '@/components/ui/surface' {
  interface SurfaceNames {
    id: SurfaceId;
    ledger: keyof typeof DEV_MODAL_TABS;
  }
}
