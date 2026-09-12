import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/** The role-named sizes from `tailwind.config.js`. Unknown to tailwind-merge's stock config, which
 *  would file them under text-color — so `cn("text-helper text-muted-foreground")` would drop the
 *  size, and `cn("text-sm", "text-helper")` would emit both and let CSS order decide. */
const FONT_SIZE_ROLES = ["display", "heading", "title", "body", "label", "helper", "meta"] as const

const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: [...FONT_SIZE_ROLES] }] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Escape a string for literal use inside a `RegExp`. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Escape a string for use as XML text/attribute content (`&`, `<`, `>`). */
export function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Map `items`, handing back the original array when `map` returned every item unchanged. Keeping the
 *  reference is what lets a mapper run unconditionally: a pass that changes nothing mints no identity, so
 *  the memos and render paths below it never see a new object. */
export function mapPreservingIdentity<T>(items: readonly T[], map: (item: T) => T): T[] {
  let changed = false
  const out = items.map((item) => {
    const next = map(item)
    if (next !== item) changed = true
    return next
  })
  return changed ? out : (items as T[])
}

/** Clamp `value` into the inclusive `[min, max]` range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Seconds → `m:ss` for audio timers; non-finite input reads as `0:00`. */
export function formatMMSS(s: number): string {
  if (!Number.isFinite(s)) return "0:00"
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}
