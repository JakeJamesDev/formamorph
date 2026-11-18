import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { MARK_CHIP_CLASS } from "@/components/community/PinnedMark";
import { supporterEndLabel } from "@/lib/supporterEndDate";
import { scheduleStages } from "@/lib/supporterSchedule";
import { useTierName } from "@/lib/tierNames";

interface SupporterUntilMarkProps {
  listing: { supporter_only?: unknown; supporter_until?: unknown; supporterSchedule?: unknown };
  className?: string;
}

/** The chip that says when a Supporter-only listing opens to each tier and to everyone. Renders nothing for any other listing. */
export function SupporterUntilMark({ listing, className }: SupporterUntilMarkProps) {
  useTierName(); // Re-renders when the server's tier names arrive.
  const stages = scheduleStages(listing);
  const label = stages.length === 0 ? supporterEndLabel(listing) : null;
  if (stages.length === 0 && !label) return null;

  return (
    <span className={cn(MARK_CHIP_CLASS, stages.length > 0 && 'items-start', className)}>
      <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />
      {stages.length > 0 ? (
        <span className="flex flex-col">
          {stages.map((stage) => (
            <span key={stage.key}>{stage.name}: {stage.when}</span>
          ))}
        </span>
      ) : label}
    </span>
  );
}
