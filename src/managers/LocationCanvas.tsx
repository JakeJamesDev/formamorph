import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background, BaseEdge, Controls, EdgeLabelRenderer, Handle, MarkerType, Panel, Position, ReactFlow,
  ReactFlowProvider, useConnection, useInternalNode, useNodesState,
  type Edge, type EdgeProps, type Node, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { AlertTriangle, ArrowLeft, ArrowLeftRight, ArrowRight, Star, Trash2, X } from 'lucide-react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { describePlaceholders } from '@/lib/placeholders';
import type { ConnectionDirection } from '@/lib/connectionEditing';
import {
  applyCanvasDrop, buildLocationCanvas, connectIntent, connectionEnds, deleteIntent, directionIntent,
  directionOf, dropIntent, hintIntent,
  type CanvasEdge, type CanvasIntent, type CanvasNodeData,
} from '@/lib/locationCanvas';
import { cn } from '@/lib/utils';
import type { Connection } from '@/types';

/**
 * The Locations canvas: the world's navigable shape as a map, and the primary place to draw on it. What a
 * gesture *means* comes from `lib/locationCanvas` — which boxes nest, which arrows exist, and what dragging
 * between two of them asks the world to become — so the graph's rules are testable without mounting a canvas.
 * What is left here is drawing, and handing each gesture's intent to the editor's own write path, which is
 * why an edit made here and one made in the list panel are the same edit to the same record — and why
 * dragging a location into a box nests it there, in the same world the list view is reading.
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

/**
 * Where a Connection is drawn from and dropped onto. Edges attach to a node's center and are clipped to its
 * border by `FloatingEdge`, so neither handle is where an arrow visibly lands.
 *
 * The source is a small grip on the node's edge, so dragging the box still moves the box. The drop target
 * only exists while a Connection is being drawn, and covers the whole box — the author aims at a location
 * rather than at a dot. A group's cover is its title strip, so the sub-locations inside it stay their own
 * targets.
 */
const EdgeAnchors = ({ dropHeight }: { dropHeight: string }) => {
  const drawing = useConnection((c) => c.inProgress);
  return (
    <>
      <Handle
        type="source"
        position={Position.Right}
        title="Drag To Connect"
        className="!h-3 !w-3 !border-2 !border-background !bg-primary opacity-0 transition-opacity group-hover/node:opacity-100"
      />
      <Handle
        type="target"
        position={Position.Left}
        // xyflow marks the handle under the cursor `connectingto`, and `valid` only when the drop would be
        // accepted — so a pair that already has a Connection lights up as refused instead of silently
        // swallowing the drag.
        className={cn(
          '!left-0 !top-0 !w-full !transform-none !rounded-md !border-0 !opacity-0',
          '!bg-destructive/15 [&.valid]:!bg-primary/15 [&.connectingto]:!opacity-100',
          dropHeight,
          drawing ? '' : '!pointer-events-none',
        )}
      />
    </>
  );
};

/** A location with no sub-locations: one box carrying its name. */
const LocationNode = ({ data, selected }: NodeProps<LocationNodeType>) => (
  <div
    title={data.unreachable ? UNREACHABLE_TITLE : undefined}
    className={cn(
      'group/node flex h-full w-full items-center justify-center gap-1.5 rounded-md border bg-card px-3 text-label text-card-foreground',
      data.unreachable && 'border-destructive',
      selected && 'ring-2 ring-ring',
    )}
  >
    <EdgeAnchors dropHeight="!h-full" />
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
      'group/node h-full w-full rounded-md border bg-muted/40',
      data.unreachable && 'border-destructive',
      selected && 'ring-2 ring-ring',
    )}
  >
    <EdgeAnchors dropHeight="!h-9" />
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

/** Dashed and muted for free implicit travel, solid and primary-colored for an authored Connection. Both
 *  answer a click, so the cursor says so — one selects its record, the other becomes one. */
function toFlowEdge(edge: CanvasEdge, selected: boolean): Edge {
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
      strokeWidth: implicit ? 1.3 : selected ? 3.5 : 2,
      cursor: 'pointer',
      ...(implicit ? { strokeDasharray: '5 5', opacity: 0.8 } : {}),
    },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: implicit ? 14 : 16, height: implicit ? 14 : 16 },
  };
}

/** The three ways a pair's travel can run, worded from the pair's first end so the option an author just
 *  clicked stays where it was. Full names live in the labels; the arrows read against the header. */
const DIRECTIONS: { value: ConnectionDirection; Icon: typeof ArrowRight; label: (a: string, b: string) => string }[] = [
  { value: 'two-way', Icon: ArrowLeftRight, label: (a, b) => `Travel both ways between ${a} and ${b}` },
  { value: 'outgoing', Icon: ArrowRight, label: (a, b) => `Travel one way, ${a} to ${b}` },
  { value: 'incoming', Icon: ArrowLeft, label: (a, b) => `Travel one way, ${b} to ${a}` },
];

/**
 * The selected arrow's record, edited in place on the map: which way travel runs, how the narration should
 * describe making the trip, and whether the link exists at all. Every control hands its intent back, so the
 * panel decides nothing about what an edit means.
 */
