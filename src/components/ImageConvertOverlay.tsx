import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

/**
 * Covers an image slot while its picture is being re-encoded, with the source dimmed behind the bar so it is
 * obvious which picture is being worked on.
 *
 * The bar is only determinate when several images were handed over at once. One image encodes in a single
 * worker call that reports nothing in between, so a percentage there would be invented.
 */
export const ImageConvertOverlay = ({ thumb, done, total, objectFit = 'contain', className }: {
  /** The picture being converted, shown dimmed. Must be an object URL, never the data URL being encoded:
   *  handing an `<img>` a multi-megabyte base64 string costs a long main-thread block, which delayed this
   *  very overlay by ~380ms — long enough that the encode looked like a frozen frame instead. */
  thumb: string;
  /** How many are finished. Ignored when `total` is 1. */
  done: number;
  total: number;
  /** Match the slot's own fit, or the picture jumps to a different crop for the length of the encode. */
  objectFit?: 'contain' | 'cover';
  className?: string;
}) => (
  <div
    className={cn('absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-md bg-overlay/60 p-3', className)}
    role="status"
    aria-live="polite"
    aria-label={total > 1 ? `Converting image ${done + 1} of ${total}` : 'Converting image'}
  >
    <img
      src={thumb}
      alt=""
      className={cn(
        'absolute inset-0 h-full w-full rounded-md opacity-25',
        objectFit === 'cover' ? 'object-cover' : 'object-contain',
      )}
    />
    <div className="relative w-full max-w-[220px]">
      {total > 1 ? (
        <Progress value={(done / total) * 100} className="h-1.5" />
      ) : (
        // No percentage to show, so the bar reads as "working" rather than pretending to a position.
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
          <div className="h-full w-full animate-pulse bg-primary motion-reduce:animate-none" />
        </div>
      )}
      <span className="mt-1 block text-center text-meta text-white drop-shadow">
        {total > 1 ? `Converting ${done + 1} of ${total}…` : 'Converting…'}
      </span>
    </div>
  </div>
);
