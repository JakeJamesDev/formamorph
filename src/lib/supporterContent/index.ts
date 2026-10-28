/** The app's one Supporter content module, bound to the real fetch, clock and session. */
import { API_BASE_URL } from '@/lib/apiBase';
import AuthService from '@/services/AuthService';
import { createSupporterContent, type SupporterSession } from './supporterContent';

export * from './supporterContent';
export { isScrambledLayer, unscramble, unscrambleToCanvas, type ScrambledLayer } from './scramble';

const authSession = (): SupporterSession | null => {
  const id = AuthService.getCurrentUser()?.id;
  const token = AuthService.token;
  return token && (typeof id === 'string' || typeof id === 'number') ? { accountId: String(id), token } : null;
};

const RETRY_FAILED_MS = 60 * 1000;

export const supporterContent = createSupporterContent({
  fetch: (...args) => fetch(...args),
  now: () => Date.now(),
  session: authSession,
  apiBase: API_BASE_URL,
});

/**
 * Run the start check now, and again whenever the signed-in account changes. Refresh when the app comes back
 * into view, so a pledge made in the browser counts without a restart.
 *
 * @returns The unsubscribe
 */
export function watchSupporterContent(): () => void {
  let checkedFor: string | null = null;
  const run = () => {
    const account = authSession()?.accountId ?? '';
    if (account === checkedFor) return;
    checkedFor = account;
    void supporterContent.check();
  };
  const refresh = () => {
    if (document.visibilityState === 'visible') void supporterContent.refresh();
  };
  run();
  const stopSession = AuthService.onSessionChanged(run);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
  // A check that failed, such as on a busy server, tries again without waiting for the player.
  const retry = setInterval(() => { void supporterContent.refresh({ failedOnly: true }); }, RETRY_FAILED_MS);
  return () => {
    clearInterval(retry);
    stopSession();
    window.removeEventListener('focus', refresh);
    document.removeEventListener('visibilitychange', refresh);
  };
}
