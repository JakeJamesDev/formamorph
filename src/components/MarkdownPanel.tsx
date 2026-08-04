import { forwardRef } from 'react';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

/**
 * Rendered markdown on an inset, field-like surface: bordered and tinted so the text reads as its own
 * panel rather than floating on the dialog's background, and still selectable for copy/paste.
 *
 * Shared by the changelog box, the world Readme, and the help pop-outs. Callers own the height cap
 * (`className`) since each surface sits in a different container. `ref` lands on the content div, for
 * callers that post-process the rendered markup.
 */
export const MarkdownPanel = forwardRef<HTMLDivElement, {
  text?: string;
  /** Shown when `text` is empty. */
  placeholder?: string;
  className?: string;
}>(function MarkdownPanel({ text, placeholder, className }, ref) {
  return (
    <ScrollArea className={cn('rounded-md border bg-muted/30 text-sm', className)}>
      <div ref={ref} className="p-3 [&_:first-child]:mt-0">
        {text
          // Keyed by content: Streamdown memoizes on source position, so replacing the text in place
          // keeps any same-span node's old render (same fix as the narration key in GamePanels).
          ? <MarkdownRenderer key={text} text={text} />
          : placeholder
            ? <span className="text-muted-foreground">{placeholder}</span>
            : null}
      </div>
    </ScrollArea>
  );
});
