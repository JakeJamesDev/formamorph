import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import {
  Background, ReactFlow, type Edge, type Node, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { MapPin } from 'lucide-react';
import { FloatingEdge } from '@/components/FloatingEdge';
import { toFlowEdge } from '@/lib/canvasEdges';
import { useCanvasConnectionStyle } from '@/lib/canvasPrefs';
import {
  buildLocationCanvas, CANVAS_GRID, isTravelClick, TOUCH_SLOP, UNNAMED_LOCATION, type TravelPress,
} from '@/lib/locationCanvas';
import { CanvasControls } from '@/components/CanvasControls';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Connection, GameLocation } from '@/types';

/**
 * The Map: the world as its author arranged it on the Locations Canvas, handed to the player to travel by.
 * One mapping draws both — the same boxes, the same nesting, the same arrows — so arranging the canvas is
 * also authoring what a player sees.
 *
 * What is dropped on the way across is the authoring: nothing here can be moved, connected or selected, and
 * the canvas's diagnostics — the start marker, the unreachable warning — stay with the author they were
 * written for. What is added is the player: the box they are standing in is marked, and clicking any box
 * travels there, from anywhere, arrows or no arrows (ADR-0006).
 */

interface MapNodeData extends Record<string, unknown> {
  label: string;
  /** The box the player is standing in. */
  here: boolean;
}

type MapNode = Node<MapNodeData>;

/** Where a click on a box goes. Carried as context so marking one box is not a redraw of every box. */
const TravelContext = createContext<(id: string, event: React.MouseEvent) => void>(() => {});

/** Marked as the player's own: the box they are standing in. */
const hereRing = 'border-primary ring-2 ring-primary';

/** The clickable face both node shapes share: the location's name, pinned where the player is standing,
 *  wired to travel. Each shape supplies only the geometry the button fills. */
const TravelButton = ({ id, data, className }: {
  id: string;
  data: MapNodeData;
  className: string;
}) => {
  const travel = useContext(TravelContext);
  return (
    // A small box clips a long name, so the tip spells it out; the button still names itself by it.
    <Tip tip={data.label} labelsChild={false}>
      <button
        type="button"
        aria-current={data.here ? 'location' : undefined}
        onClick={(event) => travel(id, event)}
        className={cn(
          'items-center gap-1.5 bg-card text-label text-card-foreground hover:bg-accent hover:text-accent-foreground',
          className,
        )}
      >
        {data.here && <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />}
        <span className="truncate">{data.label}</span>
      </button>
    </Tip>
  );
};

/** A location with no sub-locations: one box carrying its name, the whole of it the way there. */
const MapLocationNode = ({ id, data }: NodeProps<MapNode>) => (
  <TravelButton
    id={id}
    data={data}
    className={cn('flex h-full w-full justify-center rounded-md border px-3', data.here && hereRing)}
  />
);

/** A location holding sub-locations: a box around them, named along its top. The name is the way *to* it —
 *  the frame itself is the places inside, so only the strip along the top travels. */
const MapGroupNode = ({ id, data }: NodeProps<MapNode>) => (
  <div className={cn('h-full w-full rounded-md border bg-muted/40', data.here && hereRing)}>
    <TravelButton id={id} data={data} className="flex w-full rounded-t-md border-b px-3 py-1.5" />
  </div>
);

const nodeTypes = { location: MapLocationNode, locationGroup: MapGroupNode };
const edgeTypes = { floating: FloatingEdge };

const LocationMap = ({ locations, connections, currentLocationId, onTravel }: {
  locations: GameLocation[];
  connections: Connection[];
  currentLocationId: string | null;
  onTravel: (location: GameLocation) => void;
}) => {
  // The same shape the canvas draws arrows in — presentation, and one person's own preference, so someone who
  // both authors and plays reads one map rather than two.
  const [connectionStyle] = useCanvasConnectionStyle();
  // Where the press that is about to become a click went down; `isTravelClick` judges the click against it.
  const pressRef = useRef<TravelPress | null>(null);

  const travel = useCallback((id: string, event: React.MouseEvent) => {
    if (!isTravelClick(pressRef.current, { x: event.clientX, y: event.clientY, detail: event.detail })) return;
    const location = locations.find((l) => l.id === id);
    if (location) onTravel(location);
  }, [locations, onTravel]);

  const map = useMemo(
    () => buildLocationCanvas(locations, connections, {
      resolveName: (location) => location.name || UNNAMED_LOCATION,
    }),
    [locations, connections],
  );

  const nodes = useMemo<MapNode[]>(() => map.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    ...(node.parentId ? { parentId: node.parentId } : {}),
    width: node.width,
    height: node.height,
    // A box nothing can be done *to* is a box xyflow stops sending clicks to — and being clicked is the
    // whole of what a box on the Map is for, so it takes its pointer events back.
    style: { pointerEvents: 'auto' as const },
    data: { label: node.data.label, here: node.id === currentLocationId },
  })), [map, currentLocationId]);

  const edges = useMemo<Edge[]>(
    () => map.edges.map((edge) => toFlowEdge(edge, connectionStyle, { interactive: false })),
    [map, connectionStyle],
  );

  return (
    <div
      className="h-full w-full"
      onPointerDownCapture={(event) => {
        pressRef.current = {
          at: { x: event.clientX, y: event.clientY },
          ...(event.pointerType === 'touch' ? { slop: TOUCH_SLOP } : {}),
        };
      }}
      // The browser's menu never opens over the map, exactly as on the canvas: every button that isn't
      // clicking a box is a pan, and the platform answers the right one's release with a menu.
      onContextMenu={(event) => event.preventDefault()}
      // d3-zoom starts a pan without cancelling the press's own default, and a middle press's default is
      // Chrome's autoscroll — a second scroll mode fighting the pan it rides on. The left button keeps its
      // default: pressing a location box has focus to hand out.
      onMouseDownCapture={(event) => { if (event.button !== 0) event.preventDefault(); }}
    >
      <TravelContext.Provider value={travel}>
        <ReactFlow<MapNode, Edge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          // Readonly: the layout is the author's, and play never writes the authored world.
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          elementsSelectable={false}
          edgesFocusable={false}
          // Any button's drag pans — the canvas's right- and middle-drag panning, plus the left button,
          // which a readonly map has no marquee to reserve for. Two fingers pinch.
          panOnDrag={[0, 1, 2]}
          zoomOnPinch
          minZoom={0.2}
          fitView
          attributionPosition="bottom-left"
          className="h-full w-full"
        >
          {/* The grid is an authoring aid — what a location snaps to. The player gets the plain ground. */}
          <Background className="!bg-background" color="transparent" gap={CANVAS_GRID} />
          <CanvasControls />
        </ReactFlow>
      </TravelContext.Provider>
    </div>
  );
};

export default LocationMap;
