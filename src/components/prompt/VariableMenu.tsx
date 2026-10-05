import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowLeft, ChevronRight, Variable } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tip } from '@/components/ui/tooltip';
import { DrillSlide, type SlideFrom } from '@/components/DrillSlide';
import { MENU_ROW } from '@/components/menuRow';
import { InsertMenuButton } from '@/components/prompt/InsertMenuButton';
import type { VariableField, VariableNode } from '@/lib/statCodeVariableTree';
import { cn } from '@/lib/utils';

/** One row of a level: one that opens a level, a field to insert, or an empty group's marker. */
type Row =
  | { kind: 'drill'; label: string; trail: readonly string[]; open: () => Level }
  | { kind: 'field'; field: VariableField }
  | { kind: 'empty'; message: string };

interface Level {
  label: string;
  rows: readonly Row[];
}

const levelOf = (label: string, nodes: readonly VariableNode[]): Level => ({ label, rows: nodes.map(rowOf) });

function rowOf(node: VariableNode): Row {
  switch (node.kind) {
    case 'field': return { kind: 'field', field: node };
    case 'empty': return node;
    case 'group': return { kind: 'drill', label: node.label, trail: [], open: () => levelOf(node.label, node.children) };
    case 'names': return {
      kind: 'drill', label: node.label, trail: [], open: () => ({
        label: node.label,
        rows: node.rows.map((row): Row => ({ kind: 'drill', label: row.name, trail: row.trail, open: () => levelOf(row.name, row.children) })),
      }),
    };
  }
}

const ROW_TEXT = 'min-w-0 flex-1 break-words [overflow-wrap:anywhere]';

/** The menu's levels. Mounted fresh on every open, so it always starts at the top. */
function VariablePanel({ build, onPick, onClose }: {
  build: () => readonly VariableNode[];
  onPick: (field: VariableField) => void;
  onClose: () => void;
}) {
  const [stack, setStack] = useState<Level[]>(() => [levelOf('Variable', build())]);
  const [from, setFrom] = useState<SlideFrom>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const depth = stack.length - 1;
  const level = stack[depth];

  const enabledRows = () => [...(panelRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];

  // Each level focuses its first row as it opens: Back, below the top.
  useLayoutEffect(() => { enabledRows()[0]?.focus(); }, [stack]);

  const drill = (next: Level) => {
    setStack([...stack, next]);
    setFrom('right');
  };
  const back = () => {
    if (depth === 0) return;
    setStack(stack.slice(0, -1));
    setFrom('left');
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const rows = enabledRows();
      const at = rows.indexOf(document.activeElement as HTMLButtonElement);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      rows[(at + step + rows.length) % rows.length]?.focus();
    } else if (event.key === 'Backspace' || event.key === 'ArrowLeft') {
      event.preventDefault();
      back();
    }
  };
  // In the capture phase: a focused row's open tooltip takes Escape for itself, so the popover never sees it.
  const onKeyDownCapture = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
  };

  return (
    <div ref={panelRef} onKeyDown={onKeyDown} onKeyDownCapture={onKeyDownCapture}>
      <DrillSlide key={depth} from={from}>
        {depth > 0 && (
          <>
            <button type="button" className={cn(MENU_ROW, 'font-medium')} onClick={back}>
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              <span className={ROW_TEXT}>{level.label}</span>
            </button>
            <div role="separator" className="-mx-1 my-1 h-px bg-border" />
          </>
        )}
        <ScrollArea className="max-h-[min(20rem,calc(var(--radix-popover-content-available-height)-4rem))]">
          <div role="group" aria-label={level.label}>
            {level.rows.map((row, index) => {
              if (row.kind === 'empty') {
                return <button key={index} type="button" disabled className={MENU_ROW}>{row.message}</button>;
              }
              if (row.kind === 'field') {
                return (
                  <Tip key={index} tip={row.field.info} side="right" labelsChild={false}>
                    <button type="button" className={MENU_ROW} onClick={() => onPick(row.field)}>
                      <span className={ROW_TEXT}>{row.field.label}</span>
                    </button>
                  </Tip>
                );
              }
              return (
                <button key={index} type="button" className={MENU_ROW} onClick={() => drill(row.open())}>
                  <span className={ROW_TEXT}>
                    {row.label}
                    {row.trail.length > 0 && <span className="text-meta text-muted-foreground"> {row.trail.join(' / ')}</span>}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </DrillSlide>
    </div>
  );
}

/**
 * The stat code Variable menu: the sandbox's globals, drilled level by level down to a field, which inserts
 * its whole path. `build` is read on each open, so the menu lists the names as they are then.
 */
export function VariableMenu({ build, onPick }: { build: () => readonly VariableNode[]; onPick: (field: VariableField) => void }) {
  const [open, setOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  // A pick hands focus to the editor, so the close leaves it there instead of on the trigger.
  const picked = useRef(false);
  const onOpenChange = (next: boolean) => {
    if (next) { picked.current = false; setOpenCount((n) => n + 1); }
    setOpen(next);
  };
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <InsertMenuButton label="Variable" Icon={Variable} />
      </PopoverTrigger>
      {/* Inline, so a host dialog's scroll lock lets the wheel reach a long level. */}
      <PopoverContent
        portal={false}
        align="start"
        className="w-60 overflow-hidden p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => { if (picked.current) event.preventDefault(); }}
      >
        <VariablePanel
          key={openCount}
          build={build}
          onPick={(field) => { picked.current = true; setOpen(false); onPick(field); }}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
