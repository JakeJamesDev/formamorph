import { Fragment, useRef, useState } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EdgeRailTab {
  value: string;
  label: string;
  icon: LucideIcon;
}

export interface EdgeRailGroup {
  id: string;
  label: string;
  tabs: readonly EdgeRailTab[];
}

export interface EdgeRailProps {
  /** The groups in rail order. A group with no tabs draws nothing. */
  groups: readonly EdgeRailGroup[];
  /** The active tab, which carries the accent bar. */
  value: string;
  /** Draws every tab disabled, leaving the selection as it is. */
  disabled?: boolean;
  label?: string;
  className?: string;
}

/** A full-height icon tab list on a view's outer edge. Must sit inside a vertical `Tabs` root. */
export function EdgeRail({ groups, value, disabled, label = 'Editor Sections', className }: EdgeRailProps) {
  const [flyout, setFlyout] = useState<string | null>(null);
  // Focus that a click brought shows no flyout; only hover and keyboard focus do.
  const pointerFocus = useRef(false);
  const hide = (tab: string) => setFlyout((shown) => (shown === tab ? null : shown));
  const drawn = groups.filter((group) => group.tabs.length > 0);
  return (
    <TabsPrimitive.List
      aria-label={label}
      className={cn('flex w-12 shrink-0 flex-col border-r bg-muted/40 py-1', className)}
    >
      {drawn.map((group, index) => (
        <Fragment key={group.id}>
          {index > 0 && <div aria-hidden data-rail-separator className="mx-3 my-1.5 h-px shrink-0 bg-border" />}
          {group.tabs.map(({ value: tab, label: name, icon: Icon }) => (
            <TabsPrimitive.Trigger
              key={tab}
              value={tab}
              disabled={disabled}
              className={cn(
                'relative flex h-10 w-full shrink-0 items-center justify-center text-muted-foreground transition-colors',
                'hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                'data-[state=active]:bg-background data-[state=active]:text-foreground disabled:pointer-events-none disabled:opacity-50',
              )}
              onPointerEnter={() => setFlyout(tab)}
              onPointerLeave={() => { pointerFocus.current = false; hide(tab); }}
              onPointerDown={() => { pointerFocus.current = true; }}
              onPointerUp={() => { pointerFocus.current = false; }}              onFocus={() => { if (!pointerFocus.current) setFlyout(tab); pointerFocus.current = false; }}
              onBlur={() => hide(tab)}
            >
              {tab === value && (
                <span aria-hidden data-rail-accent className="absolute inset-y-1.5 left-0 w-0.5 rounded-r bg-primary" />
              )}
              <Icon aria-hidden className="h-[18px] w-[18px]" />
              <span className="sr-only">{name}</span>
              {flyout === tab && (
                <span
                  aria-hidden
                  data-rail-flyout
                  className="pointer-events-none absolute left-full top-1/2 z-[80] ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border bg-popover px-2.5 py-1.5 text-label text-popover-foreground shadow-md animate-in fade-in-0 slide-in-from-left-1 motion-reduce:animate-none"
                >
                  <span className="text-muted-foreground">{group.label} · </span>{name}
                </span>
              )}
            </TabsPrimitive.Trigger>
          ))}
        </Fragment>
      ))}
    </TabsPrimitive.List>
  );
}
