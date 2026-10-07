import { Fragment, useState, type CSSProperties } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react';
import { Tip } from '@/components/ui/tooltip';
import { readStorageJson, writeStorageJson } from '@/lib/keyedStorage';
import { NAV_IDLE, NAV_TAB_STATES } from '@/lib/navSelection';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { cn } from '@/lib/utils';

export interface NavRailTab {
  value: string;
  label: string;
  icon: LucideIcon;
}

/** One run of tabs. Hosts pass the Sections bar the same groups, so both draw the same splits. */
export interface NavRailGroup {
  id: string;
  tabs: readonly NavRailTab[];
}

export interface NavRailProps {
  /** The groups in rail order. A group with no tabs draws nothing. */
  groups: readonly NavRailGroup[];
  /** The active tab, which carries the edge bar. */
  value: string;
  label: string;
  /** Where this surface remembers expanded or collapsed. */
  storageKey: string;
  defaultExpanded?: boolean;
  /** The host has no room: draw collapsed and leave the stored choice alone. */
  autoCollapsed?: boolean;
  /** Draws every tab disabled, leaving the selection as it is. */
  disabled?: boolean;
  className?: string;
}

const COLLAPSED_PX = 52;
const EXPANDED_PX = 192;
const MOTION = '200ms cubic-bezier(0.2, 0, 0, 1)';

function readExpanded(key: string, fallback: boolean): boolean {
  const stored = readStorageJson('local', key);
  return typeof stored === 'boolean' ? stored : fallback;
}

// One layout in both states: the icon sits 11px in, which centers it in the collapsed rail, and the
// label clips in its own box as the rail narrows.
const ROW = cn(
  'relative flex h-9 w-full shrink-0 items-center gap-3 rounded-md pl-[11px] pr-2 text-label transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
  'disabled:opacity-50',
);

/** A collapsible vertical tab list for a surface's sections. Must sit inside a vertical `Tabs` root, which owns
 *  the selection and the panels. */
export function NavRail({
  groups, value, label, storageKey, defaultExpanded = true, autoCollapsed = false, disabled, className,
}: NavRailProps) {
  const [stored, setStored] = useState(() => readExpanded(storageKey, defaultExpanded));
  const expanded = stored && !autoCollapsed;
  const reducedMotion = usePrefersReducedMotion();

  const toggle = () => {
    const next = !stored;
    setStored(next);
    writeStorageJson('local', storageKey, next);
  };

  const transition = (property: string) => (reducedMotion ? 'none' : `${property} ${MOTION}`);
  const fade: CSSProperties = { opacity: expanded ? 1 : 0, transition: transition('opacity') };
  const drawn = groups.filter((group) => group.tabs.length > 0);
  const ToggleIcon = expanded ? PanelLeftClose : PanelLeftOpen;

  return (
    <div
      className={cn('flex shrink-0 flex-col border-r p-1.5', className)}
      style={{ width: expanded ? EXPANDED_PX : COLLAPSED_PX, transition: transition('width') }}
    >
      <TabsPrimitive.List aria-label={label} className="flex flex-col gap-0.5 pb-1.5">
        {drawn.map((group, index) => (
          <Fragment key={group.id}>
            {index > 0 && <div aria-hidden data-rail-separator className="mx-2 my-1.5 h-px shrink-0 bg-border" />}
            {group.tabs.map(({ value: tab, label: name, icon: Icon }) => (
              <Tip key={tab} tip={name} side="right" labelsChild={false} disabled={expanded}>
                <TabsPrimitive.Trigger
                  value={tab}
                  disabled={disabled}
                  className={cn(ROW, NAV_TAB_STATES, 'disabled:pointer-events-none')}
                >
                  {tab === value && (
                    <span aria-hidden data-rail-accent className="absolute inset-y-1.5 -left-1.5 w-0.5 rounded-r bg-foreground" />
                  )}
                  <Icon aria-hidden className="h-[18px] w-[18px] shrink-0" />
                  <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-left" style={fade}>{name}</span>
                </TabsPrimitive.Trigger>
              </Tip>
            ))}
          </Fragment>
        ))}
      </TabsPrimitive.List>
      {/* The tip sits on a wrapper, so the toggle still names itself while disabled. */}
      <Tip tip="Expand" side="right" labelsChild={false} disabled={expanded}>
        <span className="mt-auto flex">
          <button
            type="button"
            onClick={toggle}
            disabled={autoCollapsed}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            aria-expanded={expanded}
            className={cn(ROW, NAV_IDLE)}
          >
            <ToggleIcon aria-hidden className="h-[18px] w-[18px] shrink-0" />
            {/* Seen only while expanded; it fades out rather than swapping text mid-fade. */}
            <span aria-hidden className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-left" style={fade}>Collapse</span>
          </button>
        </span>
      </Tip>
    </div>
  );
}
