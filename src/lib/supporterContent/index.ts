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

export const supporterContent = createSupporterContent({
  fetch: (...args) => fetch(...args),
  now: () => Date.now(),
  session: authSession,
  apiBase: API_BASE_URL,
});

/**
 * Run the start check now, and again whenever the signed-in account changes.
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
  run();
  return AuthService.onSessionChanged(run);
}
