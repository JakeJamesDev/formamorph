import { Heart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUPPORTER_BADGE_STYLES, SUPPORTER_LABELS, type SupporterTier } from "@/lib/supporterFlair";

interface SupporterBadgeProps {
  tier: SupporterTier;
  className?: string;
}

/**
 * A small pill saying somebody supports the project on Patreon.
 *
 * A pill with an icon, where the staff badges are square text tags, so a name never reads as both. Supporter+
 * adds an outline and a second icon; the tiers do not rest on hue alone.
 */
export function SupporterBadge({ tier, className }: SupporterBadgeProps) {
  const Icon = tier === 'supporter_plus' ? Sparkles : Heart;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide',
        SUPPORTER_BADGE_STYLES[tier],
        className
      )}
    >
      <Icon aria-hidden="true" className="h-2.5 w-2.5" />
      {SUPPORTER_LABELS[tier]}
    </span>
  );
}
