/**
 * The Bench Popover — the flask button's first stop, hosting the World Doctor's findings list and nothing
 * else, so an author with a couple of findings triages them without paying for the full panel.
 *
 * The list is the panel's own Instrument, unforked: same rows, same fixes, same dismissals. Everything the
 * Bench offers beyond it — the lens, the other Instruments — is behind the one button at the foot.
 */
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { FlaskConical, PanelRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import type { BenchPopoverProps } from '@/lib/testBench/benchProps';
import { IssuesInstrument } from './IssuesInstrument';

export function BenchPopover({ open, onClose, issues, onFixRule, onOpenPanel, children }: BenchPopoverProps & {
  /** The flask button. Anchored rather than made a Radix trigger, so its own onClick owns the toggle. */
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  return (
    <Popover open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <PopoverAnchor asChild>
        <span ref={anchorRef} className="inline-flex">{children}</span>
      </PopoverAnchor>
      {/* portal={false}: the editor can sit inside a modal Dialog, whose scroll lock swallows wheel events
          on portaled content. align="end" keeps the bubble under the flask at the header's right edge. */}
      <PopoverContent
        portal={false}
        align="end"
        sideOffset={8}
        className="flex w-96 max-w-[90vw] flex-col p-2"
        aria-label="World Doctor"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // The flask toggles this popover itself; letting outside-dismiss fire too would close then reopen.
          if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
      >
        <div className="flex items-center gap-2 pb-1">
          <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="text-meta font-medium text-muted-foreground">World Doctor</span>
        </div>
        {/* Native scroll box: the panel gives the list a ScrollArea sized `h-full`, which has nothing to
            resolve against a max-height-only parent. */}
        <div className="max-h-[50vh] overflow-y-auto">
          <IssuesInstrument issues={issues} onFix={onFixRule} />
        </div>
        <div className="mt-2 border-t pt-2">
          <Button variant="outline" size="sm" className="h-7 w-full text-meta" onClick={onOpenPanel}>
            <PanelRight className="mr-1 h-3.5 w-3.5" aria-hidden />
            Open Test Bench
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
