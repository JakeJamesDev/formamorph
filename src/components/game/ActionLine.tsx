import type { BubbleAction } from '@/lib/bubbleActions';
import { BubbleMenu } from './BubbleMenu';
import { MarkdownRenderer } from './MarkdownRenderer';

/**
 * The player's action on a Pages turn, with its own menu. It is upright, so the player's own italics and quote
 * styling show.
 */
export function ActionLine({ text, actions }: { text: string; actions: BubbleAction[] }) {
  return (
    <BubbleMenu actions={actions}>
      {/* The line has its own menu: a right-click here never reaches the card's. */}
      <div
        data-testid="action-line"
        className="mb-3 border-l-2 border-primary pl-3 text-label text-muted-foreground"
        onContextMenu={(event) => event.stopPropagation()}
      >
        <MarkdownRenderer text={text} dialogue />
      </div>
    </BubbleMenu>
  );
}
