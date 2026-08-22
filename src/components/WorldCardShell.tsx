import React, { forwardRef, type ReactNode } from 'react';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';

interface WorldCardShellProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The thumbnail image node (an `img`/`CachedThumbnail`); a `Globe` placeholder fills the area when absent. */
  thumbnail?: ReactNode;
  /** Absolutely-positioned overlay over the thumbnail (e.g. a download button / progress bar). */
  thumbnailOverlay?: ReactNode;
  /** Absolutely-positioned control in the card's top-right corner (hide / delete). */
  cornerAction?: ReactNode;
  name: string;
  description?: string;
  /** The author line — plain text, or an interactive element (e.g. a hide-author span). */
  author?: ReactNode;
  /** A line about the card's subject (e.g. a place badge), between the author and the card's own content. */
  note?: ReactNode;
  /** Surface/border variant classes for the frame (e.g. `bg-background`, the update highlight, `touch-none`). */
  frameClassName?: string;
}

/**
 * The shared visual shell for a world card — frame, thumbnail area (with a `Globe` fallback), title,
 * description, and author — composed by both the local `SortableWorldCard` (detailed layout) and the
 * community `RemoteWorldCard`. Card-specific bits (drag vs. download/hide, counts, tags, footer actions) are
 * passed via slots/`children`, so the shared layout **and its themed colors live in exactly one place.**
 * Forwards a ref + spreads the rest onto the frame so a caller can attach dnd-kit listeners / `onClick`.
 */
export const WorldCardShell = forwardRef<HTMLDivElement, WorldCardShellProps>(function WorldCardShell(
  { thumbnail, thumbnailOverlay, cornerAction, name, description, author, note, frameClassName, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn('relative flex flex-col rounded-lg border cursor-pointer', frameClassName, className)}
      {...rest}
    >
      {cornerAction}
      <div className="relative h-32 bg-muted rounded-t-lg overflow-hidden">
        {thumbnailOverlay}
        {thumbnail ?? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Globe className="h-12 w-12" />
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="font-semibold text-title mb-1">{name}</h3>
        <div className="text-helper text-muted-foreground mb-2 max-h-20 overflow-hidden">
          <MarkdownRenderer text={description || 'No description available.'} />
        </div>
        {author != null && <div className="text-meta text-muted-foreground mb-1">{author}</div>}
        {note}
        {children}
      </div>
    </div>
  );
});
