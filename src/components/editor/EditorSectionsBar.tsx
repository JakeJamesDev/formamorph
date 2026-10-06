import { Fragment, useRef } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { NavDisclosure } from '@/components/NavDisclosure';
import { cn } from '@/lib/utils';
import type { NavRailGroup } from '@/components/NavRail';

export interface EditorSectionsBarProps {
  /** The same groups the host feeds its Nav Rail, so both draw the same splits. */
  groups: readonly NavRailGroup[];
  /** Names the tab list, as the host's Nav Rail names its own. */
  label: string;
  /** The id of the folding body, unique on the page. */
  bodyId: string;
  value: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** A surface's mobile tab picker: a Sections bar folding the grouped tab list. Must sit inside a vertical
 *  `Tabs` root with manual activation, so arrows browse the open list and a pick closes it. */
export function EditorSectionsBar({ groups, label, bodyId, value, open, onOpenChange }: EditorSectionsBarProps) {
  const bar = useRef<HTMLButtonElement>(null);
  const drawn = groups.filter((group) => group.tabs.length > 0);
  const current = drawn.flatMap((group) => group.tabs).find((tab) => tab.value === value);
  // On click, not on select: the mousedown that selects would move focus back into the closing list.
  const pick = () => {
    onOpenChange(false);
    bar.current?.focus();
  };
  return (
    <NavDisclosure
      ref={bar}
      open={open}
      onOpenChange={onOpenChange}
      label="Sections"
      current={current?.label}
      bodyId={bodyId}
      className="shrink-0"
    >
      <TabsPrimitive.List aria-label={label} className="flex flex-col gap-1 border-t border-border/60 p-3">
        {drawn.map((group, index) => (
          <Fragment key={group.id}>
            {index > 0 && <div aria-hidden data-sections-separator className="mx-2 my-1.5 h-px shrink-0 bg-border" />}
            {group.tabs.map(({ value: tab, label, icon: Icon }) => (
              <TabsPrimitive.Trigger
                key={tab}
                value={tab}
                onClick={pick}
                className={cn(
                  'flex min-h-11 w-full min-w-0 items-center gap-2 rounded px-2 py-1 text-left text-label',
                  'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  'data-[state=active]:bg-muted data-[state=active]:font-semibold data-[state=active]:text-foreground',
                )}
              >
                <Icon aria-hidden className="h-4 w-4 shrink-0" />
                {label}
              </TabsPrimitive.Trigger>
            ))}
          </Fragment>
        ))}
      </TabsPrimitive.List>
    </NavDisclosure>
  );
}
