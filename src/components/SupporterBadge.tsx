import { useEffect, useState } from "react";
import { Heart, HeartHandshake, HeartPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/ui/tooltip";
import { SUPPORTER_BADGE_STYLES, supporterTenureTip } from "@/lib/supporterFlair";
import { useTierName } from "@/lib/tierNames";
import type { SupporterTier } from "@/types";

const TIER_ICONS: Record<SupporterTier, typeof Heart> = {
  supporter: Heart,
  supporter_plus: HeartPlus,
  supporter_top: HeartHandshake,
};

/** Keys whose badge already beat on arrival this page load. */
const arrived = new Set<string>();

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface SupporterBadgeProps {
  tier: SupporterTier;
  /** When the pledge started. The tooltip states the tenure; null or absent shows no tooltip. */
  since?: string | null;
  /** The account, for the once-per-page-load arrival beat. Absent means no arrival beat. */
  beatKey?: string | null;
  /** `lg` is the heading size, for a group title. */
  size?: 'sm' | 'lg';
  className?: string;
}

const SIZE_STYLES = {
  sm: { pill: 'gap-1 px-2 py-0.5 text-[10px] leading-[14px]', icon: 'h-2.5 w-2.5' },
  lg: { pill: 'gap-1.5 px-3 py-1 text-label', icon: 'h-3.5 w-3.5' },
} as const;

/**
 * A small pill saying somebody supports the project on Patreon.
 *
 * A pill with an icon, where the staff badges are square text tags, so a name never reads as both. Supporter+
 * adds an outline and a second icon; the tiers do not rest on hue alone.
 *
 * The heart beats when the badge first appears for an account, then only on hover and focus (supporter-heart.css).
 * Mounting a badge for a key that already beat stays still, so a scrolled list does not replay it.
 */
export function SupporterBadge({ tier, since, beatKey, size = 'sm', className }: SupporterBadgeProps) {
  const Icon = TIER_ICONS[tier];
  const tierNameOf = useTierName();
  // Read at mount, recorded in an effect: Strict Mode runs both twice and the first mount still beats.
  const [arriving, setArriving] = useState(() => !!beatKey && !prefersReducedMotion() && !arrived.has(beatKey));
  useEffect(() => {
    if (beatKey) arrived.add(beatKey);
  }, [beatKey]);

  const tenureTip = supporterTenureTip(since);

  const badge = (
    // A tab stop, so a keyboard reaches the tenure tooltip and the beat; it opens nothing, so not a button.
    <span
      tabIndex={0}
      className={cn(
        'supporter-badge inline-flex shrink-0 items-center rounded-full font-semibold tracking-wide',
        SIZE_STYLES[size].pill,
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        SUPPORTER_BADGE_STYLES[tier],
        className
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('supporter-heart', SIZE_STYLES[size].icon, arriving && 'supporter-heart-arrive')}
        // The class comes off so a later hover starts the same animation again.
        onAnimationEnd={() => setArriving(false)}
      />
      {tierNameOf(tier)}
    </span>
  );

  return tenureTip ? <Tip tip={tenureTip} labelsChild={false}>{badge}</Tip> : badge;
}
