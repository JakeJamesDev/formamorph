import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import type { BubbleAction } from '@/lib/bubbleActions';
import { openBubbleMenu } from '@/lib/bubbleMenuOpen';
import { BubbleActionButton } from './BubbleMenu';

/**
 * The icon row at the bottom of a Chat narration bubble: the turn number, then the bubble's actions. The
 * More icon opens the bubble's own menu, so the row must sit inside that bubble's `BubbleMenu`.
 */
export function BubbleActionRow({ turnNumber, actions }: { turnNumber: number; actions: BubbleAction[] }) {
  return (
    <div className="mt-2 flex items-center gap-0.5 border-t border-border pt-1.5" data-testid="bubble-actions">
      {/* The article's own label already names the turn for a screen reader. */}
      <span className="mr-auto text-meta text-muted-foreground" aria-hidden>Turn {turnNumber}</span>
      {actions.filter((a) => !a.menuOnly).map((a) => <BubbleActionButton key={a.key} action={a} />)}
      {actions.some((a) => a.menuOnly) && (
        <Tip tip="More">
          <Button
            variant="ghost"
            size="icon"
            aria-label="More"
            aria-haspopup="menu"
            className="h-8 w-8"
            onClick={(event) => openBubbleMenu(event.currentTarget)}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </Tip>
      )}
    </div>
  );
}
