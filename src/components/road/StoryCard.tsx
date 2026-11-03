import { useMemo, useState } from 'react';
import { MascotPiece } from '@/components/formaquestion/MascotPiece';
import { Button } from '@/components/ui/button';
import { Meta } from '@/components/ui/typography';
import { composeMascot, DEFAULT_MASCOT_RIG } from '@/lib/formaquestion/mascot';
import type { MascotSize } from '@/lib/formaquestion/mascotMask';
import { cn } from '@/lib/utils';

/** Morphie's drawn height in px; her width follows the base image's aspect. */
const MORPHIE_HEIGHT = 72;

/** The offer in the story: under the latest narration, above the choices. It never takes focus. AI setup reuses it
 *  with its own words and no Not Now. */
export function StoryCard({
  onNotNow, onSeeLevels, className, testId = 'story-card',
  title = 'Want the AI to Keep More of This Story in Mind?',
  body = 'Formamorph AI is a stronger AI, and your support includes it.',
}: {
  onNotNow?: () => void;
  onSeeLevels: () => void;
  className?: string;
  testId?: string;
  title?: string;
  body?: string;
}) {
  const [base, setBase] = useState<MascotSize | null>(null);
  // Always the stock Morphie, whatever Mascot the player picks.
  const images = useMemo(() => composeMascot(DEFAULT_MASCOT_RIG, 'initial', null), []);
  return (
    <div
      role="group"
      aria-label="Formamorph AI"
      data-testid={testId}
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center',
        'animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="shrink-0">
          <MascotPiece
            images={images}
            size={base && { w: Math.round((MORPHIE_HEIGHT * base.width) / base.height), h: MORPHIE_HEIGHT }}
            onBase={setBase}
          />
        </div>
        <div className="min-w-0">
          <div className="text-label font-semibold">{title}</div>
          <Meta as="p">{body}</Meta>
        </div>
      </div>
      {/* Negative first, so See Levels sits on the right. */}
      <div className="flex shrink-0 justify-end gap-2">
        {onNotNow && <Button variant="ghost" size="sm" onClick={onNotNow}>Not Now</Button>}
        <Button size="sm" onClick={onSeeLevels}>See Levels</Button>
      </div>
    </div>
  );
}
