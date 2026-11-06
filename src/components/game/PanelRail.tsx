import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { CollapsingSegmentOption } from '@/components/ui/collapsing-segments';

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
  return (
    <nav
      aria-label={label}
      style={{ width: RAIL_WIDTH }}
      className={cn(
        'relative flex min-h-0 shrink-0 flex-col items-center gap-1 rounded-xl border border-border bg-background/60 p-1',
        // The left rail's foot clears the Hide UI button.
        side === 'left' ? 'mr-1 pb-12' : cn('ml-1', BELOW_HEADER),
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
      {tabs.map(({ value, icon: Icon, label: tabLabel }) => (
        <button
          key={value}
          type="button"
          {...{ [RAIL_TAB_ATTR]: '' }}
          aria-pressed={value === openTab}
          onClick={() => (value === openTab ? onClose?.() : onOpen?.(value))}
          className={cn(RAIL_BUTTON, 'aria-pressed:bg-accent aria-pressed:text-foreground')}
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

const RAIL_BUTTON = 'flex h-14 w-full shrink-0 flex-col items-center justify-center gap-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';

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

/** The narrowest the narration gets to stay centered; below it, it shifts toward the wider gap instead. */
const CENTERED_MIN_REM = 36;

/**
 * Holds the narration and centers it on the game view, so collapsing one side doesn't move it. It narrows
 * to stay centered, down to a floor, and never grows past its own maximum.
 */
export function NarrationColumn({ layout, children }: {
  /** Changes when a side collapses or docks, so the column re-centers in the same commit. */
  layout: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inset, setInset] = useState({ left: 0, right: 0 });
  useLayoutEffect(() => {
    const column = ref.current;
    const view = column?.closest('[data-game-view]');
    const panel = column?.firstElementChild;
    if (!column || !view || !(panel instanceof HTMLElement)) return;
    const place = () => {
      const box = column.getBoundingClientRect();
      const viewBox = view.getBoundingClientRect();
      const max = parseFloat(getComputedStyle(panel).maxWidth);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const floor = Number.isFinite(rem) ? CENTERED_MIN_REM * rem : 0;
      const center = viewBox.left + viewBox.width / 2;
      const fits = 2 * Math.min(center - box.left, box.right - center);
      const width = Math.min(box.width, Number.isFinite(max) ? max : box.width, Math.max(fits, floor));
      const left = Math.max(0, Math.min(center - width / 2 - box.left, box.width - width));
      // Without a layout (no size to measure) the column keeps no inset.
      if (!(width > 0) || !Number.isFinite(left)) { setInset({ left: 0, right: 0 }); return; }
      setInset({ left: Math.round(left), right: Math.round(box.width - width - left) });
    };
    place();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(place);
    observer.observe(column);
    observer.observe(view);
    return () => observer.disconnect();
  }, [layout]);
  return (
    <div ref={ref} className="flex min-h-0 min-w-0 basis-0 flex-grow" style={{ paddingLeft: inset.left, paddingRight: inset.right }}>
      {children}
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
 * One side's panel shown over the narration, flush against that side's rail, with the side's strip on its
 * inner edge. A click elsewhere in the game view or an unclaimed Escape closes it; clicks in portaled
 * dialogs and popovers land outside the game view, so they leave it open.
 */
export function PanelDrawer({ side, onClose, onDock, children }: {
  side: PanelSide;
  onClose: () => void;
  /** Docks the side on the drawer's tab. */
  onDock: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
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
  }, []);

  const strip = <EdgeToggle side={side} collapsed onToggle={onDock} belowHeader={false} />;
  return (
    <div
      ref={ref}
      className={cn(
        // The strip sits on the drawer's surface, so its grip reads over the narration.
        'absolute bottom-4 z-20 flex bg-background/95 shadow-xl backdrop-blur-sm',
        side === 'left' ? 'top-4 rounded-r-xl' : 'top-[var(--header-line)] rounded-l-xl',
      )}
      // Flush to the rail, and as wide as the docked panel (a quarter of the row, with its own minimum) plus the strip.
      style={{
        [side]: `calc(${VIEW_PADDING} + ${RAIL_WIDTH})`,
        width: `calc((100% - 2 * ${VIEW_PADDING}) / 4 + ${STRIP_WIDTH})`,
        minWidth: side === 'right' ? `calc(var(--game-right-column-min) + ${STRIP_WIDTH})` : undefined,
      }}
    >
      {side === 'right' && strip}
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {side === 'left' && strip}
    </div>
  );
}
