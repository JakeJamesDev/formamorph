import { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, useInternalNode, type EdgeProps } from '@xyflow/react';
import { DEFAULT_CANVAS_CONNECTION_STYLE } from '@/contexts/settingsDefaults';
import { edgeGeometry, isConnectionStyle } from '@/lib/canvasEdgePath';
import { cn } from '@/lib/utils';

/**
 * The arrow itself, shared by the two surfaces that draw one: the author's Locations Canvas and the player's
 * Map. Both read one world through one mapping, so both draw its travel the same way — an author looking at
 * their canvas is looking at what the player will see. What an arrow *says* is `lib/canvasEdges`' answer.
 */

/** Half the gap between a pair's two arrows — each rides to the left of its own direction of travel. */
const ARROW_OFFSET = 5;

/**
 * A border-to-border arrow, drawn one step to the left of the direction it travels: a pair's two directions
 * therefore sit side by side instead of on top of each other, and the map is read by counting arrows.
 *
 * Where it runs and what shape it takes are `lib/canvasEdgePath`'s answers; all this holds is the boxes xyflow
 * measured, so the author's chosen shape and the Group border-anchoring are one testable set of numbers.
 */
export const FloatingEdge = ({ id, source, target, markerEnd, style, label, data, selected }: EdgeProps) => {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const [hovered, setHovered] = useState(false);
  if (!sourceNode || !targetNode) return null;
  const rectOf = (node: NonNullable<typeof sourceNode>) => ({
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width: node.measured.width ?? 0,
    height: node.measured.height ?? 0,
  });
  // xyflow hands edge data back as unknown values; the shape it is holding is `toFlowEdge`'s own.
  const wanted = String(data?.connectionStyle);
  const { path, labelAt } = edgeGeometry(rectOf(sourceNode), rectOf(targetNode), {
    style: isConnectionStyle(wanted) ? wanted : DEFAULT_CANVAS_CONNECTION_STYLE,
    offset: ARROW_OFFSET,
  });
  // Selection expands too, so touch (which never hovers) can still reach the full text by tapping.
  const expanded = hovered || selected;
  return (
    <>
      <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      </g>
      {label && (
        <EdgeLabelRenderer>
          <div
            className={cn(
              'absolute rounded px-1 text-center text-meta text-primary',
              expanded
                ? 'pointer-events-auto z-10 max-w-72 bg-background'
                : 'pointer-events-none line-clamp-2 max-w-44 bg-background/80',
            )}
            style={{ transform: `translate(-50%, -50%) translate(${labelAt.x}px, ${labelAt.y - 10}px)` }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
