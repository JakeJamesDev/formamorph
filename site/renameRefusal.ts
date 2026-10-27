import { watchRefusals } from '@/lib/refusalWatch';
import AuthService, { USERNAME_RENAME_REQUIRED } from '@/services/AuthService';
import { RENAME_PATH, navigateSite } from './router';

/**
 * Send the session to the rename page when the server refuses a write with the rename code.
 *
 * The rename page itself is skipped, so a refusal there shows its own error instead of looping.
 *
 * @returns A function restoring the previous `fetch`
 */
export function watchRenameRefusal(): () => void {
  return watchRefusals(AuthService.API_URL, USERNAME_RENAME_REQUIRED, () => {
    if (window.location.pathname === RENAME_PATH) return;
    navigateSite(RENAME_PATH);
  });
}
