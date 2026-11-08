import { Gem } from "lucide-react";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MARK_CHIP_CLASS } from "@/components/community/PinnedMark";

/** The chip on a listing that sits in a Hidden Gem slot. */
export function HiddenGemMark({ className }: { className?: string }) {
  return (
    <Tip tip="Gets many likes for how few players have downloaded it" labelsChild={false}>
      <span className={cn(MARK_CHIP_CLASS, className)}>
        <span className="gem-sparkle shrink-0" aria-hidden>
          <Gem className="h-3 w-3" />
        </span>
        Hidden Gem
      </span>
    </Tip>
  );
}
