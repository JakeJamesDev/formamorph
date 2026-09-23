import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { CardTags, type WorldRecord } from "@/components/WorldDetails";
import { OverlayTitle, TITLE_SCRIM, WorldCardShell } from "@/components/WorldCardShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/tooltip";
import { THUMB_FRAME, thumbFit, type ThumbAspect } from "@/lib/thumbAspect";

export interface WorldCardFaceOwnProps {
  world: WorldRecord;
  onSelect?: (id: string) => void;
  layout: 'grid' | 'detailed';
  aspect?: ThumbAspect;
  badge?: React.ReactNode;
  note?: React.ReactNode;
  /** Fill the tile the grid hands it, instead of taking its height from `aspect`. */
  fill?: boolean;
  /** Trade the name strip for a tooltip, so the smallest tile is thumbnail and nothing else. */
  compact?: boolean;
  /** Draw this tile's own shape with its content still loading: shimmer where the card's parts go. */
  loading?: boolean;
}

/** The face sets its own class and click, so a frame prop may not carry either. */
export type WorldCardFaceProps = WorldCardFaceOwnProps
  & Omit<React.HTMLAttributes<HTMLDivElement>, keyof WorldCardFaceOwnProps | 'className' | 'onClick'>;

/** A local world's card as the library shows it, from the world record alone. `detailed` mirrors the
 *  community-browser card layout. `aspect='portrait'` gives the grid image a tall 2:3 frame (for character
 *  portraits) instead of the short landscape default. Omit `onSelect` for a card with nothing to open — it
 *  drops the pointer cursor too, so the tile doesn't advertise a click it won't answer. `badge` overlays the
 *  grid thumbnail's top-left, and `note` is the same thing said as a line in the detailed layout, which has
 *  no thumbnail to overlay. The remaining props go to the frame, which is where a board attaches its drag. */
export const WorldCardFace = forwardRef<HTMLDivElement, WorldCardFaceProps>(function WorldCardFace(
  { world, onSelect, layout, aspect = 'landscape', badge, note, fill, compact, loading, ...frame },
  ref,
) {
  const select = loading ? undefined : onSelect;

  // Detailed layout: the shared card shell (thumbnail on top, info beneath).
  if (layout === 'detailed') {
    return (
      <WorldCardShell
        ref={ref}
        {...frame}
        // content-visibility:auto lets the browser skip layout/paint for off-screen cards; the auto
        // intrinsic-size reserves space (remembered after first paint) so scrolling stays stable.
        frameClassName="h-full bg-card touch-pan-y [content-visibility:auto] [contain-intrinsic-size:auto_360px]"
        onClick={() => select?.(world.id)}
        loading={loading}
        name={world.name}
        description={world.description}
        // Omitted rather than "By Unknown" when there is none: a character or a book in your own library
        // has no byline to print, and the shell drops the line entirely when it gets nothing.
        author={world.author ? `By ${world.author}` : undefined}
        note={note}
        thumbnail={world.thumbnail
          ? (
            <img
              src={world.thumbnail}
              alt={world.name}
              className={cn('w-full h-full select-none pointer-events-none', thumbFit(aspect))}
            />
          )
          : undefined}
      >
        <div className="mt-auto" onClick={(e) => e.stopPropagation()}>
          <CardTags tags={world.tags || []} />
        </div>
      </WorldCardShell>
    );
  }

  // A filled tile takes its box from the grid, so the height hints that size an auto tile are dropped
  // along with the intrinsic-size reservation they exist to feed.
  const frameSize = fill
    ? 'h-full w-full'
    : cn(
      'touch-pan-y [content-visibility:auto]',
      aspect === 'portrait' ? '[contain-intrinsic-size:auto_360px]' : '[contain-intrinsic-size:auto_240px]',
    );
  const mediaSize = fill
    ? 'h-full w-full'
    : cn('w-full', THUMB_FRAME[aspect]);

  const tile = (
    <div
      ref={ref}
      {...frame}
      // content-visibility:auto skips layout/paint for off-screen tiles; the auto intrinsic-size reserves
      // their height (remembered after first paint) so the scroll frame doesn't jump. The reservation is
      // per-aspect: a 2:3 portrait stands about half again as tall as the landscape tile, and a single
      // figure for both would misreserve one of them on first paint.
      className={cn(
        'group relative rounded-lg overflow-hidden transition-opacity touch-pan-y',
        frameSize,
        select && 'cursor-pointer hover:opacity-90',
      )}
      onClick={() => select?.(world.id)}
    >
      {loading ? (
        <Skeleton className={cn(mediaSize, 'rounded-none')} />
      ) : world.thumbnail ? (
        <img
          src={world.thumbnail}
          alt={world.name}
          className={cn('select-none pointer-events-none', mediaSize, thumbFit(aspect))}
        />
      ) : (
        <div className={cn(mediaSize, 'bg-muted')} />
      )}
      {badge && <div className="absolute top-1 left-1 z-10 max-w-[calc(100%-0.5rem)]">{badge}</div>}
      {!compact && (
        <div className={cn('absolute bottom-0 left-0 right-0 p-2 pt-8', TITLE_SCRIM)}>
          {loading
            ? <Skeleton className="h-6 w-2/5 bg-white/20" />
            : <OverlayTitle name={world.name} />}
        </div>
      )}
    </div>
  );

  // A small tile has no room for the name strip, so the name is a tip instead. `labelsChild` is off:
  // the tile is not a control.
  return compact && !loading ? <Tip tip={world.name} labelsChild={false}>{tile}</Tip> : tile;
});
