/** Sub-tabs on Admin Panel → Moderation. Guarded by `devRouter.test.ts`. */
export const MODERATION_TABS = ['reports', 'review', 'auto'] as const;
export type ModerationTab = (typeof MODERATION_TABS)[number];

/** A count as a tab label carries it: capped at "9+", none at zero. */
export const countLabel = (label: string, count: number): string =>
  (count > 0 ? `${label} (${count > 9 ? '9+' : count})` : label);
