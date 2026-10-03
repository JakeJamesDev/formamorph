import type { AvatarSize } from '@/components/UserAvatar';

/** The Patreon tiers that carry Supporter Flair. */
export const SUPPORTER_TIERS = ['supporter', 'supporter_plus'] as const;
export type SupporterTier = (typeof SUPPORTER_TIERS)[number];

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
