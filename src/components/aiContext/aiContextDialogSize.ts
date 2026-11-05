import { dialogFullHeightMobile } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/** The AI Context window's size: 95% of the screen, and the whole screen on mobile. */
export const AI_CONTEXT_DIALOG_SIZE = cn(
  'flex flex-col overflow-hidden sm:max-w-[95vw] sm:w-[95vw] sm:h-[90dvh]',
  dialogFullHeightMobile,
  'max-sm:w-screen max-sm:max-w-none max-sm:rounded-none',
);
