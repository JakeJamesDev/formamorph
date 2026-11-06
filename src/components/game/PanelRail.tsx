import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { SEGMENT_MOTION } from '@/components/ui/segmentMotion';
import type { CollapsingSegmentOption } from '@/components/ui/collapsing-segments';
import type { StoryWidth } from '@/lib/gamePanelPrefs';

export type PanelSide = 'left' | 'right';

/** Where a side panel renders: its place in the row, or its drawer over the narration. */
export type PanelPlacement = 'docked' | 'drawer';

/** One tab a rail lists, in the docked panel's tab-strip shape. */
export type RailTab = CollapsingSegmentOption<string>;

/** The right column starts below the header line, as the docked right panel does. */
const BELOW_HEADER = 'mt-[calc(var(--header-line)-1rem)]';

/** The rail's and the strip's widths, which also place and size the drawer. */
const RAIL_WIDTH = '4.5rem';
const STRIP_WIDTH = '0.75rem';
/** The game view's padding around the row. */
const VIEW_PADDING = '1rem';

/** Spread on the game view: the area whose clicks close an open drawer. */
export const GAME_VIEW_PROPS = { 'data-game-view': '' } as const;
const RAIL_TAB_ATTR = 'data-rail-tab';

/** A collapsed side panel: its tabs as labeled icons, with optional controls above them. Desktop only. */
export function PanelRail({ side, label, tabs, top, openTab, dots, onOpen, onClose }: {
  side: PanelSide;
  /** Names the rail for assistive technology, as the docked panel's tab list is named. */
  label: string;
  tabs: readonly RailTab[];
  /** Controls kept at the rail's top, above a divider. */
  top?: React.ReactNode;
  /** The tab its drawer shows, when the drawer is open. */
  openTab?: string;
  /** Tabs whose content changed since the player last saw them. */
  dots?: ReadonlySet<string>;
  onOpen?: (tab: string) => void;
  onClose?: () => void;
}) {
  // One pill marks the open tab and slides between tabs, as a segmented strip's does.
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const reducedMotion = usePrefersReducedMotion();
  // The rail marks a click itself, in a render of its own, so the pill starts before the drawer's heavier render.
  const [pressed, setPressed] = useState(openTab);
  const [seenOpenTab, setSeenOpenTab] = useState(openTab);
  if (seenOpenTab !== openTab) { setSeenOpenTab(openTab); setPressed(openTab); }
  const press = (value: string) => {
    const next = value === pressed ? undefined : value;
    flushSync(() => setPressed(next));
    if (next) onOpen?.(next); else onClose?.();
  };
  const [pill, setPill] = useState<{ top: number; height: number; slide: boolean } | null>(null);
  const shownRef = useRef(false);
  useLayoutEffect(() => {
    const button = pressed ? buttons.current.get(pressed) : undefined;
    // It slides only from one open tab to the next; opening from a closed rail, it fades in at its tab.
    if (button) setPill({ top: button.offsetTop, height: button.offsetHeight, slide: shownRef.current });
    else setPill((p) => p && { ...p, slide: true });
    shownRef.current = !!button;
  }, [pressed, tabs]);
  const pillShown = !!pressed && buttons.current.has(pressed);
  return (
    <nav
      aria-label={label}
      style={{ width: RAIL_WIDTH }}
      className={cn(
        'relative flex min-h-0 shrink-0 flex-col items-center gap-1 rounded-xl border border-border bg-background/60 p-1',
        // The left rail's foot clears the Hide UI button.
        side === 'left' ? 'pb-12' : BELOW_HEADER,
      )}
    >
      {/* The window drag band above the right column, as the docked panel keeps it. */}
      {side === 'right' && (
        <div aria-hidden className="game-right-column-drag pointer-events-none absolute inset-x-0 bottom-full h-[var(--header-line)]" />
      )}
      {top && (
        <>
          {top}
          <div aria-hidden className="my-1 h-px w-3/4 bg-border" />
        </>
      )}
      {pill && (
        <span
          aria-hidden
          data-rail-pill=""
          className={cn('pointer-events-none absolute inset-x-1 top-0 rounded-md bg-accent shadow-sm', !reducedMotion && SEGMENT_MOTION.pillY)}
          style={{
            height: pill.height,
            transform: `translateY(${pill.top}px)`,
            opacity: pillShown ? 1 : 0,
            ...(!pill.slide && { transitionProperty: 'opacity' }),
          }}
        />
      )}
      {tabs.map(({ value, icon: Icon, label: tabLabel }) => (
        <button
          key={value}
          ref={(el) => { if (el) buttons.current.set(value, el); else buttons.current.delete(value); }}
          type="button"
          {...{ [RAIL_TAB_ATTR]: '' }}
          aria-pressed={value === pressed}
          onClick={() => press(value)}
          // Above the pill, which alone fills the open tab.
          className={cn(RAIL_BUTTON, 'relative aria-pressed:text-foreground')}
        >
          <span className="relative">
            <Icon className="h-5 w-5" />
            {dots?.has(value) && (
              <span aria-hidden className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
            )}
          </span>
          <span className="text-meta leading-none">
            {tabLabel}
            {dots?.has(value) && <span className="sr-only">, changed</span>}
          </span>
        </button>
      ))}
    </nav>
  );
}

