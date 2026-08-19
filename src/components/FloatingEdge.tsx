import { BaseEdge, EdgeLabelRenderer, useInternalNode, type EdgeProps } from '@xyflow/react';
import { DEFAULT_CANVAS_CONNECTION_STYLE } from '@/contexts/settingsDefaults';
import { edgeGeometry, isConnectionStyle } from '@/lib/canvasEdgePath';

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
export const FloatingEdge = ({ id, source, target, markerEnd, style, label, data }: EdgeProps) => {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
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
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded bg-background/80 px-1 text-meta text-primary"
            style={{ transform: `translate(-50%, -50%) translate(${labelAt.x}px, ${labelAt.y - 10}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
