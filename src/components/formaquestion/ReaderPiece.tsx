import { X } from 'lucide-react';
import { Tip } from '@/components/ui/tooltip';
import type { Guide } from '@/lib/formaquestion/guide';
import { READER_GAP } from '@/lib/formaquestion/windowBox';
import { Reader } from './GuideParts';

/**
 * The guide reader as its own floating piece, right of the chat column in the minimal chrome. It closes on
 * its own; the column and the Mascot stay.
 */
export function ReaderPiece({ guide, sectionId, size, onOpen, onClose }: {
  guide: Guide;
  sectionId: string;
  size: { w: number; h: number };
  /** Opens another section in this reader, from a link or the page's section list. */
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <section
      aria-label="Guide Reader"
      data-fq-piece="reader"
      className="pointer-events-auto flex shrink-0 flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-md"
      style={{ width: size.w, height: size.h, marginLeft: READER_GAP }}
    >
      <div className="flex shrink-0 items-center justify-end border-b p-0.5">
        <Tip tip="Close Reader">
          <button
            type="button"
            aria-label="Close Reader"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </Tip>
      </div>
      <Reader guide={guide} sectionId={sectionId} onOpen={onOpen} />
    </section>
  );
}
