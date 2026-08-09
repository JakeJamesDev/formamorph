import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils"

// A dense field asks for `size="sm"` rather than hand-shrinking with `text-xs`. Only the type shrinks —
// the box grows with its content, so the minimum height stays put.
const textareaVariants = cva(
  // resize-y, not the browser's default `both`: dragging a field wider than its column breaks the
  // layout around it, and it matches the chip editors (PromptField's `resizable`). Callers that want
  // a fixed box pass `resize-none`, which wins here.
  "flex min-h-[80px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: { size: { default: "text-label", sm: "text-meta" } },
    defaultVariants: { size: "default" },
  }
)

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, size, ...props }, ref) => {
    return (
      <textarea
        className={cn(textareaVariants({ size, className }))}
        ref={ref}
        {...props} />
    );
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
