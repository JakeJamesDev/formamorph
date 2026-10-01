import { useState } from 'react';
import { X } from 'lucide-react';
import { ImageZoomViewer } from '@/components/ImageZoomViewer';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ImageAttachment } from '@/types';

/**
 * A row of an action's attached images. A click opens the image viewer on that image; `onRemove` adds a
 * remove button to each one.
 */
export function AttachmentThumbs({ attachments, onRemove, className }: {
  attachments: ImageAttachment[];
  onRemove?: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (attachments.length === 0) return null;
  const shown = open === null ? null : attachments[Math.min(open, attachments.length - 1)];

  return (
    <div className={cn('flex flex-wrap gap-2', className)} data-testid="attachment-thumbs">
      {attachments.map((image, i) => (
        <div key={image.id} className="relative">
          <button
            type="button"
            aria-label={`View attached image ${i + 1}`}
            className="block h-12 w-12 cursor-zoom-in overflow-hidden rounded-md border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            onClick={() => setOpen(i)}
          >
            <img src={image.dataUrl} alt="" className="h-full w-full object-cover" />
          </button>
          {onRemove && (
            <Tip tip="Remove image">
              <button
                type="button"
                aria-label={`Remove attached image ${i + 1}`}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => onRemove(image.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </Tip>
          )}
        </div>
      ))}
      <ImageZoomViewer
        src={shown?.dataUrl ?? ''}
        alt="Attached image"
        open={shown !== null}
        onOpenChange={(next) => { if (!next) setOpen(null); }}
        gallery={{
          count: attachments.length,
          index: open ?? 0,
          onStep: (by) => setOpen((at) => ((at ?? 0) + by + attachments.length) % attachments.length),
        }}
      />
    </div>
  );
}
