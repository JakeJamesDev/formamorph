import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPinned, type PinnableListing } from "@/lib/pinning";

interface PinnedMarkProps {
  listing: PinnableListing;
  className?: string;
}

/** The chip that says staff pinned a listing. Renders nothing for any other listing. */
export function PinnedMark({ listing, className }: PinnedMarkProps) {
  if (!isPinned(listing)) return null;

  return (
    <span className={cn("inline-flex w-fit items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-meta font-medium text-primary", className)}>
      <Pin className="h-3 w-3 shrink-0" aria-hidden /> Pinned
    </span>
  );
}
