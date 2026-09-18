import { useState } from 'react';
import { Loader2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { BubbleAction } from '@/lib/bubbleActions';

function ActionIcon({ action }: { action: BubbleAction }) {
  const Icon = action.spinning ? Loader2 : action.icon;
  return <Icon className={cn('h-4 w-4', action.spinning && 'animate-spin')} aria-hidden />;
}

/** The icon row at the bottom of a Chat narration bubble: the turn number, then the bubble's actions. */
export function BubbleActionRow({ turnNumber, actions }: { turnNumber: number; actions: BubbleAction[] }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const more = actions.filter((a) => a.menuOnly);
  return (
    <div className="mt-2 flex items-center gap-0.5 border-t border-border pt-1.5" data-testid="bubble-actions">
      {/* The article's own label already names the turn for a screen reader. */}
      <span className="mr-auto text-meta text-muted-foreground" aria-hidden>Turn {turnNumber}</span>
      {actions.filter((a) => !a.menuOnly).map((a) => (
        <Tip key={a.key} tip={a.label}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={a.label}
            disabled={a.disabled}
            onClick={a.run}
            className={cn('h-8 w-8', a.section === 'destructive' && 'text-destructive hover:text-destructive')}
          >
            <ActionIcon action={a} />
          </Button>
        </Tip>
      ))}
      {more.length > 0 && (
        <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <Tip tip="More">
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </PopoverTrigger>
          </Tip>
          <PopoverContent align="end" className="w-52 p-1">
            <div className="flex flex-col">
              {more.map((a) => (
                <Button
                  key={a.key}
                  variant="ghost"
                  className="h-8 justify-start gap-2 text-meta"
                  disabled={a.disabled}
                  onClick={() => { setMoreOpen(false); a.run(); }}
                >
                  <ActionIcon action={a} />
                  {a.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
