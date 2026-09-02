import {
  createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type RefObject,
} from 'react';
import {
  Background, Handle, MiniMap, Panel,
  Position, ReactFlow, ReactFlowProvider, useConnection, useNodesState, useReactFlow, useStoreApi,
  type Edge, type Node, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import {
  AlertTriangle, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical,
  AlignVerticalDistributeCenter, ArrowLeft, ArrowLeftRight, ArrowRight, Check, CornerDownRight, Grid2x2,
  LayoutGrid, Magnet, Maximize2, Minimize2, Minus, Redo2, Search, Spline, Star, Trash2, Undo2, X,
} from 'lucide-react';
import { useGameData } from '@/contexts/GameDataContext';
import FullscreenShell from '@/components/FullscreenShell';
import { FloatingEdge } from '@/components/FloatingEdge';
import { toFlowEdge } from '@/lib/canvasEdges';
import { useCanvasConnectionStyle, useCanvasGridVisible, useCanvasSnap } from '@/lib/canvasPrefs';
import { CONNECTION_STYLES, isConnectionStyle, type ConnectionStyle } from '@/lib/canvasEdgePath';
import { useDevRoute } from '@/lib/devRouter';
import { useMorphFullscreen } from '@/lib/useMorphFullscreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  ContextMenu, ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuRadioGroup,
  ContextMenuRadioItem, ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { labelPlaceholders } from '@/lib/placementLetters';
import type { ConnectionDirection } from '@/lib/connectionEditing';
import {
  applyCanvasDrops, applyCanvasIntent, beginCanvasDrag, buildLocationCanvas, CANVAS_GRID, connectIntent,
  connectionEnds, deleteIntent, directionIntent, directionOf, hintIntent, isStationaryClick, leafTarget,
  LONG_PRESS_MS, multiDropIntents, TOUCH_SLOP, UNNAMED_LOCATION,
  type CanvasDragSession, type CanvasIntent, type CanvasNodeData,
} from '@/lib/locationCanvas';
import {
  canvasMenuSections, type CanvasMenuItem, type CanvasMenuSection,
} from '@/lib/canvasMenu';
import {
  canvasHistoryFor, historyShortcut, recordCanvasEdit, redoCanvasEdit, undoCanvasEdit,
  type CanvasHistory,
} from '@/lib/canvasHistory';
import { holderOf } from '@/lib/locationTree';
import { autoArrange, autoArrangeAll } from '@/lib/locationArrange';
import {
  alignLocations, distributeLocations, nudgeLocations, type AlignEdge, type DistributeAxis,
} from '@/lib/locationAlign';
import { searchLocations, type LocationMatch } from '@/lib/locationSearch';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { cn } from '@/lib/utils';
import type { Connection, GameLocation } from '@/types';
import { CanvasControlButton, CanvasControls } from '@/components/CanvasControls';
import { Tip } from '@/components/ui/tooltip';

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

/**
 * The childless location the drag has rested on long enough to nest into. Its own channel rather than a field
 * of the drop target: that is written on a drag frame, and a dwell fires while the pointer is *still*, so a
 * highlight waiting for the next frame would be one that never arrives.
 */
const ArmedLeafContext = createContext<string | null>(null);

/** How long a drag rests on a leaf before that leaf will take it. A deliberate pause, in the same
 *  neighborhood as the hold a finger uses to pick a box out. */
const NEST_DWELL_MS = LONG_PRESS_MS;
const DropTargetContext = createContext<DropTarget>(IDLE);

/**
 * The location the canvas has just traveled to, marked until the author has had time to see where they
 * landed. Carried as context rather than on the node itself: a flash is a moment, and writing one onto the
 * node data would redraw every box on the map to say something about one of them.
 */
const FlashContext = createContext<string | null>(null);

/** How long a box stays marked after the map travels to it. */
const FLASH_MS = 1400;

/** Marked as arrived-at: the ring a selected box wears, in the accent color and pulsing where motion is
 *  welcome. Stands in place of the selection ring rather than beside it — two rings on one box is one ring. */
const flashRing = 'ring-2 ring-primary motion-safe:animate-pulse';

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
      <Tip tip="Drag To Connect">
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-background !bg-primary opacity-0 transition-opacity group-hover/node:opacity-100"
        />
      </Tip>
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
const LocationNode = ({ id, data, selected }: NodeProps<LocationNodeType>) => {
  const flashing = useContext(FlashContext) === id;
  // Armed by a drag resting on it: this box is about to become one holding what is being dragged, and saying
  // so before the release is what lets the author bail by moving away.
  const armed = useContext(ArmedLeafContext) === id;
  return (
    // The box already carries its own name; the tip only says it cannot be reached.
    <Tip tip={data.unreachable ? UNREACHABLE_TITLE : undefined} labelsChild={false}>
      <div
        data-drop-target={armed || undefined}
        data-flash={flashing || undefined}
        className={cn(
          'group/node flex h-full w-full items-center justify-center gap-1.5 rounded-md border bg-card px-3 text-label text-card-foreground',
          data.unreachable && 'border-destructive',
          flashing ? flashRing : selected && 'ring-2 ring-ring',
          armed && 'bg-primary/10 ring-2 ring-primary',
        )}
      >
        <EdgeAnchors dropHeight="!h-full" />
        <NodeBadges data={data} />
        <span className="truncate">{data.label}</span>
      </div>
    </Tip>
  );
};

/** A location holding sub-locations: a box around them, named along its top. Being inside the box *is* the
 *  free travel to and from it, which is why no line joins a parent to its children. */
const LocationGroupNode = ({ id, data, selected }: NodeProps<LocationNodeType>) => {
  // Named while the drag is still in the air: this is the box that would come to hold what is being moved.
  const willTakeTheDrop = useContext(DropTargetContext).into.includes(id);
  const flashing = useContext(FlashContext) === id;
  return (
    <Tip tip={data.unreachable ? UNREACHABLE_TITLE : undefined} labelsChild={false}>
      <div
        data-drop-target={willTakeTheDrop || undefined}
        data-flash={flashing || undefined}
        className={cn(
          'group/node h-full w-full rounded-md border bg-muted/40',
          data.unreachable && 'border-destructive',
          flashing ? flashRing : selected && 'ring-2 ring-ring',
          willTakeTheDrop && 'bg-primary/10 ring-2 ring-primary',
        )}
      >
        <EdgeAnchors dropHeight="!h-9" />
        <div className="flex items-center gap-1.5 rounded-t-md border-b bg-card px-3 py-1.5 text-label text-card-foreground">
          <NodeBadges data={data} />
          <span className="truncate">{data.label}</span>
        </div>
      </div>
    </Tip>
  );
};

/**
 * Leaving every box is a real outcome, so it gets a real target: the whole pane, framed and named, standing
 * in for the box there isn't one of. Only when it would be a change — a location already standing on its own
 * is dragged around the map constantly, and framing the pane for every one of those says nothing.
 *
 * Drawn on the canvas surface itself: xyflow's own full-pane container, stacked above the grid but beneath
 * the pane and every box on it, so it reads as the ground the location is being set down on. A Panel is the
 * wrong tool here twice over — it is anchored to one edge, and it floats over the map like a piece of chrome
 * the location is being filed into.
 */
const TopLevelDrop = () => {
  const { active, toTopLevel } = useContext(DropTargetContext);
  if (!active || !toTopLevel) return null;
  return (
    <div
      data-testid="canvas-top-level-drop"
      style={{ zIndex: 0 }}
      className="react-flow__container pointer-events-none border-2 border-dashed border-primary bg-primary/5"
    >
      <span className="m-2 inline-block rounded bg-primary px-2 py-0.5 text-meta text-primary-foreground">
        Top Level
      </span>
    </div>
  );
};

const nodeTypes = { location: LocationNode, locationGroup: LocationGroupNode };
const edgeTypes = { floating: FloatingEdge };

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
  onIntent: (intent: CanvasIntent, mergeKey?: string) => void;
  onClose: () => void;
}) => {
  const [a, b] = connectionEnds(connection);
  const names = [nameOf(a), nameOf(b)] as const;
  return (
    <Panel position="top-right" className="!m-2 w-72 space-y-2 rounded-md border bg-card p-3 shadow-md">
      <div className="flex items-center gap-1">
        <Tip tip={`${names[0]} — ${names[1]}`} labelsChild={false}>
          <span className="min-w-0 flex-grow truncate text-label">
            {names[0]} — {names[1]}
          </span>
        </Tip>
        <Tip tip="Delete Connection">
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
            onClick={() => onIntent(deleteIntent(connection))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </Tip>
        <Tip tip="Close">
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </Tip>
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
          <Tip key={value} tip={label(...names)}>
            <ToggleGroupItem value={value} className="flex-1">
              <Icon className="h-4 w-4" />
            </ToggleGroupItem>
          </Tip>
        ))}
      </ToggleGroup>
      <Input
        value={connection.aiHint || ''}
        // A run of keystrokes on one record is one edit to undo, not one per letter.
        onChange={(e) => onIntent(hintIntent(connection, e.target.value), `hint:${connection.id}`)}
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

