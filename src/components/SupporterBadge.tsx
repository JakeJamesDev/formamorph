import { useEffect, useState } from "react";
import { Heart, HeartPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/ui/tooltip";
import { SUPPORTER_BADGE_STYLES, SUPPORTER_LABELS, supporterTenure } from "@/lib/supporterFlair";
import type { SupporterTier } from "@/types";

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
  className?: string;
}

/**
 * A small pill saying somebody supports the project on Patreon.
 *
 * A pill with an icon, where the staff badges are square text tags, so a name never reads as both. Supporter+
 * adds an outline and a second icon; the tiers do not rest on hue alone.
 *
 * The heart beats when the badge first appears for an account, then only on hover and focus (supporter-heart.css).
 * Mounting a badge for a key that already beat stays still, so a scrolled list does not replay it.
 */
export function SupporterBadge({ tier, since, beatKey, className }: SupporterBadgeProps) {
  const Icon = tier === 'supporter_plus' ? HeartPlus : Heart;
  // Read at mount, recorded in an effect: Strict Mode runs both twice and the first mount still beats.
  const [arriving, setArriving] = useState(() => !!beatKey && !prefersReducedMotion() && !arrived.has(beatKey));
  useEffect(() => {
    if (beatKey) arrived.add(beatKey);
  }, [beatKey]);

  const tenure = supporterTenure(since);

  const badge = (
    <span
      className={cn(
        'supporter-badge inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide',
        SUPPORTER_BADGE_STYLES[tier],
        className
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('supporter-heart h-2.5 w-2.5', arriving && 'supporter-heart-arrive')}
        // The class comes off so a later hover starts the same animation again.
        onAnimationEnd={() => setArriving(false)}
      />
      {SUPPORTER_LABELS[tier]}
    </span>
  );

  return tenure ? <Tip tip={`Supporting for ${tenure}`} labelsChild={false}>{badge}</Tip> : badge;
}
