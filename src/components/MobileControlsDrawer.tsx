import { useState, type ReactNode } from 'react';
import { SlidersHorizontal, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose, DrawerOverlay } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

// The two fixed heights the sheet toggles between — both fully scrollable. The shorter one keeps the model
// visible above the sheet; the expand button grows it.
const HEIGHTS = { short: 'h-[40dvh]', tall: 'h-[90dvh]' } as const;

/**
 * A full-width bottom sheet for controls that would otherwise crowd a portrait viewport, plus the floating
 * button that opens it. Used wherever a mobile screen shows a live model above and its controls below — the
 * enter-world customization step and the model-library preview.
 *
 * The overlay is deliberately faint (and the sheet collapsible) so the model still reads behind it; collapse
 * the sheet to orbit/inspect the model. Must be rendered inside a full-screen (viewport-filling) context so
 * the fixed trigger anchors to the screen bottom.
 */
export function MobileControlsDrawer({ title, triggerLabel = 'Customize', children }: {
  title: ReactNode;
  triggerLabel?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {!open && (
        <Button
          onClick={() => { setExpanded(false); setOpen(true); }}
          className="fixed inset-x-0 bottom-0 z-40 mx-4 mb-4 gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" /> {triggerLabel}
        </Button>
      )}
      <Drawer open={open} onOpenChange={setOpen}>
        {/* Faint scrim: the overlay blocks the WebGL canvas so drawer gestures don't fight OrbitControls, but
            stays light so the model reads above the (short) sheet. */}
        <DrawerOverlay className="bg-black/40" />
        <DrawerContent className={cn('transition-[height] duration-200', expanded ? HEIGHTS.tall : HEIGHTS.short)}>
          <DrawerHeader className="flex flex-row items-center justify-between py-2">
            <DrawerTitle className="truncate">{title}</DrawerTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={expanded ? 'Shrink panel' : 'Expand panel'}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
              </Button>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" aria-label="Close panel">
                  <X className="h-5 w-5" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-6 px-4 pb-8">{children}</div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </>
  );
}
