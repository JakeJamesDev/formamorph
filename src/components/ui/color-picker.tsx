import * as React from "react"
import { HexColorPicker } from "react-colorful"

import { cn } from "@/lib/utils"
import { useGestureStart } from "@/components/ui/gesture-group"
import { parseHex6 } from "@/lib/hslColor"
import { useMountedRef } from "@/lib/useMountedRef"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

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
  const startGesture = useGestureStart()
  const [draft, setDraft] = React.useState(value)
  React.useEffect(() => setDraft(value), [value])
  const revertDraft = () => setDraft(value)

  const mounted = useMountedRef()
  // The picker paints from `live`; the parent hears at most one change per frame plus a final one on release.
  const [live, setLive] = React.useState(value)
  const pending = React.useRef<string | null>(null)
  const frame = React.useRef<number | null>(null)
  const valueRef = React.useRef(value)
  const onChangeRef = React.useRef(onChange)
  valueRef.current = value
  onChangeRef.current = onChange

  const commit = React.useCallback((hex: string) => {
    if (hex !== valueRef.current) onChangeRef.current(hex)
  }, [])

  const flush = React.useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    const hex = pending.current
    pending.current = null
    if (hex !== null) commit(hex)
  }, [commit])

  const schedule = (hex: string) => {
    setLive(hex)
    pending.current = hex
    frame.current ??= requestAnimationFrame(() => {
      frame.current = null
      if (mounted.current) flush()
    })
  }

  // A parent value that differs from what the picker last sent (reset, hex entry elsewhere) wins.
  React.useEffect(() => {
    if (pending.current === null) setLive(value)
  }, [value])

  // Release ends the drag: send the final color without waiting for the frame. Unmount sends it too.
  const releaseListening = React.useRef(false)
  const onRelease = React.useCallback(() => {
    releaseListening.current = false
    window.removeEventListener("pointerup", onRelease, true)
    window.removeEventListener("pointercancel", onRelease, true)
    flush()
  }, [flush])
  React.useEffect(() => () => {
    window.removeEventListener("pointerup", onRelease, true)
    window.removeEventListener("pointercancel", onRelease, true)
    flush()
  }, [onRelease, flush])
  const onSquarePointerDown = (event: React.PointerEvent) => {
    startGesture(event)
    if (releaseListening.current) return
    releaseListening.current = true
    window.addEventListener("pointerup", onRelease, true)
    window.addEventListener("pointercancel", onRelease, true)
  }

  const onDraftChange = (entry: string) => {
    setDraft(entry)
    const hex = parseHex6(entry)
    if (hex) {
      setLive(hex)
      commit(hex)
    }
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
          // A label replaces the button text in the accessible name, so the value goes in the description.
          aria-describedby={ariaDescribedBy ? `${valueId} ${ariaDescribedBy}` : valueId}
          className="gap-2 px-3 font-mono"
        >
          <span
            data-color-swatch
            aria-hidden
            className="h-5 w-5 shrink-0 rounded-sm border border-border"
            style={{ backgroundColor: live }}
          />
          <span id={valueId}>{live}</span>
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
        {/* A drag across the square or the hue bar is one undo Step. */}
        <div onPointerDown={onSquarePointerDown}>
          <HexColorPicker color={live} onChange={schedule} />
        </div>
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
