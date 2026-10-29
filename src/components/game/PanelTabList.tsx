import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const ShowLabels = createContext(true);

/** A trigger's width besides its label: the side padding, the icon and the gap. */
function chromeOf(trigger: HTMLElement): number {
  const style = getComputedStyle(trigger);
  const icon = trigger.querySelector('svg')?.getBoundingClientRect().width ?? 0;
  return (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0) + icon + (parseFloat(style.columnGap) || 0);
}

/** Whether every label in `list` fits its trigger's equal-width cell next to its icon. A label's
 *  `scrollWidth` is its full text width, truncated or screen-reader-only. */
function labelsFit(list: HTMLElement): boolean {
  return [...list.querySelectorAll<HTMLElement>('[role="tab"]')].every((trigger) => {
    const cell = trigger.getBoundingClientRect().width;
    const label = trigger.querySelector<HTMLElement>('[data-tab-label]');
    return cell === 0 || !label || label.scrollWidth + chromeOf(trigger) <= cell;
  });
}

/** A side panel's tab strip: labels show only while every one fits; otherwise icons alone, the tip naming each. */
export function PanelTabList({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [showLabels, setShowLabels] = useState(true);
  const check = useCallback(() => {
    if (ref.current) setShowLabels(labelsFit(ref.current));
  }, []);
  // A label can change with its tab, such as the log count.
  useLayoutEffect(check);
  useEffect(() => {
    const list = ref.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    let mounted = true;
    const observer = new ResizeObserver(check);
    observer.observe(list);
    void document.fonts?.ready.then(() => { if (mounted) check(); });
    return () => { mounted = false; observer.disconnect(); };
  }, [check]);
  return (
    <TabsList ref={ref} className="grid w-full flex-shrink-0 auto-cols-fr grid-flow-col">
      <ShowLabels.Provider value={showLabels}>{children}</ShowLabels.Provider>
    </TabsList>
  );
}

/** One side-panel tab: an icon, and its label while the strip has room for every label. */
export function PanelTab({ value, icon: Icon, label }: { value: string; icon: LucideIcon; label: string }) {
  const showLabels = useContext(ShowLabels);
  return (
    // The label's own text names the tab; the tip shows it where the label is hidden.
    <Tip tip={label} labelsChild={false}>
      <TabsTrigger value={value} className="min-w-0 gap-1.5 px-1">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span data-tab-label className={cn('truncate', !showLabels && 'sr-only')}>{label}</span>
      </TabsTrigger>
    </Tip>
  );
}
