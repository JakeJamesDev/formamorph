/** DEV only: the game's half of the email-marker fixture. Apart from the stub, because the site cannot load the dev router. */
import { getDevRoute } from '@/lib/devRouter';
import { applyDevEmailMarker, emailMarkerFixture } from './devEmailMarkerStub';

/** Watches the dev route for `fixture=emailMarker-bounce` or `emailMarker-complaint`. A no-op outside DEV. */
export function installDevEmailMarkerStub(): void {
  if (!import.meta.env.DEV) return;
  const sync = () => applyDevEmailMarker(emailMarkerFixture(getDevRoute()?.fixture));
  sync();
  window.addEventListener('hashchange', sync);
}
