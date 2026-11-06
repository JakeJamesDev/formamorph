import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { CollapsingSegmentOption } from '@/components/ui/collapsing-segments';

export type PanelSide = 'left' | 'right';

/** One tab a rail lists, in the docked panel's tab-strip shape. */
export type RailTab = CollapsingSegmentOption<string>;

/** The right column starts below the header line, as the docked right panel does. */
const BELOW_HEADER = 'mt-[calc(var(--header-line)-1rem)]';

/** A collapsed side panel: its tabs as labeled icons, with optional controls above them. Desktop only. */
export function PanelRail({ side, label, tabs, top }: {
  side: PanelSide;
  /** Names the rail for assistive technology, as the docked panel's tab list is named. */
  label: string;
  tabs: readonly RailTab[];
  /** Controls kept at the rail's top, above a divider. */
  top?: React.ReactNode;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        'relative flex w-[4.5rem] min-h-0 shrink-0 flex-col items-center gap-1 rounded-xl border border-border bg-background/60 p-1',
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
          aria-pressed={false}
          className="flex h-14 w-full shrink-0 flex-col items-center justify-center gap-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <Icon className="h-5 w-5" />
          <span className="text-meta leading-none">{tabLabel}</span>
        </button>
      ))}
    </nav>
  );
}

/** The thin strip between a side and the narration that collapses or docks that side. */
export function EdgeToggle({ side, collapsed, onToggle }: {
  side: PanelSide;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const label = collapsed ? 'Dock Panel' : 'Collapse Panel';
  // The chevron points the way the side will move.
  const Icon = (side === 'left') !== collapsed ? ChevronLeft : ChevronRight;
  return (
    <Tip tip={label} side={side === 'left' ? 'right' : 'left'}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'group flex w-3 shrink-0 items-center justify-center self-stretch rounded-full text-muted-foreground hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
          side === 'right' && BELOW_HEADER,
        )}
      >
        <span aria-hidden className="h-10 w-1 rounded-full bg-border group-hover:hidden group-focus-visible:hidden" />
        <Icon aria-hidden className="hidden h-4 w-4 group-hover:block group-focus-visible:block" />
      </button>
    </Tip>
  );
}
