import { MarkerType, type Edge } from '@xyflow/react';
import type { ConnectionStyle } from './canvasEdgePath';
import type { CanvasEdge } from './locationCanvas';

/**
 * What one arrow on the map says, as the flow renderer reads it. Pure mapping: the drawing itself is
 * `components/FloatingEdge`, and both surfaces that draw arrows come through here for what they mean.
 */

/**
 * Dashed and muted for free implicit travel, solid and primary-colored for an authored Connection. The chosen
 * shape rides on the edge itself, so changing it redraws the map through the same path every other edit takes.
 *
 * `selected` thickens the arrow whose record is open, and `interactive` is what says an arrow answers a click
 * at all — the player's Map draws the same travel structure as something to read rather than to edit.
 */
export function toFlowEdge(
  edge: CanvasEdge,
  connectionStyle: ConnectionStyle,
  { selected = false, interactive = true }: { selected?: boolean; interactive?: boolean } = {},
): Edge {
  const implicit = edge.kind === 'implicit';
  const color = implicit ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))';
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'floating',
    label: edge.label,
    data: { connectionStyle },
    selectable: interactive,
    style: {
      stroke: color,
      strokeWidth: implicit ? 1.3 : selected ? 3.5 : 2,
      ...(interactive ? { cursor: 'pointer' } : {}),
      ...(implicit ? { strokeDasharray: '5 5', opacity: 0.8 } : {}),
    },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: implicit ? 14 : 16, height: implicit ? 14 : 16 },
  };
}
