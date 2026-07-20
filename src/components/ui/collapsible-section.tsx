import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

/**
 * A borderless titled section that collapses. The whole header row toggles; an up/down chevron shows state.
 * Title sits at label weight so a section reads consistently with the surrounding labeled-block fields.
 * `icon` is an optional leading glyph; `contentClassName` styles the revealed body (defaults to a small stack).
 */
export function CollapsibleSection({
  title,
  icon,
  open,
  onOpenChange,
  children,
  contentClassName = "space-y-2 mt-2",
}: {
  title: ReactNode;
  icon?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            {icon}
            {title}
          </span>
          <Button asChild variant="ghost" size="sm" tabIndex={-1}>
            <span>
              {open ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </span>
          </Button>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className={contentClassName}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
