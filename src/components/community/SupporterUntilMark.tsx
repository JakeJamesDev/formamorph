import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { MARK_CHIP_CLASS } from "@/components/community/PinnedMark";
import { supporterEndLabel } from "@/lib/supporterEndDate";

interface SupporterUntilMarkProps {
  listing: { supporter_only?: unknown; supporter_until?: unknown };
  className?: string;
}

/** The chip that says when a Supporter-only listing opens to everyone. Renders nothing for any other listing. */
export function SupporterUntilMark({ listing, className }: SupporterUntilMarkProps) {
  const label = supporterEndLabel(listing);
  if (!label) return null;

  return (
    <span className={cn(MARK_CHIP_CLASS, className)}>
      <CalendarClock className="h-3 w-3 shrink-0" aria-hidden /> {label}
    </span>
  );
}
