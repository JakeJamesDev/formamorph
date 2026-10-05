import { Fragment, useRef } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { NavDisclosure } from '@/components/NavDisclosure';
import { cn } from '@/lib/utils';
import type { EdgeRailGroup } from './EdgeRail';

export interface EditorSectionsBarProps {
  groups: readonly EdgeRailGroup[];
  value: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The mobile form of the Edge Rail: a Sections bar folding the grouped tab list. Must sit inside a vertical
 *  `Tabs` root with manual activation, so arrows browse the open list and a pick closes it. */
export function EditorSectionsBar({ groups, value, open, onOpenChange }: EditorSectionsBarProps) {
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
      bodyId="world-editor-sections"
      className="shrink-0"
    >
      <TabsPrimitive.List aria-label="Editor Sections" className="flex flex-col gap-1 border-t border-border/60 p-3">
        {drawn.map((group) => (
          <Fragment key={group.id}>
            <p aria-hidden className="mb-1 mt-3 flex items-center gap-3 px-2 text-meta font-medium uppercase text-muted-foreground first:mt-0">
              <span>{group.label}</span><span className="h-px flex-1 bg-border" />
            </p>
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