/**
 * The canvas's own right-click menu, standing in for the browser's. It carries what is being done to the map
 * and the choices that describe how it is drawn, so the surface itself stays free of chrome.
 *
 * Drawn as the groups `canvasMenuSections` hands over, ruled off from each other: walking an edit back, doing
 * something to what was clicked, and changing how the map is drawn are different kinds of thing, and one
 * unbroken run of rows leaves the author to work that out by trying.
 *
 * Radix owns the placement: portaled above the panels the canvas sits inside, flipped back into view at a
 * viewport edge, and dismissed, focused and walked by the arrows the way every other menu in the app is.
 */
const CanvasMenu = ({ sections, menuRef }: {
  sections: CanvasMenuSection[];
  /** Lets the keydown scope count the portaled menu as the canvas (see `trackPointer`). */
  menuRef: RefObject<HTMLDivElement>;
}) => (
  <ContextMenuContent ref={menuRef} aria-label="Canvas Options" className="min-w-44">
    {sections.map((section, index) => (
      <Fragment key={section.map((item) => item.label).join('|')}>
        {index > 0 && <ContextMenuSeparator />}
        {section[0]?.exclusive
          // One choice between each other, so the group is what carries which one is taken.
          ? (
            <ContextMenuRadioGroup value={section.find((item) => item.checked)?.label ?? ''}>
              {section.map((item) => (
                <ContextMenuRadioItem key={item.label} value={item.label} checked={item.checked} onSelect={item.onSelect}>
                  {item.label}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          )
          : section.map((item) => (item.checked === undefined
            ? (
              <ContextMenuItem key={item.label} disabled={item.disabled} onSelect={item.onSelect}>
                {/* The tick's column is held even by an action, so every label in the menu starts on one line. */}
                <Check className="h-4 w-4 shrink-0 opacity-0" />
                {item.label}
              </ContextMenuItem>
            )
            : (
              <ContextMenuCheckboxItem key={item.label} checked={item.checked} onSelect={item.onSelect}>
                {item.label}
              </ContextMenuCheckboxItem>
            )))}
      </Fragment>
    ))}
  </ContextMenuContent>
);

/**
 * Finding a location on a map too big to read. Full screen only: the pane shows a handful of boxes an author
 * can already see, and the window is where a world large enough to get lost in is worked on.
 *
 * Which locations a query names is `lib/locationSearch`'s answer, path and ordering included, so what counts
 * as a match is settled without a canvas. All this does is take the typing and hand back the chosen id.
 */
const LocationSearch = ({ find, onPick }: {
  find: (query: string) => LocationMatch[];
  onPick: (id: string) => void;
}) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const matches = useMemo(() => find(query), [find, query]);
  // A shrinking result list must not leave the highlight past its end — the next Enter would find nothing.
  const at = Math.min(active, Math.max(matches.length - 1, 0));

  const pick = (match: LocationMatch | undefined) => {
    if (!match) return;
    onPick(match.id);
    // The query stays: an author reading a name off the list is often on their way to the next one.
    setActive(0);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current + step + matches.length) % Math.max(matches.length, 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(matches[at]);
    }
    // Escape is deliberately not taken: it is the way out of the full-screen window everywhere else in the
    // app, and the dialog answers it before this box ever could.
  };

  const listId = 'canvas-search-results';
  return (
    // Below the toolbar on a window too narrow to hold both across: the tools span the top edge there, and a
    // box sitting under them is a box that cannot be typed into.
    <Panel position="top-left" className="!m-2 w-64 max-sm:!mt-16">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          placeholder="Find a Location"
          aria-label="Find a Location"
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls={listId}
          aria-activedescendant={matches.length ? `${listId}-${at}` : undefined}
          autoComplete="off"
          className="bg-card pl-8"
        />
      </div>
      {!!query.trim() && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching Locations"
          className="mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {matches.map((match, index) => (
            <li
              key={match.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === at}
              // Pressed rather than clicked: a click would land after the box had lost focus to it, and the
              // author's next keystroke would go nowhere.
              onMouseDown={(e) => { e.preventDefault(); pick(match); }}
              className={cn(
                'cursor-pointer rounded px-2 py-1.5 text-label',
                index === at ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <div className="truncate">{match.label}</div>
              {/* Where it sits, for the two rooms sharing a name that the map tells apart by their boxes. */}
              {!!match.path.length && (
                <div className="truncate text-meta text-muted-foreground">{match.path.join(' › ')}</div>
              )}
            </li>
          ))}
          {!matches.length && (
            <li className="px-2 py-1.5 text-meta text-muted-foreground">No locations match that name.</li>
          )}
        </ul>
      )}
    </Panel>
  );
};

