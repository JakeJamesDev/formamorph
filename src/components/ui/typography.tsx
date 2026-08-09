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

type TextProps<E extends React.ElementType> = {
  as?: E
} & VariantProps<typeof textVariants> &
  Omit<React.ComponentPropsWithoutRef<E>, "role">

function makeText<E extends React.ElementType>(
  defaultTag: E,
  role: NonNullable<VariantProps<typeof textVariants>["role"]>,
  displayName: string,
) {
  const Component = ({ as, className, ...props }: TextProps<E>) => {
    const Tag = (as ?? defaultTag) as React.ElementType
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
