import { useContext, useMemo, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { ListDetailBackContext, useListDetailBack, type ListDetailBackTarget } from '@/components/ui/listDetailBack';
import { useIsMobile } from '@/lib/useIsMobile';
import { cn } from '@/lib/utils';

/** Hands the pushed detail's back arrow to the tree below, or withholds it with `null`. */
export function ListDetailBackProvider({ value, children }: { value: ListDetailBackTarget | null; children: ReactNode }) {
  return <ListDetailBackContext.Provider value={value}>{children}</ListDetailBackContext.Provider>;
}

/**
 * The pushed detail's back arrow, for the panel to lead its header with. Renders nothing side by side.
 * A tabbed panel gets it from `PanelTabs`; a panel with no strip puts this at the left of its first row.
 * `onStrip` gives it the strip's fill, for a row it shares with a segmented strip.
 */
export function ListDetailBack({ onStrip = false }: { onStrip?: boolean }) {
  const back = useContext(ListDetailBackContext);
  if (!back) return null;
  return (
    <Tip tip={`Back to ${back.label}`}>
      <Button variant="ghost" size="icon" onClick={back.onBack} className={cn('shrink-0', onStrip && 'bg-muted')}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
    </Tip>
  );
}

/**
 * A strip-less panel's first row, led by the back arrow when the detail is pushed. `align="end"` lines the
 * arrow up with a labeled field's input; `center` suits a one-line row.
 */
export function ListDetailFirstRow({ align = 'end', children }: { align?: 'end' | 'center'; children: ReactNode }) {
  if (!useListDetailBack()) return <>{children}</>;
  return (
    <div className={cn('flex gap-2', align === 'end' ? 'items-end' : 'items-center')}>
      <ListDetailBack />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * Master-detail layout that adapts to width. Desktop shows the list and detail side-by-side (two scrolling
 * columns). Mobile shows one panel at a time: the list, and — when `showDetail` is set — the detail slides in
 * over it, native push-navigation style, and places its own back arrow (`ListDetailBack`). `stacked` uses that
 * push at every width, for a host too narrow to split. The caller owns selection; this only takes the
 * `showDetail` flag and an `onBack` to pop. Slide is skipped under `prefers-reduced-motion`. `detailFooter` stays frozen below the detail's scroll.
 */
export function ListDetail({
  list, detail, detailFooter, showDetail, onBack, backLabel, className, stacked = false, scrollList = true, scrollDetail = true,
}: {
  list: ReactNode;
  detail: ReactNode;
  detailFooter?: ReactNode;
  /** Whether the detail is active (drives the push; ignored side by side, which shows both). */
  showDetail: boolean;
  /** Pop back to the list from the push (typically clears the caller's selection). */
  onBack: () => void;
  /** The list's name; the arrow reads "Back to <backLabel>". */
  backLabel: string;
  className?: string;
  /** Push the detail over the list at every width, not only on mobile. */
  stacked?: boolean;
  /**
   * Set false when the list slot scrolls itself or owns its own pointer handling — a canvas, for
   * instance, whose floating panels are otherwise swallowed by the scroll viewport.
   */
  scrollList?: boolean;
  /** Set false when the detail fills the panel and scrolls inside itself; it then gets a flex column of
   *  the panel's height. */
  scrollDetail?: boolean;
}) {
  const isMobile = useIsMobile();
  const back = useMemo(() => ({ onBack, label: backLabel }), [onBack, backLabel]);

  if (!isMobile && !stacked) {
    return (
      <div data-list-detail className={cn('flex-1 min-h-0 flex', className)}>
        <ListDetailBackProvider value={null}>
          {scrollList
            ? <ScrollArea className="w-1/2 min-w-0 border-r">{list}</ScrollArea>
            : <div className="w-1/2 min-w-0 border-r overflow-hidden">{list}</div>}
          <div className="w-1/2 min-w-0 flex flex-col">
            {scrollDetail
              ? <ScrollArea className="flex-1 min-h-0">{detail}</ScrollArea>
              : <div data-detail-fill className="flex-1 min-h-0 flex flex-col">{detail}</div>}
            {detailFooter}
          </div>
        </ListDetailBackProvider>
      </div>
    );
  }

  return (
    <div data-list-detail className={cn('flex-1 min-h-0 relative overflow-hidden', className)}>
      {/* List sits underneath; parallaxes left while the detail is open (it isn't interactable then, so its
          transform is `none` at rest — keeping dnd/portals inside it unaffected). The absolute box owns the
          positioning: ScrollArea's own Root is always `position: relative`, so `absolute inset-0` on it would
          be ignored and its viewport would size to content (no scroll) — the wrapper gives it a definite height. */}
      <div
        className={cn(
          'absolute inset-0 transition-transform duration-200 motion-reduce:transition-none',
          showDetail && '-translate-x-1/4',
        )}
      >
        <ListDetailBackProvider value={null}>
          {scrollList
            ? <ScrollArea className="h-full w-full">{list}</ScrollArea>
            : <div className="h-full w-full overflow-hidden">{list}</div>}
        </ListDetailBackProvider>
      </div>
      {/* Detail slides in from the right over the list. Opaque, so it fully covers the list when open. A stacked
          push sits inside a panel, so it takes the panel's surface; the top-level mobile push is the page's. */}
      <div
        className={cn(
          'absolute inset-0 flex flex-col shadow-[-8px_0_20px_rgba(0,0,0,0.12)] transition-transform duration-200 motion-reduce:transition-none',
          stacked ? 'bg-card' : 'bg-background',
          showDetail ? 'translate-x-0' : 'translate-x-full pointer-events-none',
        )}
        aria-hidden={!showDetail}
      >
        <ListDetailBackProvider value={back}>
          {scrollDetail
            ? <ScrollArea className="flex-1 min-h-0">{detail}</ScrollArea>
            : <div data-detail-fill className="flex-1 min-h-0 flex flex-col">{detail}</div>}
        </ListDetailBackProvider>
        <ListDetailBackProvider value={null}>{detailFooter}</ListDetailBackProvider>
      </div>
    </div>
  );
}
