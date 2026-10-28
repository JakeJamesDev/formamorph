/** The app's Supporter mascot sync, bound to the Supporter content module and the help settings. */
import { createSupporterMascotSync } from '@/lib/formaquestion/supporterMascotSync';
import { supporterContent } from '@/lib/supporterContent';
import AuthService from '@/services/AuthService';
import { changeHelpSettings, currentHelpSettings } from './useHelpSettings';

const accountId = (): string | null => {
  const id = AuthService.getCurrentUser()?.id;
  return AuthService.token && (typeof id === 'string' || typeof id === 'number') ? String(id) : null;
};

export const supporterMascotSync = createSupporterMascotSync({
  content: supporterContent,
  accountId,
  readStore: () => currentHelpSettings().mascotPresets,
  writeStore: (mascotPresets) => changeHelpSettings({ mascotPresets }),
});

/**
 * Keep the Supporter mascots in step with installed Supporter content from now on.
 *
 * @returns The unsubscribe
 */
export const watchSupporterMascots = (): (() => void) => supporterMascotSync.start();
