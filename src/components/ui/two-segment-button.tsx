import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tip } from "@/components/ui/tooltip"

export interface ButtonSegment {
  /** The tooltip and the accessible name. */
  label: string
  icon: LucideIcon
  onClick: () => void
}

/** Two related actions as one round pill. Each half is its own button. */
export function TwoSegmentButton({ segments: [start, end] }: { segments: readonly [ButtonSegment, ButtonSegment] }) {
  return (
    <div className="flex h-10 overflow-hidden rounded-full divide-x divide-primary-foreground/25">
      <Tip tip={start.label}>
        <Button onClick={start.onClick} className="flex h-10 w-9 items-center justify-center rounded-none p-0 pl-1">
          <start.icon className="h-5 w-5" />
        </Button>
      </Tip>
      <Tip tip={end.label}>
        <Button onClick={end.onClick} className="flex h-10 w-9 items-center justify-center rounded-none p-0 pr-1">
          <end.icon className="h-5 w-5" />
        </Button>
      </Tip>
    </div>
  )
}
