import type { BubbleAction } from '@/lib/bubbleActions';
import type { ImageAttachment } from '@/types';
import { AttachmentThumbs } from './AttachmentThumbs';
import { BubbleMenu } from './BubbleMenu';
import { MarkdownRenderer } from './MarkdownRenderer';

/**
 * The player's action on a Pages turn, with its own menu and the images it carried. It is upright, so the
 * player's own italics and quote styling show.
 */
export function ActionLine({ text, actions, images = [] }: { text: string; actions: BubbleAction[]; images?: ImageAttachment[] }) {
  return (
    <BubbleMenu actions={actions}>
      {/* The line has its own menu: a right-click here never reaches the card's. */}
      <div
        data-testid="action-line"
        className="mb-3 border-l-2 border-primary pl-3 text-label text-muted-foreground"
        onContextMenu={(event) => event.stopPropagation()}
      >
        <MarkdownRenderer text={text} dialogue />
        <AttachmentThumbs images={images} className="mt-2" />
      </div>
    </BubbleMenu>
  );
}