// A hover only lights the text, as on a segmented strip, so it never reads as the open tab.
const RAIL_BUTTON = 'flex h-14 w-full shrink-0 flex-col items-center justify-center gap-1 rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';

/** A rail control that acts rather than opens a tab, drawn like the rail's tabs. Its tip names the action in full. */
export function RailAction({ icon, label, tip, onClick }: {
  icon: React.ReactNode;
  label: string;
  tip: string;
  onClick: () => void;
}) {
  return (
    <Tip tip={tip} side="right">
      <button type="button" onClick={onClick} className={RAIL_BUTTON}>
        {icon}
        <span aria-hidden className="text-meta leading-none">{label}</span>
      </button>
    </Tip>
  );
}

/** The game view's root is the size container the docked widths read (`cqw`). */
export const GAME_VIEW_CONTAINER = '[container-type:inline-size]';

/** A docked side's width: a quarter of the row, as the panels always took, with the right one's minimum. */
const DOCKED_WIDTH: Record<PanelSide, string> = {
  left: '25cqw',
  right: 'max(25cqw, var(--game-right-column-min))',
};
const sideWidth = (side: PanelSide, docked: boolean) => (docked ? DOCKED_WIDTH[side] : RAIL_WIDTH);

/** A side's width move, and the fade-in of what arrives, start on the click and take this long. */
const MOVE_MS = 200;
const EASE = 'cubic-bezier(0.2, 0, 0, 1)';

/** Where a side is in a collapse or dock. */
export interface SideMotion {
  /** Shows the docked panel; false shows the rail. */
  docked: boolean;
  /** The width moves and the new content fades in. */
  moving: boolean;
  reducedMotion: boolean;
}

/** Steps one side through a collapse or dock: the width moves at once, as the new content fades in. */
export function useSideMotion(collapsed: boolean, reducedMotion: boolean): SideMotion {
  const [shownCollapsed, setShownCollapsed] = useState(collapsed);
  const [moving, setMoving] = useState(false);
  // Set while rendering, so the move's first frame already clips and positions the column.
  if (shownCollapsed !== collapsed) {
    setShownCollapsed(collapsed);
    if (!reducedMotion) setMoving(true);
  }
  useEffect(() => {
    if (!moving) return;
    const end = setTimeout(() => setMoving(false), MOVE_MS);
    return () => clearTimeout(end);
  }, [moving, shownCollapsed]);
  return { docked: !collapsed, moving, reducedMotion };
}

const moveTransition = (motion: SideMotion, property: string) =>
  (motion.reducedMotion ? 'none' : `${property} ${MOVE_MS}ms ${EASE}`);

/** The narrowest the story gets to stay centered; below it, it shifts toward the wider gap instead. */
const CENTERED_MIN = '36rem';

