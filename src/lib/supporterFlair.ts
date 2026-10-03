import type { AvatarSize } from '@/components/UserAvatar';
import { parseServerDate } from '@/lib/serverDate';
import type { SupporterTier } from '@/types';

/** Every tier, in display order. */
export const SUPPORTER_TIERS: readonly SupporterTier[] = ['supporter', 'supporter_plus'];

/** The tier to draw, or null. An absent field, a null, and a tier this build doesn't know all mean no flair. */
export const flairTier = (supporter: { tier: string } | null | undefined): SupporterTier | null =>
  supporter && (SUPPORTER_TIERS as readonly string[]).includes(supporter.tier) ? (supporter.tier as SupporterTier) : null;

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

/**
 * How long a pledge has run: whole months under a year, then years and months. Null when `since` is null
 * or unreadable. A future date counts as 0 months.
 */
export function supporterTenure(since: string | null | undefined, now: Date = new Date()): string | null {
  const start = since ? parseServerDate(since) : null;
  if (!start) return null;

  let months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  months = Math.max(0, months);

  if (months < 12) return plural(months, 'month');
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? plural(years, 'year') : `${plural(years, 'year')}, ${plural(rest, 'month')}`;
}

export const SUPPORTER_LABELS: Record<SupporterTier, string> = {
  supporter: 'Supporter',
  supporter_plus: 'Supporter+',
};

/** Name color per tier. */
export const SUPPORTER_NAME_STYLES: Record<SupporterTier, string> = {
  supporter: 'text-supporter',
  supporter_plus: 'text-supporter-plus',
};

/** Badge per tier. Supporter+ adds an outline, so the tiers differ by shape as well as by hue. */
export const SUPPORTER_BADGE_STYLES: Record<SupporterTier, string> = {
  supporter: 'bg-supporter/10 text-supporter',
  supporter_plus: 'bg-supporter-plus/15 text-supporter-plus ring-1 ring-inset ring-supporter-plus/60',
};

const RING_COLORS: Record<SupporterTier, string> = {
  supporter: 'ring-supporter',
  supporter_plus: 'ring-supporter-plus',
};

/** Ring width and gap per Profile Image size: small images take a thin ring so it does not crowd the face. */
const RING_WIDTHS: Record<AvatarSize, string> = {
  xs: 'ring-1 ring-offset-1',
  sm: 'ring-1 ring-offset-1',
  md: 'ring-2 ring-offset-2',
  lg: 'ring-2 ring-offset-2',
  xl: 'ring-[3px] ring-offset-2',
};

/** Classes that draw the tier ring around a Profile Image of this size. */
export const supporterRing = (tier: SupporterTier, size: AvatarSize): string =>
  `${RING_WIDTHS[size]} ring-offset-background ${RING_COLORS[tier]}`;