/**
 * The whole map at a glance, with the pane's own view drawn on it — full screen only, where there is room for
 * it and a map big enough to need it. Colored from the app's own tokens rather than the library's defaults,
 * so it is the same map in either theme.
 */
const CanvasMiniMap = ({ onNavigate }: { onNavigate: (at: { x: number; y: number }) => void }) => {
  // A drag across the minimap ends in a click, and the library hands that click on with no idea a pan just
  // happened — taken at face value it would throw the view to wherever the finger came off. Where the press
  // began is what tells the two apart, exactly as it does for the canvas's own right button.
  const pressedAt = useRef<{ x: number; y: number } | null>(null);
  return (
    <div onPointerDownCapture={(e) => { pressedAt.current = { x: e.clientX, y: e.clientY }; }}>
      <MiniMap
        pannable
        zoomable
        ariaLabel="Locations Minimap"
        onClick={(event, position) => {
          if (isStationaryClick(pressedAt.current, { x: event.clientX, y: event.clientY })) onNavigate(position);
        }}
        bgColor="hsl(var(--muted))"
        maskColor="hsl(var(--background) / 0.6)"
        maskStrokeColor="hsl(var(--primary))"
        maskStrokeWidth={2}
        nodeColor="hsl(var(--muted-foreground))"
        nodeStrokeColor="hsl(var(--border))"
        className="!bottom-2 !right-2 rounded-md border shadow-md"
      />
    </div>
  );
};

/** The two edges a selection can be brought onto, and the two axes it can be spread along. Each carries how
 *  many boxes the command needs to mean anything: an edge takes two, an even spacing takes three. */
const ALIGN_TOOLS: { label: string; Icon: typeof AlignStartVertical; edge: AlignEdge }[] = [
  { label: 'Align Left', Icon: AlignStartVertical, edge: 'left' },
  { label: 'Align Top', Icon: AlignStartHorizontal, edge: 'top' },
];
const DISTRIBUTE_TOOLS: { label: string; Icon: typeof AlignStartVertical; axis: DistributeAxis }[] = [
  { label: 'Distribute Horizontally', Icon: AlignHorizontalDistributeCenter, axis: 'horizontal' },
  { label: 'Distribute Vertically', Icon: AlignVerticalDistributeCenter, axis: 'vertical' },
];

/** Which way an arrow key steps the selection: one grid cell, so the keyboard places a box exactly where a
 *  snapped drag would have. */
const NUDGES: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -CANVAS_GRID, y: 0 },
  ArrowRight: { x: CANVAS_GRID, y: 0 },
  ArrowUp: { x: 0, y: -CANVAS_GRID },
  ArrowDown: { x: 0, y: CANVAS_GRID },
};

/** The picker's shapes, drawn as what each one does to a line. */
const STYLE_ICONS: Record<ConnectionStyle, typeof Minus> = {
  straight: Minus,
  bezier: Spline,
  elbow: CornerDownRight,
};

/**
 * The window's power tools, gathered along its top: the layout commands, the finishing moves for a selection,
 * and the two switches and the picker the right-click menu also carries.
 *
 * Full screen only. Every control here reads and writes the same preference or the same world path the menu
 * does — the toolbar is a second place to reach them, never a second answer.
 */
