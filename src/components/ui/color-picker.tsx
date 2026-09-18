import * as React from "react"
import { HexColorPicker } from "react-colorful"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const HEX_6 = /^#?([0-9a-f]{6})$/i

/** Returns the entry as lowercase `#rrggbb`, or null when it is not a 6-digit hex color. */
function parseHex6(entry: string): string | null {
  const match = HEX_6.exec(entry.trim())
  return match ? `#${match[1].toLowerCase()}` : null
}

export interface ColorPickerProps {
  /** The current color as `#rrggbb`. */
  value: string
  onChange: (hex: string) => void
  /** Shows the reset action when given. */
  onReset?: () => void
  resetLabel?: string
  id?: string
  "aria-label"?: string
  "aria-describedby"?: string
}

/** The app's standard color control: a swatch button that opens a saturation square, a hue bar, and a
 *  hex field. It has no game or settings dependency. */
export function ColorPicker({
  value,
  onChange,
  onReset,
  resetLabel = "Reset",
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: ColorPickerProps) {
  const valueId = React.useId()
  const [draft, setDraft] = React.useState(value)
  React.useEffect(() => setDraft(value), [value])
  const revertDraft = () => setDraft(value)

  const commit = (hex: string) => {
    if (hex !== value) onChange(hex)
  }

  const onDraftChange = (entry: string) => {
    setDraft(entry)
    const hex = parseHex6(entry)
    if (hex) commit(hex)
  }

  return (
    // Modal so the popover owns the scroll lock and touch inside a Dialog, per the popover-in-dialog convention.
    <Popover modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          // A label replaces the button text in the accessible name, so the value rides in the description.
          aria-describedby={ariaDescribedBy ? `${valueId} ${ariaDescribedBy}` : valueId}
          className="gap-2 px-3 font-mono"
        >
          <span
            data-color-swatch
            aria-hidden
            className="h-5 w-5 shrink-0 rounded-sm border border-border"
            style={{ backgroundColor: value }}
          />
          <span id={valueId}>{value}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "w-auto space-y-3 p-3",
          "[&_.react-colorful]:w-56 [&_.react-colorful]:h-48",
          // react-colorful's square and hue bar are its two `role=slider` elements.
          "[&_[role=slider]:focus-visible]:ring-2 [&_[role=slider]:focus-visible]:ring-ring [&_[role=slider]:focus-visible]:ring-inset",
        )}
      >
        <HexColorPicker color={value} onChange={commit} />
        <div className="flex items-center gap-2">
          <Input
            aria-label="Hex Color"
            value={draft}
            spellCheck={false}
            className="h-9 w-28 font-mono"
            onChange={(event) => onDraftChange(event.target.value)}
            onBlur={revertDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") revertDraft()
            }}
          />
          {onReset && (
            <Button type="button" variant="ghost" size="sm" onClick={onReset}>
              {resetLabel}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
