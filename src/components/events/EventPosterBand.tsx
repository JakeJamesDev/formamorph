import { Calendar, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import WorldStorageService from '@/services/WorldStorageService';
import { serverAssetSrc } from '@/lib/serverAssets';
import { formatServerDate } from '@/lib/serverDate';
import { posterBand, type PosterStyleSource } from '@/lib/posterStyle';
import { cn } from '@/lib/utils';

/** The band needs only an event's window and its styling — a draft being written has both. */
export interface BandEvent extends PosterStyleSource {
  startsAt: string;
  endsAt: string;
}

interface EventPosterBandProps {
  event: BandEvent;
  /** The mark for what this is: a megaphone for an opening, a trophy for a conclusion. */
  icon: LucideIcon;
  /** The small line above the title, naming what the reader is being shown. */
  eyebrow: string;
  /** The title element — a `DialogTitle` wherever this band heads a dialog. */
  title: ReactNode;
  className?: string;
}

/**
 * The header an event is presented under, wherever it is read.
 *
 * One band rather than one per surface: the poster and the rules dialog are the same event seen twice,
 * and an organizer who gives their contest a color expects both to carry it. The form's preview renders
 * this same component, so what an admin composes is literally what players are shown.
 *
 * Unstyled events keep the app's info blue in both themes, which is why the default is token classes
 * rather than a color computed here.
 */
export function EventPosterBand({ event, icon: Icon, eyebrow, title, className }: EventPosterBandProps) {
  const band = posterBand(event, (path) => serverAssetSrc(path, WorldStorageService.API_URL));
  const starts = formatServerDate(event.startsAt);
  const ends = formatServerDate(event.endsAt);

  return (
    <div
      className={cn(
        'relative isolate flex flex-col items-center gap-2 px-6 pt-8 pb-5 text-center',
        !band.foreground && 'bg-info text-info-foreground',
        className,
      )}
      // The text color is applied whenever anything was styled, not only alongside a color: artwork with
      // no color still needs light text, and inheriting the panel's would put dark text on a dark scrim.
      style={band.foreground
        ? { backgroundColor: band.color ?? undefined, color: band.foreground }
        : undefined}
    >
      {band.imageUrl && (
        <>
          {/* Artwork and its wash are backgrounds rather than an `img`: the band is decoration behind the
              title, and an image element here would be one more thing a screen reader stops on. */}
          <div
            className="absolute inset-0 -z-10 bg-cover bg-center"
            style={{ backgroundImage: `url("${band.imageUrl}")` }}
            aria-hidden
            data-testid="poster-band-image"
          />
          <div className="absolute inset-0 -z-10" style={{ backgroundColor: band.scrim ?? undefined }} aria-hidden />
        </>
      )}

      <Icon className="h-10 w-10" aria-hidden />
      <div className="text-meta font-semibold uppercase tracking-wider">{eyebrow}</div>
      {title}
      {/* Only once there is a window to name. A draft being previewed has none yet, and a pill reading
          just its dash looks like a date that failed to load rather than one nobody has set. */}
      {starts && ends && (
        <span
          className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-meta', !band.pill && 'bg-info-foreground/15')}
          style={band.pill ? { backgroundColor: band.pill } : undefined}
        >
          <Calendar className="h-3 w-3" aria-hidden />
          {starts} – {ends}
        </span>
      )}
    </div>
  );
}
