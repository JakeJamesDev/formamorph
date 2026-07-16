import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/lib/useIsMobile';
import { cn } from '@/lib/utils';

/**
 * Master-detail layout that adapts to width. Desktop shows the list and detail side-by-side (two scrolling
 * columns). Mobile shows one panel at a time: the list, and — when `showDetail` is set — the detail slides in
 * over it with a back header, native push-navigation style. The caller owns selection; this only takes the
 * `showDetail` flag and an `onBack` to pop. Slide is skipped under `prefers-reduced-motion`.
 */
export function ListDetail({ list, detail, showDetail, onBack, backLabel = 'Back', className }: {
  list: ReactNode;
  detail: ReactNode;
  /** Whether the detail is active (drives the mobile push; ignored on desktop, which shows both). */
  showDetail: boolean;
  /** Pop back to the list on mobile (typically clears the caller's selection). */
  onBack: () => void;
  backLabel?: string;
  className?: string;
}) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return (
      <div className={cn('flex-1 min-h-0 flex', className)}>
        <ScrollArea className="w-1/2 min-w-0 border-r">{list}</ScrollArea>
        <ScrollArea className="w-1/2 min-w-0">{detail}</ScrollArea>
      </div>
    );
  }

  return (
    <div className={cn('flex-1 min-h-0 relative overflow-hidden', className)}>
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
        <ScrollArea className="h-full w-full">{list}</ScrollArea>
      </div>
      {/* Detail slides in from the right over the list. Opaque, so it fully covers the list when open. */}
      <div
        className={cn(
          'absolute inset-0 flex flex-col bg-background shadow-[-8px_0_20px_rgba(0,0,0,0.12)] transition-transform duration-200 motion-reduce:transition-none',
          showDetail ? 'translate-x-0' : 'translate-x-full pointer-events-none',
        )}
        aria-hidden={!showDetail}
      >
        <div className="flex-shrink-0 flex items-center border-b p-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> {backLabel}
          </Button>
        </div>
        <ScrollArea className="flex-1 min-h-0">{detail}</ScrollArea>
      </div>
    </div>
  );
}