const CanvasToolbar = ({
  arrangeLabel, onArrange, alignable, distributable, onAlign, onDistribute,
  snap, setSnap, gridVisible, setGridVisible, connectionStyle, setConnectionStyle,
  canUndo, canRedo, onUndo, onRedo,
}: {
  arrangeLabel: string;
  onArrange: () => void;
  alignable: boolean;
  distributable: boolean;
  onAlign: (edge: AlignEdge) => void;
  onDistribute: (axis: DistributeAxis) => void;
  snap: boolean;
  setSnap: (next: boolean) => void;
  gridVisible: boolean;
  setGridVisible: (next: boolean) => void;
  connectionStyle: ConnectionStyle;
  setConnectionStyle: (next: ConnectionStyle) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) => (
  // Scrolls sideways rather than spilling off a narrow window: every tool stays reachable at any width, and
  // the row keeps its own height so the search box beneath it has a fixed place to sit.
  <Panel position="top-center" className="!m-2 max-w-[calc(100%-1rem)] overflow-x-auto">
    <div
      role="toolbar"
      aria-label="Canvas Tools"
      className="flex w-max items-center gap-1 rounded-md border bg-card p-1 shadow-md"
    >
      <Tip tip={arrangeLabel} labelsChild={false}>
        <Button variant="ghost" size="sm" onClick={onArrange}>
          <LayoutGrid className="mr-1.5 h-4 w-4" />
          {arrangeLabel}
        </Button>
      </Tip>
      <Separator orientation="vertical" className="mx-0.5 h-6" />
      {ALIGN_TOOLS.map(({ label, Icon, edge }) => (
        <Tip key={edge} tip={label}>
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            disabled={!alignable} onClick={() => onAlign(edge)}
          >
            <Icon className="h-4 w-4" />
          </Button>
        </Tip>
      ))}
      {DISTRIBUTE_TOOLS.map(({ label, Icon, axis }) => (
        <Tip key={axis} tip={label}>
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            disabled={!distributable} onClick={() => onDistribute(axis)}
          >
            <Icon className="h-4 w-4" />
          </Button>
        </Tip>
      ))}
      <Separator orientation="vertical" className="mx-0.5 h-6" />
      {/* Two switches rather than a choice between them: either can be had without the other. Plain pressed
          buttons rather than a multiple ToggleGroup, which is itself a toolbar and would nest one in this. */}
      {([
        { label: 'Snap To Grid', Icon: Magnet, on: snap, set: setSnap },
        { label: 'Show Grid', Icon: Grid2x2, on: gridVisible, set: setGridVisible },
      ] as const).map(({ label, Icon, on, set }) => (
        <Tip key={label} tip={label}>
          <Button
            variant={on ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8"
            aria-pressed={on} onClick={() => set(!on)}
          >
            <Icon className="h-4 w-4" />
          </Button>
        </Tip>
      ))}
      <Separator orientation="vertical" className="mx-0.5 h-6" />
      <ToggleGroup
        type="single"
        className="h-8 gap-0.5 p-0.5"
        value={connectionStyle}
        aria-label="Connection Style"
        // A single group clears its value when the active item is clicked again; the arrows always have some
        // shape, so an empty result is ignored rather than stored.
        onValueChange={(value) => { if (isConnectionStyle(value)) setConnectionStyle(value); }}
      >
        {CONNECTION_STYLES.map(({ value, label }) => {
          const Icon = STYLE_ICONS[value];
          return (
            <Tip key={value} tip={label}>
              <ToggleGroupItem value={value} className="h-7 px-2">
                <Icon className="h-4 w-4" />
              </ToggleGroupItem>
            </Tip>
          );
        })}
      </ToggleGroup>
      <Separator orientation="vertical" className="mx-0.5 h-6" />
      {/* The keyboard's own pair, made visible. Trailing the row rather than leading it: these walk back what
          every tool to their left just did, and an empty stack says so by greying out rather than vanishing. */}
      {([
        { label: 'Undo', Icon: Undo2, can: canUndo, act: onUndo },
        { label: 'Redo', Icon: Redo2, can: canRedo, act: onRedo },
      ] as const).map(({ label, Icon, can, act }) => (
        <Tip key={label} tip={label}>
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            disabled={!can} onClick={act}
          >
            <Icon className="h-4 w-4" />
          </Button>
        </Tip>
      ))}
    </div>
  </Panel>
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
  /** What Ctrl+Z walks back. A ref rather than state — nothing on the map is drawn from the stack, and the
   *  trip to full screen has to carry it as it carries the selection. */
  historyRef: React.MutableRefObject<CanvasHistory>;
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
  const { locations, setLocations, connections, setConnections, placeholders, placementLetters, placeholderOwners } = useGameData();
  const {
    selectedIdsRef, lastSyncedRef, reportSelection, wake, historyRef, selectedConnectionId,
    setSelectedConnectionId,
  } = session;
  const store = useStoreApi();
  const { fitView, setCenter, getInternalNode, getZoom } = useReactFlow();
  const reduceMotion = usePrefersReducedMotion();
  const [snap, setSnap] = useCanvasSnap();
  const [gridVisible, setGridVisible] = useCanvasGridVisible();
  const [connectionStyle, setConnectionStyle] = useCanvasConnectionStyle();
  // What the next menu will be a menu of. Radix owns whether one is open and where; all this holds is which
  // target the right-click that is about to open it landed on.
  const [menuTarget, setMenuTarget] = useState<MenuTarget>({ kind: 'pane' });
  // The box the map has just traveled to, and the wait before it stops being marked.
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Where the pointer last went down, which is what says whether the press that opened a menu had traveled.
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  // Set while a hold's own release is still to come: the click it raises belongs to the hold, not to the
  // location under it. Held as the listener itself so a hold that ends in a drag can take it back down.
  const swallowClickRef = useRef<((event: Event) => void) | null>(null);
  // Whether the canvas is the surface the author is working on, which is what its keys answer to.
  const activeRef = useRef(false);

  // Says what the menu about to open is a menu of, and lets the event travel on to the Radix trigger that
  // opens it. The menu belongs to a right-click that stayed put; a right-drag was a pan, and the platform
  // asks for a menu on its release too — that one is stopped here, so the trigger never hears it.
  const openMenu = useCallback((event: React.MouseEvent | MouseEvent, target: MenuTarget) => {
    if (!isStationaryClick(pointerDownRef.current, { x: event.clientX, y: event.clientY })) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    setMenuTarget(target);
  }, []);

  // Set while the frame is re-raising a right-click of its own, so that press is left alone the second time.
  const reraisingRef = useRef(false);

  /**
   * Right-clicking the open pane reaches the trigger already defaulted: the pane pans with the right button,
   * so xyflow answers every right-click over it by killing the browser's menu — and Radix, like every
   * composed handler, passes on an event something has already spoken for. The press is raised again from
   * the frame itself, which is the one the trigger is listening to, so the menu opens where it was asked for.
   */
  const reraiseForTrigger = (event: React.MouseEvent) => {
    if (reraisingRef.current) { reraisingRef.current = false; return; }
    // The chrome floating over the map — the toolbar, the search box, an arrow's panel — is not the map, and
    // a menu about how the map is drawn is not what a right-click there is asking for.
    if ((event.target as HTMLElement).closest?.('.react-flow__panel, input, textarea, [contenteditable]')) {
      event.preventDefault();
      return;
    }
    // A right-drag was a pan; the menu its release asks for is not one the author wanted.
    if (!isStationaryClick(pointerDownRef.current, { x: event.clientX, y: event.clientY })) return;
    if (!event.defaultPrevented) return;
    const frame = frameRef.current;
    if (!frame) return;
    reraisingRef.current = true;
    frame.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, clientX: event.clientX, clientY: event.clientY, button: 2,
    }));
  };

  // One reading of a location's name, for the map, the inspector's header and the search box alike: what the
  // author sees written on a box is what they search for and what an arrow's panel calls it.
  const resolveName = useCallback(
    (location: GameLocation) => labelPlaceholders(location.name, placeholders, placementLetters, placeholderOwners) || UNNAMED_LOCATION,
    [placeholders, placementLetters, placeholderOwners],
  );

  const nameOf = useCallback(
    (id: string) => {
      const found = locations.find((l) => l.id === id);
      return found ? resolveName(found) : UNNAMED_LOCATION;
    },
    [locations, resolveName],
  );

  const map = useMemo(
    () => buildLocationCanvas(locations, connections, { resolveName }),
    [locations, connections, resolveName],
  );

  const findLocations = useCallback(
    (query: string) => searchLocations(locations, query, { resolveName }),
    [locations, resolveName],
  );

  /**
   * Traveling to a location: the map centers on its box and the box is marked, because a map that simply
   * moved would leave the author reading every name in the middle of the pane to find the one they asked for.
   * The zoom is the author's own, only opened up far enough that the name they landed on can be read.
   */
  const revealLocation = useCallback((id: string) => {
    const node = getInternalNode(id);
    if (!node) return;
    const { x, y } = node.internals.positionAbsolute;
    setCenter(x + (node.measured.width ?? 0) / 2, y + (node.measured.height ?? 0) / 2, {
      zoom: Math.max(getZoom(), 0.8),
      duration: reduceMotion ? 0 : 400,
    });
    setFlashId(id);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), FLASH_MS);
  }, [getInternalNode, setCenter, getZoom, reduceMotion]);

  useEffect(() => () => { if (flashTimer.current) window.clearTimeout(flashTimer.current); }, []);

  // Selection follows the record, not the arrow: a flip rewrites the record's ends and swaps which arrows
  // exist, so the panel would close under the author's hand if it were pinned to an arrow's id.
  const selectedConnection = connections.find((c) => c.id === selectedConnectionId) ?? null;

  // The stack itself is a ref — nothing on the map is drawn from it — but the chrome that offers it is, so
  // what each side holds is mirrored here and read back after every edit and every step taken.
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const syncHistory = useCallback(() => {
    const { past, future } = historyRef.current;
    setHistory({ canUndo: past.length > 0, canRedo: future.length > 0 });
  }, [historyRef]);
  // The stack outlives this component: arriving at a canvas mid-session finds whatever the last one left.
  useEffect(syncHistory, [syncHistory]);

  // Every write the canvas makes goes through one of these two, which is what leaves the stack holding the map's
  // whole edit history rather than the part of it someone remembered to record.
  const commitLocations = useCallback((next: GameLocation[], mergeKey?: string) => {
    historyRef.current = recordCanvasEdit(historyRef.current, {
      slice: 'locations', before: locations, after: next, mergeKey,
    });
    syncHistory();
    setLocations(next);
  }, [locations, setLocations, historyRef, syncHistory]);

  const commitConnections = useCallback((next: Connection[], mergeKey?: string) => {
    historyRef.current = recordCanvasEdit(historyRef.current, {
      slice: 'connections', before: connections, after: next, mergeKey,
    });
    syncHistory();
    setConnections(next);
  }, [connections, setConnections, historyRef, syncHistory]);

  const applyIntent = useCallback((intent: CanvasIntent | null, mergeKey?: string) => {
    if (!intent) return;
    commitConnections(applyCanvasIntent(connections, intent), mergeKey);
    if (intent.kind === 'add') setSelectedConnectionId(intent.connection.id); // a fresh one opens for annotation
    else if (intent.kind === 'remove') setSelectedConnectionId(null);
  }, [connections, commitConnections, setSelectedConnectionId]);

  // A dashed arrow is a click away from being authored; a solid one opens the record it came from.
  const handleEdgeClick = useCallback((_: unknown, edge: Edge) => {
    const clicked = map.edges.find((e) => e.id === edge.id);
    if (!clicked) return;
    if (clicked.connectionId) setSelectedConnectionId(clicked.connectionId);
    else applyIntent(connectIntent(clicked.source, clicked.target, connections));
  }, [map, connections, applyIntent, setSelectedConnectionId]);

  const [nodes, setNodes, onNodesChange] = useNodesState<LocationNodeType>([]);

  // What the toolbar and the keyboard act on. Read off the nodes rather than tracked beside them: every way a
  // selection can be composed — the marquee, a Shift-click, a hold, Ctrl+A — already lands there.
  const selectedIds = useMemo(() => nodes.filter((node) => node.selected).map((node) => node.id), [nodes]);

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
    () => map.edges.map(
      (edge) => toFlowEdge(edge, connectionStyle, { selected: edge.connectionId === selectedConnectionId }),
    ),
    [map, selectedConnectionId, connectionStyle],
  );

  const [dropInto, setDropInto] = useState<DropTarget>(IDLE);

  /**
   * The leaf a drag is resting on, once it has rested long enough. A childless location is a name rather than
   * a container, so it takes a drop only on purpose — the wait is what tells "dropping this in here" apart
   * from "on my way past". Moving to another leaf, or off every leaf, disarms at once.
   *
   * The clock lives here and nowhere near the drop logic: which leaf is armed is all the rules need to know.
   */
  const [armedLeaf, setArmedLeaf] = useState<string | null>(null);
  const dwellRef = useRef<{ over: string | null; timer: number | null }>({ over: null, timer: null });
  const dwellOn = useCallback((candidate: string | null) => {
    const dwell = dwellRef.current;
    if (dwell.over === candidate) return;
    if (dwell.timer) window.clearTimeout(dwell.timer);
    dwell.over = candidate;
    setArmedLeaf(null);
    dwell.timer = candidate === null
      ? null
      : window.setTimeout(() => setArmedLeaf(candidate), NEST_DWELL_MS);
  }, []);
  useEffect(() => () => { if (dwellRef.current.timer) window.clearTimeout(dwellRef.current.timer); }, []);

  // The drag asks for the drops it would make, on every frame — so the boxes an author watched light up are
  // the boxes the drop then commits to, from the one answer rather than from two that agree by inspection.
  // A selection is judged a location at a time here exactly as it is on release, so a gesture carrying one
  // location into a box and another out of one says both things at once.
  /** The map measured once at drag start; every frame and the release judge against it. The ref outlives the
   *  frames without re-rendering, and `sessionFor` covers a frame arriving with no start seen. */
  const dragSessionRef = useRef<CanvasDragSession | null>(null);
  const sessionFor = useCallback(
    () => dragSessionRef.current ?? beginCanvasDrag(locations),
    [locations],
  );
  const handleDragStart = useCallback(() => {
    dragSessionRef.current = beginCanvasDrag(locations);
  }, [locations]);

  /** What the nodes a drag is carrying are asking the world to become — the one answer the highlight is drawn
   *  from and the drop is committed from, so the boxes an author watched light up are the boxes they get. */
  const dropsFor = useCallback((session: CanvasDragSession, moved: Node[]) => multiDropIntents(
    session, moved.map((n) => ({ id: n.id, position: n.position })), armedLeaf,
  ), [armedLeaf]);

  const handleDrag = useCallback((_: unknown, node: Node, dragged: Node[]) => {
    const session = sessionFor();
    const moved = dragged.length ? dragged : [node];
    // The leaf under the node the author is actually holding, never one traveling with it.
    dwellOn(leafTarget(session, node.id, node.position, moved.map((n) => n.id)));
    const drops = dropsFor(session, moved);
    setDropInto({
      active: true,
      into: drops.map((drop) => drop.parentId).filter((id): id is string => id !== null),
      toTopLevel: drops.some((drop) => drop.kind === 'reparent' && drop.parentId === null),
    });
  }, [sessionFor, dropsFor, dwellOn]);

  // A drag either moves a location or changes what holds it, and where it came to rest decides which — so
  // there is one gesture to learn, and the map edits the world's shape rather than only its arrangement.
  // A whole selection dragged at once is that one gesture, made of every node it carried.
  const handleDragStop = useCallback((_: unknown, node: Node, dragged: Node[]) => {
    setDropInto(IDLE);
    const session = sessionFor();
    dragSessionRef.current = null;
    const drops = dropsFor(session, dragged.length ? dragged : [node]);
    dwellOn(null);
    // One edit however many locations the armed leaf just came to hold, so one press puts them all back.
    if (drops.length) commitLocations(applyCanvasDrops(locations, drops));
  }, [locations, sessionFor, commitLocations, dropsFor, dwellOn]);

  // Reported by xyflow rather than tracked by us: the marquee and Shift-click both land here, so one reading
  // covers every way a selection can be composed.
  /** An armed leaf is where the drop goes, so no box behind it claims the same drop at the same time. */
  const dropHighlight = useMemo<DropTarget>(
    () => (armedLeaf ? { active: dropInto.active, into: [], toTopLevel: false } : dropInto),
    [dropInto, armedLeaf],
  );

  const handleSelectionChange = useCallback(({ nodes: picked }: { nodes: Node[] }) => {
    reportSelection(picked.map((n) => n.id));
  }, [reportSelection]);

  /** Walking the map's own edits back and forward, against the world as it stands — which is what leaves an
   *  edit made in the list panel in the meantime alone. Both surfaces read what is written here at once. */
  const travelHistory = useCallback((direction: 'undo' | 'redo') => {
    const world = { locations, connections };
    const step = direction === 'undo'
      ? undoCanvasEdit(historyRef.current, world)
      : redoCanvasEdit(historyRef.current, world);
    if (!step) return;
    historyRef.current = step.history;
    syncHistory();
    if (step.restore.slice === 'locations') setLocations(step.restore.locations);
    else setConnections(step.restore.connections);
  }, [historyRef, locations, connections, setLocations, setConnections, syncHistory]);

  /**
   * Which box the toolbar's Auto Arrange lays out: the selected group itself where the author picked one, the
   * group holding whatever they picked otherwise, and every group at once when nothing is picked at all — the
   * canvas background's own command, reached without having to clear the selection to find it.
   */
  const arrangeScope = (): string | null | undefined => {
    const picked = selectedIds[0];
    if (!picked) return undefined;
    if (locations.some((l) => holderOf(locations, l) === picked)) return picked;
    const location = locations.find((l) => l.id === picked);
    return location ? holderOf(locations, location) : undefined;
  };

  const arrangeFromToolbar = () => {
    const scope = arrangeScope();
    commitLocations(scope === undefined
      ? autoArrangeAll(locations, connections)
      : autoArrange(locations, connections, scope));
  };

  // Each of these is asked for on a selection that may turn out to have nothing to do — two boxes one of which
  // carries the other is one box to line up. A command that moved nothing is not a step to take back, so the
  // world it hands back untouched is left alone rather than pushed onto the stack as a press that does nothing.
  const commitIfMoved = useCallback((next: GameLocation[], mergeKey?: string) => {
    if (next !== locations) commitLocations(next, mergeKey);
  }, [commitLocations, locations]);

  const alignSelection = useCallback((edge: AlignEdge) => {
    commitIfMoved(alignLocations(locations, selectedIds, edge));
  }, [commitIfMoved, locations, selectedIds]);

  const distributeSelection = useCallback((axis: DistributeAxis) => {
    commitIfMoved(distributeLocations(locations, selectedIds, axis));
  }, [commitIfMoved, locations, selectedIds]);

  /**
   * The keyboard's own drag: the selection stepped one grid cell. A run of presses is one edit to take back
   * rather than one per press — keyed by what is being moved, so picking something else starts a fresh step.
   */
  const nudgeSelection = useCallback((delta: { x: number; y: number }) => {
    commitIfMoved(nudgeLocations(locations, selectedIds, delta), `nudge:${selectedIds.join(',')}`);
  }, [commitIfMoved, locations, selectedIds]);

  /** The map framed on what the author is working on, or on the whole world when they are working on none of
   *  it. Zoom is capped: three boxes filling the window tell an author less than three boxes in their place. */
  const zoomToSelection = useCallback(() => {
    const duration = reduceMotion ? 0 : 300;
    if (!selectedIds.length) return void fitView({ duration });
    fitView({ nodes: selectedIds.map((id) => ({ id })), padding: 0.3, maxZoom: 1.5, duration });
  }, [fitView, selectedIds, reduceMotion]);

  /**
   * The canvas's keys, live while it is the surface being worked on — the last pointer press decides that,
   * since the pane itself takes no focus. Typing into the Connection inspector is not the canvas's keyboard.
   */
  useEffect(() => {
    const focusing = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
    };
    // The toolbar's own picker walks its options with the arrows, so a press that lands there is the toolbar's
    // rather than the map's — stepping the selection under the author at the same time is two things per press.
    // Undo and the rest still answer: only the keys the chrome itself uses are handed over.
    const inChrome = (target: EventTarget | null) =>
      !!(target as HTMLElement | null)?.closest?.('[role="toolbar"]');
    const trackPointer = (event: PointerEvent) => {
      // The context menu portals out of the frame, but pressing its items is working on the map — without
      // this, picking Auto Arrange deadens the very next Ctrl+Z.
      const target = event.target as globalThis.Node;
      activeRef.current = !!frameRef.current?.contains(target) || !!menuRef.current?.contains(target);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!activeRef.current || focusing(event.target)) return;
      // In full screen, Escape is the way out of the window — a keypress meaning "leave" must not also empty
      // the selection the author is taking back to the pane with them.
      const travel = historyShortcut(event);
      const nudge = NUDGES[event.key];
      if (event.key === 'Escape') { if (!fullscreen) setSelection(() => false); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelection(() => true);
      } else if (travel) {
        event.preventDefault();
        travelHistory(travel);
      } else if (event.ctrlKey || event.metaKey || event.altKey) {
        // Every other chord belongs to the browser or the app around the map, not to the map.
      } else if (nudge && !inChrome(event.target)) {
        event.preventDefault(); // the arrows would otherwise scroll whatever the canvas is sitting in
        nudgeSelection(nudge);
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        zoomToSelection();
      }
    };
    document.addEventListener('pointerdown', trackPointer, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', trackPointer, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [setSelection, fullscreen, travelHistory, nudgeSelection, zoomToSelection]);

  /**
   * Composing a selection on a touch screen. Shift and Ctrl are what a mouse adds a location to a selection
   * with, and a small screen has neither — so a finger held still on a box does the same job, and the tap
   * that would otherwise open the location's editor is swallowed on the way out. Moving the finger is a drag
   * or a pan and cancels the hold, so nothing is toggled by a gesture that was going somewhere.
   */
  const holdToToggle = (overNode: Element, event: React.PointerEvent) => {
    const id = overNode.getAttribute('data-id');
    const from = { x: event.clientX, y: event.clientY };
    const done = () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', moved);
      window.removeEventListener('pointerup', done);
      window.removeEventListener('pointercancel', done);
    };
    const moved = (at: PointerEvent) => {
      if (!isStationaryClick(from, { x: at.clientX, y: at.clientY }, TOUCH_SLOP)) done();
    };
    const timer = window.setTimeout(() => {
      done();
      if (!id) return;
      const picked = new Set(selectedIdsRef.current);
      if (!picked.delete(id)) picked.add(id);
      setSelection((candidate) => picked.has(candidate));
      // Stopped on the way in, before React hands it to anything: the canvas and xyflow both read a tap on a
      // box as "this location alone", which is exactly the selection the hold just composed.
      swallowClickRef.current = (click: Event) => { click.stopPropagation(); click.preventDefault(); };
      frameRef.current?.addEventListener('click', swallowClickRef.current, { capture: true, once: true });
    }, LONG_PRESS_MS);
    window.addEventListener('pointermove', moved);
    window.addEventListener('pointerup', done);
    window.addEventListener('pointercancel', done);
  };

  /**
   * A pan that began over a location. xyflow listens for one on the pane, which sits *behind* the boxes, so
   * a press that started on a box never reaches it — and the map would refuse to move under exactly the
   * places an author is looking at. The gesture is the same one, driven from here.
   */
  const handlePointerDown = (event: React.PointerEvent) => {
    pointerDownRef.current = { x: event.clientX, y: event.clientY };
    wake();
    // A hold whose release never raised a click leaves one of these behind; the next press is where it goes.
    if (swallowClickRef.current) {
      frameRef.current?.removeEventListener('click', swallowClickRef.current, { capture: true });
      swallowClickRef.current = null;
    }
    const overNode = (event.target as HTMLElement).closest?.('.react-flow__node');
    if (overNode && event.pointerType === 'touch') holdToToggle(overNode, event);
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
   * What the menu offers for what it was opened on. Auto Arrange is offered on a box that holds something —
   * a leaf has nothing to lay out — and its recursive form on open canvas, which is the top level's own row.
   * Each writes the world once, so the arrangement is one edit rather than one per location moved.
   */
  const menuActions = (target: MenuTarget): CanvasMenuItem[] => {
    if (target.kind === 'node') {
      const items: CanvasMenuItem[] = [{
        label: 'Edit Location',
        onSelect: () => {
          setSelection((id) => id === target.id);
          lastSyncedRef.current = target.id;
          onSelect(target.id);
        },
      }];
      if (locations.some((l) => holderOf(locations, l) === target.id)) {
        items.push({
          label: 'Auto Arrange',
          onSelect: () => commitLocations(autoArrange(locations, connections, target.id)),
        });
      }
      return items;
    }
    if (target.kind === 'selection') {
      // The same finishing moves the toolbar carries, offered where the selection itself was right-clicked.
      // An even spacing needs three boxes to mean anything, so below that it is not offered at all.
      return [
        ...ALIGN_TOOLS.map(({ label, edge }) => ({ label, onSelect: () => alignSelection(edge) })),
        ...(selectedIds.length > 2
          ? DISTRIBUTE_TOOLS.map(({ label, axis }) => ({ label, onSelect: () => distributeSelection(axis) }))
          : []),
        { label: 'Clear Selection', onSelect: () => setSelection(() => false) },
      ];
    }
    return [
      { label: 'Select All Locations', onSelect: () => setSelection(() => true) },
      { label: 'Auto Arrange All', onSelect: () => commitLocations(autoArrangeAll(locations, connections)) },
    ];
  };

  return (
    // The frame is the menu's trigger, so the browser's own menu never opens over the canvas — Radix takes
    // every right-click the pane, a node or the selection did not already stop as a pan's release.
    <ContextMenu>
    <ContextMenuTrigger asChild>
    <div
      ref={frameRef}
      className="relative h-full w-full"
      onPointerDownCapture={handlePointerDown}
      onContextMenu={reraiseForTrigger}
    >
      <DropTargetContext.Provider value={dropHighlight}>
      <ArmedLeafContext.Provider value={armedLeaf}>
      <FlashContext.Provider value={flashId}>
      <ReactFlow<LocationNodeType, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStart={handleDragStart}
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
        onPaneClick={() => setSelectedConnectionId(null)}
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
        // Under the zoom controls rather than alone in the far corner, where a lone bit of text on open canvas
        // reads as something to press.
        attributionPosition="bottom-left"
        minZoom={0.2}
        fitView
        className="h-full w-full"
      >
        {/* The dots mark the grid's own intersections; hiding it keeps the pane's color and drops the pattern. */}
        <Background className="!bg-background" color={gridVisible ? 'hsl(var(--border))' : 'transparent'} gap={CANVAS_GRID} />
        {/* The embedded canvas's whole chrome: the zoom controls, and the way to the big one. Everything
            heavier belongs to full screen, so the quick view stays a view. */}
        <CanvasControls>
          <CanvasControlButton
            tip={fullscreen ? 'Exit Full Screen' : 'Edit Full Screen'}
            onClick={onToggleFullscreen}
          >
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
          </CanvasControlButton>
        </CanvasControls>
        <TopLevelDrop />
        {/* The window's own orientation aids and power tools. The pane is a view of a map the author can
            already take in; these are for the map that has grown past it. */}
        {fullscreen && (
          <CanvasToolbar
            arrangeLabel={arrangeScope() === undefined ? 'Auto Arrange All' : 'Auto Arrange'}
            onArrange={arrangeFromToolbar}
            alignable={selectedIds.length > 1}
            distributable={selectedIds.length > 2}
            onAlign={alignSelection}
            onDistribute={distributeSelection}
            snap={snap}
            setSnap={setSnap}
            gridVisible={gridVisible}
            setGridVisible={setGridVisible}
            connectionStyle={connectionStyle}
            setConnectionStyle={setConnectionStyle}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            onUndo={() => travelHistory('undo')}
            onRedo={() => travelHistory('redo')}
          />
        )}
        {fullscreen && <LocationSearch find={findLocations} onPick={revealLocation} />}
        {fullscreen && (
          <CanvasMiniMap
            onNavigate={(at) => setCenter(at.x, at.y, { duration: reduceMotion ? 0 : 200 })}
          />
        )}
        {selectedConnection && (
          <ConnectionInspector
            connection={selectedConnection}
            nameOf={nameOf}
            onIntent={applyIntent}
            onClose={() => setSelectedConnectionId(null)}
          />
        )}
      </ReactFlow>
      </FlashContext.Provider>
      </ArmedLeafContext.Provider>
      </DropTargetContext.Provider>
    </div>
    </ContextMenuTrigger>
    <CanvasMenu
      menuRef={menuRef}
      sections={canvasMenuSections(
        { ...history, snap, gridVisible, connectionStyle },
        {
          undo: () => travelHistory('undo'),
          redo: () => travelHistory('redo'),
          setSnap,
          setGridVisible,
          setConnectionStyle,
        },
        menuActions(menuTarget),
      )}
    />
    </ContextMenu>
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
  const { worldId } = useGameData();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const morph = useMorphFullscreen(hostRef);
  const selectedIdsRef = useRef<string[]>(props.selectedId ? [props.selectedId] : []);
  const lastSyncedRef = useRef<string | null>(props.selectedId);
  // Session-only, and nothing clears it: a save is not the end of what the author may still take back, so
  // undoing past one simply makes the world dirty again. Held for the open world rather than by this
  // component, which the trip to the list panel unmounts.
  const historyRef = canvasHistoryFor(worldId);
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
    selectedIdsRef, lastSyncedRef, reportSelection, wake, historyRef, selectedConnectionId,
    setSelectedConnectionId,
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
        fullscreen={morph.contentInOverlay}
        onToggleFullscreen={toggleFullscreen}
      />
    </ReactFlowProvider>
  );

  return (
    // The pane's own box stays laid out at its real size while the window is up: it is what the window grows
    // out of and shrinks back into, and a collapsed source has nothing to travel between.
    <div ref={hostRef} className="relative h-full w-full">
      {!morph.contentInOverlay && canvas}
      {morph.mounted && (
        <FullscreenShell
          morph={windowMorph}
          title="Locations Canvas"
          // The control that opened the window went with the canvas, so closing has to be told where to land.
          returnFocus={() => hostRef.current?.querySelector<HTMLElement>('.react-flow__controls button:last-child')}
        >
          {/* Handed back to the pane the moment closing starts: the window is a fading panel by then, and
              the docked canvas has to be under it from the first frame. */}
          <div className="min-h-0 flex-1">{morph.contentInOverlay ? canvas : null}</div>
        </FullscreenShell>
      )}
    </div>
  );
};

export default LocationCanvas;
