import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/** The untemplated half of the app's text: hints, empty states, inline errors, counts, section
 *  headers. One table so every secondary-text role is readable side by side. */
const textVariants = cva("", {
  variants: {
    role: {
      hint: "text-helper text-muted-foreground",
      error: "text-helper text-destructive",
      section: "text-label font-medium",
      meta: "text-meta text-muted-foreground",
    },
  },
  defaultVariants: { role: "hint" },
})

/** `as` swaps the tag without restating the styling — a hint sitting inline beside a checkbox wants a
 *  `span`, the same hint under a field wants the default `p`. */
type TextProps = React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }

function makeText(
  defaultTag: React.ElementType,
  role: NonNullable<VariantProps<typeof textVariants>["role"]>,
  displayName: string,
) {
  const Component = ({ as, className, ...props }: TextProps) => {
    const Tag = as ?? defaultTag
    return <Tag className={cn(textVariants({ role }), className)} {...props} />
  }
  Component.displayName = displayName
  return Component
}

/** Secondary explanatory text beneath a control or heading. */
const Hint = makeText("p", "hint", "Hint")
/** A validation message tied to the field above it. */
const FieldError = makeText("p", "error", "FieldError")
/** The header of a group of controls inside a panel or modal. */
const SectionTitle = makeText("h3", "section", "SectionTitle")
/** Incidental data — counts, timestamps, keyboard hints. */
const Meta = makeText("span", "meta", "Meta")

// eslint-disable-next-line react-refresh/only-export-components
export { Hint, FieldError, SectionTitle, Meta, textVariants }
