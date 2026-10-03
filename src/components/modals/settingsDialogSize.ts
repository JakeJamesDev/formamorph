import { dialogFullHeightMobile } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * The size of the Settings dialog and of the dialogs that match it: 900 pixels wide and 90% of the screen
 * high, and the whole screen on mobile.
 */
export const SETTINGS_DIALOG_SIZE = cn(
  'flex flex-col overflow-hidden sm:max-w-[900px]',
  dialogFullHeightMobile,
  'max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:border-0 sm:h-[90dvh]',
);
