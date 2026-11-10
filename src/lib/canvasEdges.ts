import { MarkerType, type Edge } from '@xyflow/react';
import type { ConnectionStyle } from './canvasEdgePath';
import type { CanvasEdge } from './locationCanvas';
import type { RoutineLine } from './canvasRoutine';

const ROUTINE_STROKE: Record<RoutineLine['tone'], string> = {
  stay: 'hsl(var(--routine-stay))',
  wander: 'hsl(var(--routine-wander))',
  patrol: 'hsl(var(--routine-patrol))',
};

/** A movement line of the Routine view: straight, full strength, in its action's color. */
export function routineFlowEdge(line: RoutineLine): Edge {
  const color = ROUTINE_STROKE[line.tone];
  return {
    id: line.id,
    source: line.source,
    target: line.target,
    type: 'floating',
    data: { connectionStyle: 'straight', labelOuter: false, paired: false, tone: line.tone },
    selectable: false,
    focusable: false,
    style: { stroke: color, strokeWidth: 2.5, ...(line.dashed ? { strokeDasharray: '6 5' } : {}) },
    ...(line.arrow ? { markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 } } : {}),
  };
}

/**
 * What one arrow on the map says, as the flow renderer reads it. Pure mapping: the drawing itself is
 * `components/FloatingEdge`, and both surfaces that draw arrows come through here for what they mean.
 */

/**
 * Dashed and muted for free implicit travel, solid and primary-colored for an authored Connection, and
 * dotted for a Far one, drawn heavier so the dots read. The chosen shape rides on the edge itself, so
 * changing it redraws the map through the same path every other edit takes.
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
  const width = implicit ? 1.3 : edge.far ? 3 : 2;
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'floating',
    label: edge.label,
    data: { connectionStyle, labelOuter: !!edge.labelOuter, paired: !!edge.paired },
    selectable: interactive,
    style: {
      stroke: color,
      strokeWidth: selected && !implicit ? width + 1.5 : width,
      ...(interactive ? { cursor: 'pointer' } : {}),
      ...(implicit ? { strokeDasharray: '5 5', opacity: 0.8 } : {}),
      ...(edge.far ? { strokeDasharray: '1 7', strokeLinecap: 'round' as const } : {}),
    },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: implicit ? 14 : 16, height: implicit ? 14 : 16 },
  };
}
