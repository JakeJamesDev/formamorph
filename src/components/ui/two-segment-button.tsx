import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface ButtonSegment {
  /** The tooltip and the accessible name. */
  label: string
  icon: LucideIcon
  onClick: () => void
}

/** Two related actions as one round pill. Each half is its own button. */
export function TwoSegmentButton({ segments }: { segments: readonly [ButtonSegment, ButtonSegment] }) {
  return (
    <div className="flex h-10 overflow-hidden rounded-full divide-x divide-primary-foreground/25">
      {segments.map((segment, i) => (
        <Tip key={segment.label} tip={segment.label}>
          {/* Each icon shifts toward the pill's outer edge, off its rounded end. */}
          <Button onClick={segment.onClick} className={cn("flex h-10 w-9 items-center justify-center rounded-none p-0", i === 0 ? "pl-1" : "pr-1")}>
            <segment.icon className="h-5 w-5" />
          </Button>
        </Tip>
      ))}
    </div>
  )
}
