import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // resize-y, not the browser's default `both`: dragging a field wider than its column breaks the
          // layout around it, and it matches the chip editors (PromptField's `resizable`). Callers that want
          // a fixed box pass `resize-none`, which wins here.
          "flex min-h-[80px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-label placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props} />
    );
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
