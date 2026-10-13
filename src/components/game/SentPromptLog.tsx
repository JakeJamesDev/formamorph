import { useState } from 'react';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tip } from '@/components/ui/tooltip';
import { clearSentPrompts, formatSentAt, useSentPrompts } from '@/lib/sentPromptLog';

/**
 * The button in the action box's corner, shown while the box is open, that lists every action sent, newest first. Picking one puts it back in the box, so
 * text from a turn whose request failed is not lost.
 */
export function SentPromptLog({ visible, onPick }: {
  /** Whether the button shows; an open list stays up regardless, since opening it moves focus into it. */
  visible: boolean;
  onPick: (text: string) => void;
}) {
  const prompts = useSentPrompts();
  const [open, setOpen] = useState(false);
  if (prompts.length === 0 || (!visible && !open)) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tip tip="Sent prompts">
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Sent prompts"
            // Pressing it must not blur the action box first, or the button would vanish before the click lands.
            onMouseDown={(e) => e.preventDefault()}
          >
            <History className="h-4 w-4" aria-hidden />
          </Button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent side="top" align="end" className="w-96 max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-label font-medium">Sent prompts</span>
          <Button variant="ghost" size="sm" className="h-7" onClick={() => { clearSentPrompts(); setOpen(false); }}>
            Clear
          </Button>
        </div>
        <ul className="max-h-80 overflow-y-auto py-1" data-testid="sent-prompts">
          {prompts.map((prompt) => (
            <li key={`${prompt.at}:${prompt.text}`}>
              <button
                type="button"
                className="flex w-full gap-2 px-3 py-1.5 text-left text-label hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                onClick={() => { onPick(prompt.text); setOpen(false); }}
              >
                <span className="shrink-0 text-meta text-muted-foreground tabular-nums">{formatSentAt(prompt.at)}</span>
                <span className="line-clamp-3 whitespace-pre-wrap break-words">{prompt.text}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t px-3 py-1.5 text-meta text-muted-foreground">Click one to put it back in the box.</p>
      </PopoverContent>
    </Popover>
  );
}
// scroll-guard: allow popover-list: popover-hosted; dialog scroll lock can intercept wheel input