/** A ref for the game header's buttons: keeps their width in `--game-header-width` on the game view. */
export function useHeaderWidthVar() {
  const observer = useRef<ResizeObserver | null>(null);
  return React.useCallback((el: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    const view = el?.parentElement;
    if (!el || !view) return;
    const set = () => view.style.setProperty('--game-header-width', `${el.offsetWidth}px`);
    set();
    if (typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(set);
    observer.current.observe(el);
  }, []);
}

/** How far the header's buttons reach in from the view's right edge, with a gap before the story. */
const HEADER_REACH = 'calc(0.5rem + var(--window-buttons-width, 0px) + var(--game-header-width, 0px) + 0.5rem)';

/**
 * Holds the narration. At Reading Width it stays centered on the game view as the sides change: padding on
 * the narrower side makes up the difference, worked out from the same widths and moved on the same curve, so
 * the story holds still. It narrows to stay centered, down to a floor. Beside the right rail, Full Width starts
 * below the header's buttons, and Full Height stops short of them.
 */
export function NarrationColumn({ left, right, width, children }: {
  left: SideMotion;
  right: SideMotion;
  width: StoryWidth;
  children: React.ReactNode;
}) {
  const l = sideWidth('left', left.docked);
  const r = sideWidth('right', right.docked);
  // The column between the sides: the row less both sides, both strips and both side margins.
  const column = `(100cqw - ${l} - ${r} - 2 * ${STRIP_WIDTH} - 0.5rem)`;
  const pad = (wider: string, narrower: string) => `clamp(0px, calc(${wider} - ${narrower}), calc(${column} - ${CENTERED_MIN}))`;
  // Where the column ends, measured in from the view's right edge: the view padding, the right side, its margin and strip.
  const columnEnd = `(${VIEW_PADDING} + ${r} + 0.25rem + ${STRIP_WIDTH})`;
  const motion = left.moving ? left : right;
  const beside = !right.docked;
  const padding: React.CSSProperties = width === 'reading'
    ? { paddingLeft: pad(r, l), paddingRight: pad(l, r) }
    : { paddingLeft: 0, paddingRight: width === 'fullHeight' && beside ? `max(0px, calc(${HEADER_REACH} - ${columnEnd}))` : 0 };
  return (
    <div
      className="flex min-h-0 min-w-0 basis-0 flex-grow justify-center"
      style={{
        ...padding,
        marginTop: width === 'full' && beside ? 'calc(var(--header-line) - 1rem)' : 0,
        transition: motion.reducedMotion ? 'none' : `${moveTransition(motion, 'padding')}, ${moveTransition(motion, 'margin-top')}`,
      }}
    >
      {children}
    </div>
  );
}

/**
 * One side of the game row, docked or as its rail, stepped by `useSideMotion`. The panel keeps one mount
 * through every change, so a model in it never reloads.
 */
export function SideColumn({ side, motion, rail, panel }: {
  side: PanelSide;
  motion: SideMotion;
  rail: React.ReactNode;
  /** The panel, told whether it shows docked; collapsed, it is the side's drawer or stowed. */
  panel: (docked: boolean) => React.ReactNode;
}) {
  const { docked, moving, reducedMotion } = motion;
  const fade: React.CSSProperties = !reducedMotion && moving ? { animation: `side-fade-in ${MOVE_MS}ms ${EASE}` } : {};
  return (
    <div
      data-side-column={side}
      // Positioned only while it holds the docked panel or moves; a collapsed side's drawer places itself on the view.
      className={cn('flex min-h-0 shrink-0', (docked || moving) && 'relative', moving && 'overflow-hidden', side === 'left' ? 'mr-1' : 'ml-1')}
      style={{ width: sideWidth(side, docked), transition: moveTransition(motion, 'width') }}
    >
      {!docked && <div className="flex min-h-0 shrink-0" style={{ ...fade, width: RAIL_WIDTH }}>{rail}</div>}
      {/* Docked, the panel keeps its full width while the column grows, so it reveals rather than squeezes. */}
      <div
        className={docked ? cn('absolute inset-y-0 flex', side === 'left' ? 'left-0' : 'right-0') : 'contents'}
        style={docked ? { ...fade, width: DOCKED_WIDTH[side] } : undefined}
      >
        {panel(docked)}
      </div>
    </div>
  );
}

/** The thin strip between a side and the narration that collapses or docks that side. */
export function EdgeToggle({ side, collapsed, onToggle, belowHeader = side === 'right' }: {
  side: PanelSide;
  collapsed: boolean;
  onToggle: () => void;
  /** Starts below the header line, as the right column does. */
  belowHeader?: boolean;
}) {
  const label = collapsed ? 'Dock Panel' : 'Collapse Panel';
  // The chevron points the way the side will move.
  const Icon = (side === 'left') !== collapsed ? ChevronLeft : ChevronRight;
  return (
    <Tip tip={label} side={side === 'left' ? 'right' : 'left'}>
      <button
        type="button"
        onClick={onToggle}
        style={{ width: STRIP_WIDTH }}
        className={cn(
          'group flex shrink-0 items-center justify-center self-stretch rounded-full text-muted-foreground hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
          belowHeader && BELOW_HEADER,
        )}
      >
        <span aria-hidden className="h-10 w-1 rounded-full bg-border group-hover:hidden group-focus-visible:hidden" />
        <Icon aria-hidden className="hidden h-4 w-4 group-hover:block group-focus-visible:block" />
      </button>
    </Tip>
  );
}

/** Holds the strip's place in the row while the strip sits on its side's open drawer. */
export function EdgeToggleSpacer() {
  return <div aria-hidden className="shrink-0" style={{ width: STRIP_WIDTH }} />;
}

/**
 * Where a side's panel lives: in the row while docked, over the narration as a drawer, or stowed out of
 * sight while the side is collapsed and its drawer closed. The panel keeps one mount through all three,
 * so its Entity View never reloads its model.
 */
export type PanelHostMode = 'docked' | 'drawer' | 'stowed';

/**
 * One side's panel host. As a drawer it sits over the narration, flush against that side's rail, with the
 * side's strip on its inner edge. A click elsewhere in the game view or an unclaimed Escape closes it;
 * clicks in portaled dialogs and popovers land outside the game view, so they leave it open.
 */
export function PanelDrawer({ side, mode = 'drawer', onClose, onDock, children }: {
  side: PanelSide;
  mode?: PanelHostMode;
  onClose: () => void;
  /** Docks the side on the drawer's tab. */
  onDock: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  const open = mode === 'drawer';
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || ref.current?.contains(target)) return;
      // A rail icon opens, switches or closes the drawer itself.
      if (target.closest(`[${RAIL_TAB_ATTR}]`) || !target.closest('[data-game-view]')) return;
      closeRef.current();
    };
    // An open dialog or popover claims its Escape first.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) closeRef.current();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const docked = mode === 'docked';
  const strip = open && <EdgeToggle side={side} collapsed onToggle={onDock} belowHeader={false} />;
  // Every mode renders the same element tree, so a mode change never remounts the panel.
  return (
    <div
      ref={ref}
      // Stowed, the panel stays mounted but takes no space and leaves the accessibility tree.
      hidden={mode === 'stowed'}
      className={docked ? 'contents' : cn(
        // The strip sits on the drawer's surface, so its grip reads over the narration.
        'absolute bottom-4 z-20 flex bg-background/95 shadow-xl backdrop-blur-sm motion-reduce:animate-none',
        // Shown again from `hidden`, it replays the open.
        side === 'left' ? 'animate-[drawer-open-left_150ms_cubic-bezier(0,0,0.2,1)]' : 'animate-[drawer-open-right_150ms_cubic-bezier(0,0,0.2,1)]',
        side === 'left' ? 'top-4 rounded-r-xl' : 'top-[var(--header-line)] rounded-l-xl',
        mode === 'stowed' && '!hidden',
      )}
      // Flush to the rail, and as wide as the docked panel (a quarter of the row, with its own minimum) plus the strip.
      style={docked ? undefined : {
        [side]: `calc(${VIEW_PADDING} + ${RAIL_WIDTH})`,
        width: `calc((100% - 2 * ${VIEW_PADDING}) / 4 + ${STRIP_WIDTH})`,
        minWidth: side === 'right' ? `calc(var(--game-right-column-min) + ${STRIP_WIDTH})` : undefined,
      }}
    >
      {side === 'right' && strip}
      {/* Docked, the host adds no box: the panel sits in the row as it always has. */}
      <div className={docked ? 'contents' : 'flex min-w-0 flex-1 flex-col'}>{children}</div>
      {side === 'left' && strip}
    </div>
  );
}
