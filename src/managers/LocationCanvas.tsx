import { useCallback, useEffect, useMemo } from 'react';
import {
  Background, BaseEdge, Controls, EdgeLabelRenderer, Handle, MarkerType, Position, ReactFlow,
  ReactFlowProvider, useInternalNode, useNodesState,
  type Edge, type EdgeProps, type Node, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { AlertTriangle, Star } from 'lucide-react';
import { useGameData } from '@/contexts/GameDataContext';
import { describePlaceholders } from '@/lib/placeholders';
import { buildLocationCanvas, withCanvasPosition, type CanvasEdge, type CanvasNodeData } from '@/lib/locationCanvas';
import { cn } from '@/lib/utils';

/**
 * The Locations canvas: the world's navigable shape as a map. What the map *means* comes from
 * `lib/locationCanvas` — which boxes nest, which arrows exist, where each one points — and a drag goes back
 * to it, so the graph's rules are testable without mounting a canvas. What is left here is drawing: the
 * boxes, and the geometry of where an arrow meets the box it points at.
 *
 * Drawing Connections and dragging a location between boxes arrive with the next tickets; today a node is
 * arrangeable and opens its full editor when clicked.
 */

// xyflow requires a node's data to be indexable; the mapper's shape is the useful half of it.
type LocationNodeType = Node<CanvasNodeData & Record<string, unknown>>;

const UNREACHABLE_TITLE = 'No starting location can reach here';

/** The badges a node carries: where a new game may begin, and where a player can never arrive. */
const NodeBadges = ({ data }: { data: CanvasNodeData }) => (
  <>
    {data.isStarting && <Star className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Starting location" />}
    {data.unreachable && (
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label={UNREACHABLE_TITLE} />
    )}
  </>
);

/** Edges attach to a node's center and are clipped to its border by `FloatingEdge`, so the handles are
 *  anchors rather than visible ports. */
const EdgeAnchors = () => (
  <>
    <Handle type="target" position={Position.Top} className="!pointer-events-none !opacity-0" isConnectable={false} />
    <Handle type="source" position={Position.Top} className="!pointer-events-none !opacity-0" isConnectable={false} />
  </>
);

/** A location with no sub-locations: one box carrying its name. */
const LocationNode = ({ data, selected }: NodeProps<LocationNodeType>) => (
  <div
    title={data.unreachable ? UNREACHABLE_TITLE : undefined}
    className={cn(
      'flex h-full w-full items-center justify-center gap-1.5 rounded-md border bg-card px-3 text-label text-card-foreground',
      data.unreachable && 'border-destructive',
      selected && 'ring-2 ring-ring',
    )}
  >
    <EdgeAnchors />
    <NodeBadges data={data} />
    <span className="truncate">{data.label}</span>
  </div>
);

/** A location holding sub-locations: a box around them, named along its top. Being inside the box *is* the
 *  free travel to and from it, which is why no line joins a parent to its children. */
const LocationGroupNode = ({ data, selected }: NodeProps<LocationNodeType>) => (
  <div
    title={data.unreachable ? UNREACHABLE_TITLE : undefined}
    className={cn(
      'h-full w-full rounded-md border bg-muted/40',
      data.unreachable && 'border-destructive',
      selected && 'ring-2 ring-ring',
    )}
  >
    <EdgeAnchors />
    <div className="flex items-center gap-1.5 rounded-t-md border-b bg-card px-3 py-1.5 text-label text-card-foreground">
      <NodeBadges data={data} />
      <span className="truncate">{data.label}</span>
    </div>
  </div>
);

const nodeTypes = { location: LocationNode, locationGroup: LocationGroupNode };

/** Where the straight line between two centers crosses a box's border — so an arrow stops at the box it
 *  points at, whichever side that turns out to be. */
function borderPoint(rect: { x: number; y: number; width: number; height: number }, toward: { x: number; y: number }) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  const scale = Math.min(
    dx !== 0 ? rect.width / 2 / Math.abs(dx) : Infinity,
    dy !== 0 ? rect.height / 2 / Math.abs(dy) : Infinity,
  );
  return { x: cx + dx * scale, y: cy + dy * scale };
}

/** Half the gap between a pair's two arrows — each rides to the left of its own direction of travel. */
const ARROW_OFFSET = 5;

/**
 * A border-to-border arrow, drawn one step to the left of the direction it travels: a pair's two directions
 * therefore sit side by side instead of on top of each other, and the map is read by counting arrows.
 */
const FloatingEdge = ({ id, source, target, markerEnd, style, label }: EdgeProps) => {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;
  const rectOf = (node: NonNullable<typeof sourceNode>) => ({
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width: node.measured.width ?? 0,
    height: node.measured.height ?? 0,
  });
  const from = rectOf(sourceNode);
  const to = rectOf(targetNode);
  const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const start = borderPoint(from, toCenter);
  const end = borderPoint(to, fromCenter);
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const ox = (-(end.y - start.y) / length) * ARROW_OFFSET;
  const oy = ((end.x - start.x) / length) * ARROW_OFFSET;
  const path = `M ${start.x + ox},${start.y + oy} L ${end.x + ox},${end.y + oy}`;
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded bg-background/80 px-1 text-meta text-primary"
            style={{ transform: `translate(-50%, -50%) translate(${(start.x + end.x) / 2}px, ${(start.y + end.y) / 2 - 10}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const edgeTypes = { floating: FloatingEdge };

/** Dashed and muted for free implicit travel, solid and primary-colored for an authored Connection. */
function toFlowEdge(edge: CanvasEdge): Edge {
  const implicit = edge.kind === 'implicit';
  const color = implicit ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))';
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'floating',
    label: edge.label,
    style: {
      stroke: color,
      strokeWidth: implicit ? 1.3 : 2,
      ...(implicit ? { strokeDasharray: '5 5', opacity: 0.8 } : {}),
    },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: implicit ? 14 : 16, height: implicit ? 14 : 16 },
  };
}

const CanvasInner = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) => {
  const { locations, setLocations, connections, placeholders } = useGameData();

  const map = useMemo(
    () => buildLocationCanvas(locations, connections, {
      resolveName: (location) => describePlaceholders(location.name, placeholders) || 'Unnamed Location',
    }),
    [locations, connections, placeholders],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<LocationNodeType>([]);
  // The mapper owns what is on the map; xyflow owns only the in-flight drag, so a world edit anywhere
  // (a rename, a new Connection, a deletion) redraws from the world rather than from stale canvas state.
  useEffect(() => {
    setNodes(map.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      // Nested but not `extent: 'parent'`-clamped: a group is sized *from* its children, so clamping them to
      // its current edge would mean a box that can never grow and sub-locations that can barely be moved.
      ...(node.parentId ? { parentId: node.parentId } : {}),
      width: node.width,
      height: node.height,
      // Spelled out rather than passed through: a fresh literal is what satisfies xyflow's indexable data.
      data: { label: node.data.label, isStarting: node.data.isStarting, unreachable: node.data.unreachable },
      selected: node.id === selectedId,
    })));
  }, [map, selectedId, setNodes]);

  const edges = useMemo(() => map.edges.map(toFlowEdge), [map]);

  const handleDragStop = useCallback(
    (_: unknown, node: Node) => setLocations(withCanvasPosition(locations, node.id, node.position)),
    [locations, setLocations],
  );

  return (
    <ReactFlow<LocationNodeType, Edge>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onNodeDragStop={handleDragStop}
      onNodeClick={(_, node) => onSelect(node.id)}
      nodesConnectable={false}
      deleteKeyCode={null}
      minZoom={0.2}
      fitView
      className="h-full w-full"
    >
      <Background className="!bg-background" color="hsl(var(--border))" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
};

/** The Locations tab's canvas view — the list's spatial twin, editing the same authored world. */
const LocationCanvas = (props: { selectedId: string | null; onSelect: (id: string) => void }) => (
  <ReactFlowProvider>
    <CanvasInner {...props} />
  </ReactFlowProvider>
);

export default LocationCanvas;
