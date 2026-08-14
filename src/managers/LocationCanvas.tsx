import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Background, BaseEdge, ControlButton, Controls, EdgeLabelRenderer, Handle, MarkerType, Panel, Position,
  ReactFlow, ReactFlowProvider, useConnection, useInternalNode, useNodesState, useStoreApi,
  type Edge, type EdgeProps, type Node, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import {
  AlertTriangle, ArrowLeft, ArrowLeftRight, ArrowRight, Check, Maximize2, Minimize2, Star, Trash2, X,
} from 'lucide-react';
import { useGameData } from '@/contexts/GameDataContext';
import FullscreenShell from '@/components/FullscreenShell';
import { useCanvasGridVisible, useCanvasSnap } from '@/lib/canvasPrefs';
import { useDevRoute } from '@/lib/devRouter';
import { useMorphFullscreen } from '@/lib/useMorphFullscreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { describePlaceholders } from '@/lib/placeholders';
import type { ConnectionDirection } from '@/lib/connectionEditing';
import {
  applyCanvasDrops, buildLocationCanvas, CANVAS_GRID, connectIntent, connectionEnds, deleteIntent,
  directionIntent, directionOf, hintIntent, isStationaryClick, multiDropIntents,
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

/**
 * Where a drag in flight would land, as the boxes on the map need to read it. A whole selection is dragged as
 * one gesture but lands a location at a time, so this is every box that would take one of them, and whether
 * any of them is on its way back out to the top level. `active` tells a drag clear of every box apart from
 * no drag at all.
 */
interface DropTarget {
  active: boolean;
  into: string[];
  toTopLevel: boolean;
}

const IDLE: DropTarget = { active: false, into: [], toTopLevel: false };
const DropTargetContext = createContext<DropTarget>(IDLE);

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
const LocationGroupNode = ({ id, data, selected }: NodeProps<LocationNodeType>) => {
  // Named while the drag is still in the air: this is the box that would come to hold what is being moved.
  const willTakeTheDrop = useContext(DropTargetContext).into.includes(id);
  return (
    <div
      title={data.unreachable ? UNREACHABLE_TITLE : undefined}
      data-drop-target={willTakeTheDrop || undefined}
      className={cn(
        'group/node h-full w-full rounded-md border bg-muted/40',
        data.unreachable && 'border-destructive',
        selected && 'ring-2 ring-ring',
        willTakeTheDrop && 'bg-primary/10 ring-2 ring-primary',
      )}
    >
      <EdgeAnchors dropHeight="!h-9" />
      <div className="flex items-center gap-1.5 rounded-t-md border-b bg-card px-3 py-1.5 text-label text-card-foreground">
        <NodeBadges data={data} />
        <span className="truncate">{data.label}</span>
      </div>
    </div>
  );
};

/**
 * Leaving every box is a real outcome, so it gets a real target: the whole pane, framed and named, standing
 * in for the box there isn't one of. Only when it would be a change — a location already standing on its own
 * is dragged around the map constantly, and framing the pane for every one of those says nothing.
 */
const TopLevelDrop = () => {
  const { active, toTopLevel } = useContext(DropTargetContext);
  if (!active || !toTopLevel) return null;
  return (
    <Panel position="top-center" className="!pointer-events-none !inset-0 !m-0">
      <div
        data-testid="canvas-top-level-drop"
        className="h-full w-full rounded-md border-2 border-dashed border-primary bg-primary/5"
      >
        <span className="m-2 inline-block rounded bg-primary px-2 py-0.5 text-meta text-primary-foreground">
          Top Level
        </span>
      </div>
    </Panel>
  );
};

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

/**
 * What a right-click was aimed at, which is what the menu is a menu *of*: one location, the whole selection,
 * or the open pane. A right-click on a node that is part of a multi-selection is aimed at the selection —
 * the author is pointing at the group they just composed, not at whichever member fell under the cursor.
 */
type MenuTarget =
  | { kind: 'node'; id: string }
  | { kind: 'selection' }
  | { kind: 'pane' };

/** One row of the menu. `checked` is what makes a row a setting rather than an action. */
interface MenuItem {
  label: string;
  checked?: boolean;
  onSelect: () => void;
}

/**
 * The canvas's own right-click menu, standing in for the browser's. It carries what is being done to the map
 * and the choices that describe how it is drawn, so the surface itself stays free of chrome.
 */
const CanvasMenu = ({ at, items, onClose }: {
  at: { x: number; y: number };
  items: MenuItem[];
  onClose: () => void;
}) => (
  <div
    className="absolute z-10 min-w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
    style={{ left: at.x, top: at.y }}
    role="menu"
    aria-label="Canvas Options"
    onContextMenu={(e) => e.preventDefault()}
  >
    {items.map((item) => (
      <button
        key={item.label}
        type="button"
        role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
        aria-checked={item.checked}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-label hover:bg-accent hover:text-accent-foreground"
        onClick={() => { item.onSelect(); onClose(); }}
      >
        {/* The tick's column is held even by an action, so every label in the menu starts on one line. */}
        <Check className={cn('h-4 w-4 shrink-0', item.checked ? 'opacity-100' : 'opacity-0')} />
        {item.label}
      </button>
    ))}
  </div>
);

/**
 * Everything the canvas is *doing* rather than everything it knows: what the author has picked, and which
 * arrow's record is open. Held by the wrapper, because entering full screen re-mounts the surface into a
 * different parent — held here, both would be dropped on the way through, and the author would arrive at the
 * big canvas having lost the selection they went there to work on.
 */
interface CanvasSession {
  /** The nodes picked, read during a redraw — a ref so composing a selection never redraws the map. */
  selectedIdsRef: React.MutableRefObject<string[]>;
  /** The single selection last announced to the editor, so its prop coming back can't collapse a marquee. */
  lastSyncedRef: React.MutableRefObject<string | null>;
  /** What xyflow reports the selection to be. Not a plain write to the ref: a canvas being torn down reports
   *  an empty one on its way out, and taken at face value that is the trip to full screen deselecting
   *  everything the author went there to work on. */
  reportSelection: (ids: string[]) => void;
  /** The author has their hand on this canvas: whatever it reports from here is theirs, not teardown's. */
  wake: () => void;
  selectedConnectionId: string | null;
  setSelectedConnectionId: (id: string | null) => void;
}

const CanvasInner = ({ selectedId, onSelect, session, fullscreen, onToggleFullscreen }: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  session: CanvasSession;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) => {
  const {
    locations, setLocations, connections, addConnection, updateConnection, removeConnection, placeholders,
  } = useGameData();
  const {
    selectedIdsRef, lastSyncedRef, reportSelection, wake, selectedConnectionId, setSelectedConnectionId,
  } = session;
  const store = useStoreApi();
  const [snap, setSnap] = useCanvasSnap();
  const [gridVisible, setGridVisible] = useCanvasGridVisible();
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; target: MenuTarget } | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  // Where the pointer last went down, which is what says whether the press that opened a menu had traveled.
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  // Whether the canvas is the surface the author is working on, which is what its keys answer to.
  const activeRef = useRef(false);

  // The menu is drawn in the canvas's own frame, so where it was asked for is a point in that frame.
  const openMenu = useCallback((event: React.MouseEvent | MouseEvent, target: MenuTarget) => {
    event.preventDefault();
    // The menu belongs to a right-click that stayed put; a right-drag was a pan, and the platform asks for a
    // menu on its release too.
    if (!isStationaryClick(pointerDownRef.current, { x: event.clientX, y: event.clientY })) return;
    const frame = frameRef.current?.getBoundingClientRect();
    setMenu({
      at: { x: event.clientX - (frame?.left ?? 0), y: event.clientY - (frame?.top ?? 0) },
      target,
    });
  }, []);

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
  }, [addConnection, updateConnection, removeConnection, setSelectedConnectionId]);

  // A dashed arrow is a click away from being authored; a solid one opens the record it came from.
  const handleEdgeClick = useCallback((_: unknown, edge: Edge) => {
    const clicked = map.edges.find((e) => e.id === edge.id);
    if (!clicked) return;
    if (clicked.connectionId) setSelectedConnectionId(clicked.connectionId);
    else applyIntent(connectIntent(clicked.source, clicked.target, connections));
  }, [map, connections, applyIntent, setSelectedConnectionId]);

  const [nodes, setNodes, onNodesChange] = useNodesState<LocationNodeType>([]);

  const setSelection = useCallback((wanted: (id: string) => boolean) => {
    setNodes((current) => {
      selectedIdsRef.current = current.filter((n) => wanted(n.id)).map((n) => n.id);
      return current.map((n) => ({ ...n, selected: wanted(n.id) }));
    });
  }, [setNodes, selectedIdsRef]);

  // A selection made in the list view is the canvas's whole selection; one made here is already on the nodes.
  useEffect(() => {
    if (selectedId === lastSyncedRef.current) return;
    lastSyncedRef.current = selectedId;
    setSelection((id) => id === selectedId);
  }, [selectedId, setSelection, lastSyncedRef]);

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
      // A redraw is not a deselection: every node the author had picked comes back picked.
      selected: selectedIdsRef.current.includes(node.id),
    })));
  }, [map, setNodes, selectedIdsRef]);

  const edges = useMemo(
    () => map.edges.map((edge) => toFlowEdge(edge, edge.connectionId === selectedConnectionId)),
    [map, selectedConnectionId],
  );

  const [dropInto, setDropInto] = useState<DropTarget>(IDLE);

  // The drag asks for the drops it would make, on every frame — so the boxes an author watched light up are
  // the boxes the drop then commits to, from the one answer rather than from two that agree by inspection.
  // A selection is judged a location at a time here exactly as it is on release, so a gesture carrying one
  // location into a box and another out of one says both things at once.
  const handleDrag = useCallback((_: unknown, node: Node, dragged: Node[]) => {
    const moved = dragged.length ? dragged : [node];
    const drops = multiDropIntents(locations, moved.map((n) => ({ id: n.id, position: n.position })));
    setDropInto({
      active: true,
      into: drops.map((drop) => drop.parentId).filter((id): id is string => id !== null),
      toTopLevel: drops.some((drop) => drop.kind === 'reparent' && drop.parentId === null),
    });
  }, [locations]);

  // A drag either moves a location or changes what holds it, and where it came to rest decides which — so
  // there is one gesture to learn, and the map edits the world's shape rather than only its arrangement.
  // A whole selection dragged at once is that one gesture, made of every node it carried.
  const handleDragStop = useCallback((_: unknown, node: Node, dragged: Node[]) => {
    setDropInto(IDLE);
    const moved = dragged.length ? dragged : [node];
    const drops = multiDropIntents(locations, moved.map((n) => ({ id: n.id, position: n.position })));
    if (drops.length) setLocations(applyCanvasDrops(locations, drops));
  }, [locations, setLocations]);

  // Reported by xyflow rather than tracked by us: the marquee and Shift-click both land here, so one reading
  // covers every way a selection can be composed.
  const handleSelectionChange = useCallback(({ nodes: picked }: { nodes: Node[] }) => {
    reportSelection(picked.map((n) => n.id));
  }, [reportSelection]);

  /**
   * The canvas's keys, live while it is the surface being worked on — the last pointer press decides that,
   * since the pane itself takes no focus. Typing into the Connection inspector is not the canvas's keyboard.
   */
  useEffect(() => {
    const focusing = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
    };
    const trackPointer = (event: PointerEvent) => {
      activeRef.current = !!frameRef.current?.contains(event.target as globalThis.Node);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
      if (!activeRef.current || focusing(event.target)) return;
      // In full screen, Escape is the way out of the window — a keypress meaning "leave" must not also empty
      // the selection the author is taking back to the pane with them.
      if (event.key === 'Escape') { if (!fullscreen) setSelection(() => false); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelection(() => true);
      }
    };
    document.addEventListener('pointerdown', trackPointer, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', trackPointer, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [setSelection, fullscreen]);

  /**
   * A pan that began over a location. xyflow listens for one on the pane, which sits *behind* the boxes, so
   * a press that started on a box never reaches it — and the map would refuse to move under exactly the
   * places an author is looking at. The gesture is the same one, driven from here.
   */
  const handlePointerDown = (event: React.PointerEvent) => {
    pointerDownRef.current = { x: event.clientX, y: event.clientY };
    wake();
    const overNode = (event.target as HTMLElement).closest?.('.react-flow__node');
    if (!overNode || (event.button !== 1 && event.button !== 2)) return;
    event.preventDefault();
    let last = { x: event.clientX, y: event.clientY };
    const pan = (moved: PointerEvent) => {
      store.getState().panBy({ x: moved.clientX - last.x, y: moved.clientY - last.y });
      last = { x: moved.clientX, y: moved.clientY };
    };
    const release = () => {
      window.removeEventListener('pointermove', pan);
      window.removeEventListener('pointerup', release);
    };
    window.addEventListener('pointermove', pan);
    window.addEventListener('pointerup', release);
  };

  const menuTargetFor = (id: string): MenuTarget => {
    const picked = selectedIdsRef.current;
    return picked.length > 1 && picked.includes(id) ? { kind: 'selection' } : { kind: 'node', id };
  };

  /**
   * What the menu offers for what it was opened on. Starter actions only — later tickets hang Auto Arrange
   * and the alignment commands off these same three targets.
   */
  const menuActions = (target: MenuTarget): MenuItem[] => {
    if (target.kind === 'node') {
      return [{
        label: 'Edit Location',
        onSelect: () => {
          setSelection((id) => id === target.id);
          lastSyncedRef.current = target.id;
          onSelect(target.id);
        },
      }];
    }
    if (target.kind === 'selection') {
      return [{ label: 'Clear Selection', onSelect: () => setSelection(() => false) }];
    }
    return [{ label: 'Select All Locations', onSelect: () => setSelection(() => true) }];
  };

  return (
    <div
      ref={frameRef}
      className="relative h-full w-full"
      onPointerDownCapture={handlePointerDown}
      // The browser's menu never opens over the canvas — not over a node, not over the pane, and not at the
      // end of a right-drag pan, which is a gesture the browser would otherwise answer with a menu.
      onContextMenu={(e) => e.preventDefault()}
    >
      <DropTargetContext.Provider value={dropInto}>
      <ReactFlow<LocationNodeType, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDrag={handleDrag}
        onNodeDragStop={handleDragStop}
        onNodeClick={(_, node) => {
          setSelectedConnectionId(null);
          // The editor tracks the last node clicked; announcing it here is what keeps the prop coming back
          // from collapsing a multi-selection this click may have just added to.
          lastSyncedRef.current = node.id;
          onSelect(node.id);
        }}
        onSelectionChange={handleSelectionChange}
        onEdgeClick={handleEdgeClick}
        onPaneClick={() => { setSelectedConnectionId(null); setMenu(null); }}
        onPaneContextMenu={(e) => openMenu(e, { kind: 'pane' })}
        onNodeContextMenu={(e, node) => openMenu(e, menuTargetFor(node.id))}
        onSelectionContextMenu={(e) => openMenu(e, { kind: 'selection' })}
        // Node-editor controls: left-drag draws a marquee over the pane and moves a node on a node, the other
        // two buttons pan, and Shift or Ctrl composes a selection a node at a time.
        panOnDrag={[1, 2]}
        selectionOnDrag
        selectionKeyCode={null}
        multiSelectionKeyCode={['Shift', 'Control', 'Meta']}
        // Snapping applies to the drag itself, so what the author sees land is exactly what is stored.
        snapToGrid={snap}
        snapGrid={[CANVAS_GRID, CANVAS_GRID]}
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
        {/* The dots mark the grid's own intersections; hiding it keeps the pane's color and drops the pattern. */}
        <Background className="!bg-background" color={gridVisible ? 'hsl(var(--border))' : 'transparent'} gap={CANVAS_GRID} />
        {/* The embedded canvas's whole chrome: the zoom controls, and the way to the big one. Everything
            heavier belongs to full screen, so the quick view stays a view. */}
        <Controls showInteractive={false}>
          <ControlButton
            onClick={onToggleFullscreen}
            title={fullscreen ? 'Exit full screen' : 'Edit full screen'}
            aria-label={fullscreen ? 'Exit full screen' : 'Edit full screen'}
          >
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
          </ControlButton>
        </Controls>
        <TopLevelDrop />
        {selectedConnection && (
          <ConnectionInspector
            connection={selectedConnection}
            nameOf={nameOf}
            onIntent={applyIntent}
            onClose={() => setSelectedConnectionId(null)}
          />
        )}
      </ReactFlow>
      </DropTargetContext.Provider>
      {menu && (
        <CanvasMenu
          at={menu.at}
          onClose={() => setMenu(null)}
          items={[
            ...menuActions(menu.target),
            { label: 'Snap To Grid', checked: snap, onSelect: () => setSnap(!snap) },
            { label: 'Show Grid', checked: gridVisible, onSelect: () => setGridVisible(!gridVisible) },
          ]}
        />
      )}
    </div>
  );
};

/**
 * The Locations tab's canvas view — the list's spatial twin, editing the same authored world.
 *
 * Embedded and full screen are one canvas wearing different chrome, not two surfaces: the same component is
 * mounted in the pane or in the shared full-screen window, and what the author was in the middle of — the
 * picked nodes, the open Connection — is held here so the trip between them carries it. World edits need no
 * carrying: both are writing to the same authored world through GameDataContext.
 */
const LocationCanvas = (props: { selectedId: string | null; onSelect: (id: string) => void }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const morph = useMorphFullscreen(hostRef);
  const selectedIdsRef = useRef<string[]>(props.selectedId ? [props.selectedId] : []);
  const lastSyncedRef = useRef<string | null>(props.selectedId);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  // Set while the canvas is moving between the pane and the window. The old one reports an empty selection as
  // it goes and the new one before it has drawn, and neither is the author letting go of anything.
  const inTransitRef = useRef(false);
  const wake = useCallback(() => { inTransitRef.current = false; }, []);
  const reportSelection = useCallback((ids: string[]) => {
    if (inTransitRef.current && !ids.length) return;
    inTransitRef.current = false;
    selectedIdsRef.current = ids;
  }, []);
  // Every way in and out of the window goes through the same pair, so Escape and the dialog's own close carry
  // the selection exactly as the toggle does.
  const toggleFullscreen = useCallback(() => {
    inTransitRef.current = true;
    morph.toggle();
  }, [morph]);
  const windowMorph = useMemo(
    () => ({ ...morph, close: () => { inTransitRef.current = true; morph.close(); } }),
    [morph],
  );

  const session: CanvasSession = {
    selectedIdsRef, lastSyncedRef, reportSelection, wake, selectedConnectionId, setSelectedConnectionId,
  };

  // DEV dev-router: `#dev?…&subtab=canvas&fullscreen=1` lands on the big canvas in one call. Tree-shaken in prod.
  const devFullscreen = useDevRoute()?.fullscreen;
  useEffect(() => {
    if (import.meta.env.DEV && devFullscreen) morph.open();
    // Only the route says so — re-running on `morph` identity would re-open a window the author just closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devFullscreen]);

  const canvas = (
    <ReactFlowProvider>
      <CanvasInner
        {...props}
        session={session}
        fullscreen={morph.mounted}
        onToggleFullscreen={toggleFullscreen}
      />
    </ReactFlowProvider>
  );

  return (
    // The pane's own box stays laid out at its real size while the window is up: it is what the window grows
    // out of and shrinks back into, and a collapsed source has nothing to travel between.
    <div ref={hostRef} className="relative h-full w-full">
      {!morph.mounted && canvas}
      {morph.mounted && (
        <FullscreenShell
          morph={windowMorph}
          title="Locations Canvas"
          // The control that opened the window went with the canvas, so closing has to be told where to land.
          returnFocus={() => hostRef.current?.querySelector<HTMLElement>('.react-flow__controls button:last-child')}
        >
          <div className="min-h-0 flex-1">{canvas}</div>
        </FullscreenShell>
      )}
    </div>
  );
};

export default LocationCanvas;
