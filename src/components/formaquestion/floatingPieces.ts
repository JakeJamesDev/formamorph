/** The class lists of the floating pieces that the Minimal and Bubble chromes share. */
import { cn } from '@/lib/utils';

/** Every floating piece takes presses and lifts off the app with the same shadow. The gaps belong to the app. */
export const FLOATING = 'pointer-events-auto shadow-md';
export const BUBBLE = cn(FLOATING, 'rounded-2xl px-3 py-2 text-label');
export const ASSISTANT_BUBBLE = cn(BUBBLE, 'mr-6 self-start rounded-bl-sm border bg-popover text-popover-foreground');
/** Older content fades out at the top of a scroller, with no hard edge. */
export const TOP_FADE = '[mask-image:linear-gradient(to_bottom,transparent,black_2rem)]';
export const PILL_BUTTON = 'inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';
