import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils"
import { attachNumberWheelStep } from "@/lib/numberInputWheel"

// Compactness is a property of the control, not of the type scale: a dense row asks for `size="sm"`
// rather than hand-shrinking with `text-xs h-8`, which reads identically to secondary-text styling.
const inputVariants = cva(
  "flex w-full rounded-md border border-input bg-background px-3 py-2 file:border-0 file:bg-transparent file:text-label file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        default: "h-10 text-label",
        sm: "h-8 text-meta",
      },
    },
    defaultVariants: { size: "default" },
  }
)

// `size` is shadowed deliberately — the native numeric attribute is unused here and the variant name
// matches Button's.
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size, ...props }, ref) => {
    // Own the node so the wheel stepper can bind to it, while still honoring the forwarded ref.
    const inner = React.useRef<HTMLInputElement | null>(null);
    const setRef = React.useCallback((node: HTMLInputElement | null) => {
      inner.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    }, [ref]);

    // Wheel-steps a focused number field the same way at any scroll position (see numberInputWheel).
    React.useEffect(() => {
      if (type !== 'number' || !inner.current) return;
      return attachNumberWheelStep(inner.current);
    }, [type]);

    return (
      <input
        type={type}
        className={cn(inputVariants({ size, className }))}
        ref={setRef}
        {...props} />
    );
  }
)
Input.displayName = "Input"

export { Input }
