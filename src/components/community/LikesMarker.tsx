import { Flag } from "lucide-react";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { describeLikesMarker } from "@/lib/likesMarker";
import type { LikesMarkerReason } from "@/types";

interface LikesMarkerProps {
  reasons: readonly LikesMarkerReason[];
  /** Opens the likes audit for the listing. */
  onOpen: () => void;
  className?: string;
}

/** Staff-only button that names why a listing's likes look inflated. The caller decides who sees it. */
export function LikesMarker({ reasons, onOpen, className }: LikesMarkerProps) {
  if (reasons.length === 0) return null;
  const reason = describeLikesMarker(reasons);

  return (
    <Tip tip="Audit the likes" labelsChild={false}>
      <button
        type="button"
        data-likes-marker={reasons.join(' ')}
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        aria-label={`${reason}. Audit the likes`}
        className={cn(
          "flex w-full items-start gap-1 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-left text-meta font-medium hover:bg-warning/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          className,
        )}
      >
        <Flag className="mt-0.5 h-3 w-3 shrink-0 text-warning" aria-hidden />
        <span>{reason}</span>
      </button>
    </Tip>
  );
}
