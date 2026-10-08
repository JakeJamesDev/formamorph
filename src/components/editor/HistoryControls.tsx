import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, History, Redo2, Save, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Tip } from '@/components/ui/tooltip';
import { MENU_ROW } from '@/components/menuRow';
import type { TargetAttribute } from '@/lib/surface/surfaceTargets';
import { cn } from '@/lib/utils';

/** What the controls read: the rows to list and where the cursor and the Saved marker stand. */
export interface HistoryView {
  canUndo: boolean;
  canRedo: boolean;
  /** One label per Step, oldest first. */
  rows: readonly string[];
  /** How many Steps are applied. 0 is the World opened head. */
  cursor: number;
  /** The cursor position at the last save, or null. */
  saved: number | null;
  undo(): void;
  redo(): void;
  /** Moves to a list position. 0 is the World opened head. */
  jump(position: number): void;
}

const SAVED_MARKER = (
  <div className="flex items-center gap-2 px-2 py-0.5 text-meta text-muted-foreground">
    <Save className="h-3 w-3" aria-hidden />
    Saved
    <Separator className="w-auto flex-grow" />
  </div>
);

// Brings the current row into view when the list opens or the cursor moves off-screen.
const showRow = (row: HTMLElement | null) => row?.scrollIntoView?.({ block: 'nearest' });

/** The head row, every Step, the Saved marker and the dimmed future. A click on a row only jumps. */
export function HistoryList({ history }: { history: HistoryView }) {
  const { rows, cursor, saved, jump } = history;
  return (
    <div className="flex flex-col">
      <button
        type="button"
        className={cn(MENU_ROW, 'text-meta text-muted-foreground', cursor === 0 && 'bg-accent')}
        ref={cursor === 0 ? showRow : undefined}
        onClick={() => jump(0)}
        aria-current={cursor === 0 ? 'step' : undefined}
      >
        World opened
      </button>
      {saved === 0 && SAVED_MARKER}
      {rows.map((label, i) => {
        const done = i < cursor;
        const current = i === cursor - 1;
        return (
          // eslint-disable-next-line react/no-array-index-key -- a Step has no id; the list is its position
          <div key={i}>
            <button
              type="button"
              className={cn(MENU_ROW, !done && 'text-muted-foreground/60', current && 'bg-accent')}
              ref={current ? showRow : undefined}
              onClick={() => jump(i + 1)}
              aria-current={current ? 'step' : undefined}
              data-undone={done ? undefined : 'true'}
            >
              <span className="min-w-0 flex-grow truncate">{label}</span>
              {!done && <span className="sr-only">(undone)</span>}
              {current && <span className="text-meta text-muted-foreground">Now</span>}
            </button>
            {saved === i + 1 && SAVED_MARKER}
          </div>
        );
      })}
    </div>
  );
}

/** One move's button: Undo or Redo, with the chord in its tip. */
function HistoryFace({ move, history, disabled, className, size }: {
  move: 'undo' | 'redo'; history: HistoryView; disabled: boolean; className?: string; size: 'sm' | 'icon';
}) {
  const undo = move === 'undo';
  const Icon = undo ? Undo2 : Redo2;
  return (
    <Tip tip={undo ? 'Undo (Ctrl+Z)' : 'Redo (Ctrl+Y or Ctrl+Shift+Z)'} labelsChild={false}>
      <Button
        variant="ghost" size={size} className={className} onClick={undo ? history.undo : history.redo}
        disabled={disabled || !(undo ? history.canUndo : history.canRedo)} aria-label={undo ? 'Undo' : 'Redo'}
      >
        <Icon className="h-4 w-4" />
      </Button>
    </Tip>
  );
}

const PILL_FACE = 'h-8 rounded-none border-y border-l px-2.5';

/**
 * The app bar's history control. Desktop is a split pill: Undo, Redo and a chevron that opens the list.
 * Mobile is one History icon whose popover carries Undo and Redo in its head.
 */
export function HistoryControls({ history, layout, disabled = false, openRequest = false, fieldAttributes }: {
  history: HistoryView;
  layout: 'pill' | 'icon';
  disabled?: boolean;
  /** Opens the list whenever it turns true (the dev route). */
  openRequest?: boolean;
  /** The Take Me There attribute for the control: on the pill's group, or on the icon button. */
  fieldAttributes?: TargetAttribute;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (openRequest && !disabled) setOpen(true); }, [openRequest, disabled]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  const pill = layout === 'pill';
  const trigger: ReactNode = (
    <Tip tip="History" labelsChild={false}>
      <PopoverTrigger asChild>
        <Button
          variant={open ? 'secondary' : 'ghost'}
          size={pill ? 'sm' : 'icon'}
          className={pill ? 'h-8 rounded-l-none rounded-r-md border px-1.5' : undefined}
          aria-label="History"
          aria-pressed={open}
          disabled={disabled}
          {...(pill ? undefined : fieldAttributes)}
        >
          {pill ? <ChevronDown className="h-3.5 w-3.5" /> : <History className="h-4 w-4" />}
        </Button>
      </PopoverTrigger>
    </Tip>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {pill ? (
        <div className="flex items-center" role="group" aria-label="History" {...fieldAttributes}>
          <HistoryFace move="undo" history={history} disabled={disabled} size="sm" className={cn(PILL_FACE, 'rounded-l-md')} />
          <HistoryFace move="redo" history={history} disabled={disabled} size="sm" className={PILL_FACE} />
          {trigger}
        </div>
      ) : trigger}
      {/* portal={false}: the editor can sit inside a modal Dialog, whose scroll lock swallows wheel events
          on portaled content. align="end" keeps the bubble under the control at the bar's right edge. */}
      <PopoverContent
        portal={false}
        align="end"
        sideOffset={8}
        className="flex w-72 max-w-[90vw] flex-col p-2"
        aria-label="History"
      >
        <div className="flex items-center gap-2 pb-1">
          <History className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="text-meta font-medium text-muted-foreground">History</span>
          {!pill && (
            <span className="ml-auto flex items-center">
              <HistoryFace move="undo" history={history} disabled={disabled} size="icon" />
              <HistoryFace move="redo" history={history} disabled={disabled} size="icon" />
            </span>
          )}
        </div>
        {/* Native scroll box: the popover has a max height only, which a ScrollArea cannot resolve. */}
        <div className="max-h-[50vh] overflow-y-auto">
          <HistoryList history={history} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
// scroll-guard: allow popover-list: popover-hosted; dialog scroll lock can intercept wheel input
