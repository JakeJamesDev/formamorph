import { useRef, useState } from 'react';
import { TextCursorInput } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tip } from '@/components/ui/tooltip';
import { Meta } from '@/components/ui/typography';
import { insertableSnippet, useStatCodeInsertTarget } from '@/lib/formaquestion/statCodeInsert';
import { STAT_CODE_TIMINGS, TIMING_LABEL, type StatCodeTiming } from '@/lib/statCodeTiming';
import { cn } from '@/lib/utils';
import type { SnippetBlock } from './CodeSnippet';

const NO_PANEL_TIP = "Switch the World Editor to Advanced and open a stat's Code tab";

/** Insert: a menu headed by the open stat's name that writes the block into one of its boxes. */
export function CodeInsert({ block }: { block: SnippetBlock }) {
  const target = useStatCodeInsertTarget();
  const [open, setOpen] = useState(false);
  const items = useRef<Partial<Record<StatCodeTiming, HTMLButtonElement | null>>>({});
  const menu = useRef<HTMLDivElement>(null);
  const { slot, code } = insertableSnippet(block.code, block.meta);

  if (!target) {
    return (
      <Tip tip={NO_PANEL_TIP}>
        <Button variant="ghost" size="icon" aria-label="Insert" aria-disabled className="h-6 w-6 cursor-not-allowed opacity-50">
          <TextCursorInput aria-hidden className="h-3.5 w-3.5" />
        </Button>
      </Tip>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tip tip="Insert">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <TextCursorInput aria-hidden className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
      </Tip>
      {/* Inline, so it stays in the window's layer above every dialog. */}
      <PopoverContent
        portal={false}
        align="end"
        role="menu"
        aria-label={`Insert into ${target.statName}`}
        className="pointer-events-auto w-48 p-1"
        ref={menu}
        tabIndex={-1}
        // The fence's slot tag picks the item that has focus on open; with none, no item has it.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (slot ? items.current[slot] : menu.current)?.focus();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          const rows = STAT_CODE_TIMINGS.map((timing) => items.current[timing]);
          const at = rows.findIndex((row) => row === document.activeElement);
          const step = event.key === 'ArrowDown' ? 1 : -1;
          const next = at < 0 ? (step > 0 ? 0 : rows.length - 1) : (at + step + rows.length) % rows.length;
          rows[next]?.focus();
        }}
      >
        <Meta aria-hidden className="block truncate px-2 py-1">{target.statName}</Meta>
        {STAT_CODE_TIMINGS.map((timing) => (
          <Button
            key={timing}
            ref={(element) => { items.current[timing] = element; }}
            role="menuitem"
            variant="ghost"
            className={cn('h-8 w-full justify-start text-meta', timing === slot && 'bg-accent text-accent-foreground')}
            onClick={() => {
              setOpen(false);
              target.insert(timing, code);
            }}
          >
            {TIMING_LABEL[timing]}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
