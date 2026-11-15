import { useMemo, useState, type ReactNode } from 'react';
import { MascotPiece } from '@/components/formaquestion/MascotPiece';
import { Button } from '@/components/ui/button';
import { Meta } from '@/components/ui/typography';
import { composeMascot, DEFAULT_MASCOT_RIG } from '@/lib/formaquestion/mascot';
import type { MascotSize } from '@/lib/formaquestion/mascotMask';
import { cn } from '@/lib/utils';

/** Morphie's drawn height in px; her width follows the base image's aspect. */
const MORPHIE_HEIGHT = 72;

/** The built-in engine card's words: the comparison with the model on the player's own computer. */
export const ENGINE_CARD_COPY = {
  title: 'Want a Bigger Model for This Story?',
  body: 'Your computer runs a small model that fits its memory. Formamorph AI runs a larger one without turning your computer into a space heater, for sharper narration and characters who stay consistent. Your support includes it, and it helps fund new updates.',
};

/** The offer in the story: under the latest narration, above the choices. It never takes focus. AI setup reuses it
 *  with its own words and no Not Now; the Character Mentions offer with its own action and its Show Me control in
 *  Morphie's place. With neither handler, no buttons show. */
export function StoryCard({
  onNotNow, onAction, actionLabel = 'See Levels', ariaLabel = 'Formamorph AI', className, testId = 'story-card',
  media,
  title = 'Want Better Narration for This Story?',
  body = 'Formamorph AI writes sharper narration and keeps characters consistent. Your support includes it, and it helps fund new updates.',
  children,
}: {
  onNotNow?: () => void;
  onAction?: () => void;
  actionLabel?: string;
  ariaLabel?: string;
  className?: string;
  testId?: string;
  title?: string;
  body?: string;
  /** Rows under the body, such as a download bar. */
  children?: ReactNode;
  /** Shown in Morphie's place. */
  media?: ReactNode;
}) {
  const [base, setBase] = useState<MascotSize | null>(null);
  // Always the stock Morphie, whatever Mascot the player picks.
  const images = useMemo(() => composeMascot(DEFAULT_MASCOT_RIG, 'initial', null), []);
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      data-testid={testId}
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center',
        'animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="shrink-0">
          {media ?? (
            <MascotPiece
              images={images}
              size={base && { w: Math.round((MORPHIE_HEIGHT * base.width) / base.height), h: MORPHIE_HEIGHT }}
              onBase={setBase}
            />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-label font-semibold">{title}</div>
          <Meta as="p">{body}</Meta>
          {children}
        </div>
      </div>
      {/* Negative first, so the action sits on the right, and on top below `sm`. */}
      {(onNotNow || onAction) && (
        <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onNotNow && <Button variant="ghost" size="sm" onClick={onNotNow}>Not Now</Button>}
          {onAction && <Button size="sm" onClick={() => onAction()}>{actionLabel}</Button>}
        </div>
      )}
    </div>
  );
}
