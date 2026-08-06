import * as React from "react"

import { cn } from "@/lib/utils"
import { attachNumberWheelStep } from "@/lib/numberInputWheel"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
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
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={setRef}
        {...props} />
    );
  }
)
Input.displayName = "Input"

export { Input }