const ConnectionInspector = ({ connection, nameOf, onIntent, onClose }: {
  connection: Connection;
  nameOf: (id: string) => string;
  onIntent: (intent: CanvasIntent) => void;
  onClose: () => void;
}) => {
  const [a, b] = connectionEnds(connection);
  const names = [nameOf(a), nameOf(b)] as const;
  return (
    <Panel position="top-right" className="!m-2 w-72 space-y-2 rounded-md border bg-card p-3 shadow-md">
      <div className="flex items-center gap-1">
        <span className="min-w-0 flex-grow truncate text-label" title={`${names[0]} — ${names[1]}`}>
          {names[0]} — {names[1]}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Delete Connection"
          onClick={() => onIntent(deleteIntent(connection))}>
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Close" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ToggleGroup
        type="single"
        className="w-full"
        value={directionOf(connection)}
        aria-label="Direction of Travel"
        // A single ToggleGroup clears its value when the active item is clicked again; a Connection always
        // runs some direction, so an empty result is ignored rather than stored.
        onValueChange={(v) => { if (v) onIntent(directionIntent(connection, v as ConnectionDirection)); }}
      >
        {DIRECTIONS.map(({ value, Icon, label }) => (
          <ToggleGroupItem key={value} value={value} className="flex-1" aria-label={label(...names)} title={label(...names)}>
            <Icon className="h-4 w-4" />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Input
        value={connection.aiHint || ''}
        onChange={(e) => onIntent(hintIntent(connection, e.target.value))}
        placeholder="Travel Hint, e.g. through the shimmering portal"
        aria-label="Travel Hint"
      />
    </Panel>
  );
};

const CanvasInner = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) => {
  const {
    locations, setLocations, connections, addConnection, updateConnection, removeConnection, placeholders,
  } = useGameData();
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  const nameOf = useCallback(
    (id: string) => {
      const found = locations.find((l) => l.id === id);
      return (found && describePlaceholders(found.name, placeholders)) || 'Unnamed Location';
    },
    [locations, placeholders],
  );

  const map = useMemo(
    () => buildLocationCanvas(locations, connections, {
      resolveName: (location) => describePlaceholders(location.name, placeholders) || 'Unnamed Location',
    }),
    [locations, connections, placeholders],
  );

  // Selection follows the record, not the arrow: a flip rewrites the record's ends and swaps which arrows
  // exist, so the panel would close under the author's hand if it were pinned to an arrow's id.
  const selectedConnection = connections.find((c) => c.id === selectedConnectionId) ?? null;

  const applyIntent = useCallback((intent: CanvasIntent | null) => {
    if (!intent) return;
    if (intent.kind === 'add') {
      addConnection(intent.connection);
      setSelectedConnectionId(intent.connection.id); // a fresh Connection opens for annotation
    } else if (intent.kind === 'update') {
      updateConnection(intent.connection);
    } else {
      removeConnection(intent.connectionId);
      setSelectedConnectionId(null);
    }
  }, [addConnection, updateConnection, removeConnection]);

  // A dashed arrow is a click away from being authored; a solid one opens the record it came from.
  const handleEdgeClick = useCallback((_: unknown, edge: Edge) => {
    const clicked = map.edges.find((e) => e.id === edge.id);
    if (!clicked) return;
    if (clicked.connectionId) setSelectedConnectionId(clicked.connectionId);
    else applyIntent(connectIntent(clicked.source, clicked.target, connections));
  }, [map, connections, applyIntent]);

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

  const edges = useMemo(
    () => map.edges.map((edge) => toFlowEdge(edge, edge.connectionId === selectedConnectionId)),
    [map, selectedConnectionId],
  );

  // A drag either moves a location or changes what holds it, and where it came to rest decides which — so
  // there is one gesture to learn, and the map edits the world's shape rather than only its arrangement.
  const handleDragStop = useCallback((_: unknown, node: Node) => {
    const drop = dropIntent(locations, node.id, node.position);
    if (drop) setLocations(applyCanvasDrop(locations, drop));
  }, [locations, setLocations]);

  return (
    <ReactFlow<LocationNodeType, Edge>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onNodeDragStop={handleDragStop}
      onNodeClick={(_, node) => { setSelectedConnectionId(null); onSelect(node.id); }}
      onEdgeClick={handleEdgeClick}
      onPaneClick={() => setSelectedConnectionId(null)}
      onConnect={({ source, target }) => applyIntent(connectIntent(source, target, connections))}
      // The same rule the gesture obeys, so a drag onto a pair that already has a record reads as
      // refused while it is being drawn rather than landing and doing nothing.
      isValidConnection={({ source, target }) => !!connectIntent(source, target, connections)}
      connectionLineStyle={{ stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
      deleteKeyCode={null}
      minZoom={0.2}
      fitView
      className="h-full w-full"
    >
      <Background className="!bg-background" color="hsl(var(--border))" />
      <Controls showInteractive={false} />
      {selectedConnection && (
        <ConnectionInspector
          connection={selectedConnection}
          nameOf={nameOf}
          onIntent={applyIntent}
          onClose={() => setSelectedConnectionId(null)}
        />
      )}
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
