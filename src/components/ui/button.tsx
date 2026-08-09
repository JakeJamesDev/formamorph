import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // `border border-transparent` in the base reserves a 1px border on every variant (no layout shift) that
  // themes color via `--border`; it's faint in the color themes and maximal in High Contrast. Filled
  // variants keep it transparent; secondary/ghost opt into `border-border` so they're outlined too.
  "inline-flex items-center justify-center whitespace-nowrap rounded-md border border-transparent text-label font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Filled variants re-color the inset focus ring to their own foreground: `--ring` is tuned to
        // contrast with the page, not with a filled control, and inside one it drops to ~1.8:1 in dark.
        default: "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary-foreground",
        destructive:
          "bg-destructive-fill text-destructive-foreground hover:bg-destructive-fill/90 focus-visible:ring-destructive-foreground",
        outline:
          "border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80",
        ghost: "border-border hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        // The rung dense rows were reaching for by hand as `text-xs h-8`.
        xs: "h-8 rounded-md px-2 text-meta",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props} />
    );
  }
)
Button.displayName = "Button"

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants }
