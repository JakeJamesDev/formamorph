import type { ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/** The look of a sentence token, for a token button that opens something other than a popover. */
export const SENTENCE_TOKEN_CLASS =
  'rounded px-0.5 font-medium underline decoration-dotted underline-offset-4 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** One part of a sentence: underlined text that opens its own editor. */
export function SentenceToken({ children, editor, label, wide }: { children: ReactNode; editor: ReactNode; label: string; wide?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label} className={SENTENCE_TOKEN_CLASS}>
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn('space-y-2', wide ? 'w-[min(24rem,calc(100vw-2rem))]' : 'w-72')} align="start" collisionPadding={16}>
        {editor}
      </PopoverContent>
    </Popover>
  );
}
