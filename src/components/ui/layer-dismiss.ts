import * as React from "react"

import { ignoreLayerDismiss } from "@/components/ui/shielded-layer"

/**
 * Lets a popup below the shielded layer ignore presses and Escape from it. Returns the content's ref, merged
 * with the forwarded one, and a wrapper for each dismiss handler.
 */
export function useLayerDismiss<T extends Element>(forwardedRef: React.ForwardedRef<T>) {
  const content = React.useRef<T | null>(null)
  const ref = React.useCallback((node: T | null) => {
    content.current = node
    if (typeof forwardedRef === "function") forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }, [forwardedRef])
  const guard = React.useCallback(
    <E extends Event>(handler?: (event: E) => void) => ignoreLayerDismiss(handler, content),
    [],
  )
  return [ref, guard] as const
}
