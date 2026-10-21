import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowLeft, ChevronRight, Lock, Variable } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tip } from '@/components/ui/tooltip';
import { DrillSlide, type SlideFrom } from '@/components/DrillSlide';
import { useIsCut } from '@/components/TruncatedText';
import { MENU_ROW } from '@/components/menuRow';
import { InsertMenuButton } from '@/components/prompt/InsertMenuButton';
import { BreadcrumbPickerList, type BreadcrumbPickerRow } from '@/components/ui/breadcrumb-picker';
import { infoWithAccess } from '@/lib/codeSurface';
import type { VariableField, VariableNameRow, VariableNode } from '@/lib/statCodeVariableTree';
import { cn } from '@/lib/utils';

/** One row of a level: one that opens a level, a field to insert, or an empty group's marker. */
type Row =
  | { kind: 'drill'; label: string; open: () => Level }
  | { kind: 'field'; field: VariableField }
  | { kind: 'empty'; message: string };

/** A level of plain rows, or a name list, which searches its names and their trails. */
type Level =
  | { kind: 'rows'; label: string; rows: readonly Row[] }
  | { kind: 'names'; label: string; names: readonly VariableNameRow[] };

const levelOf = (label: string, nodes: readonly VariableNode[]): Level => ({ kind: 'rows', label, rows: nodes.map(rowOf) });

function rowOf(node: VariableNode): Row {
  switch (node.kind) {
    case 'field': return { kind: 'field', field: node };
    case 'empty': return node;
    case 'group': return { kind: 'drill', label: node.label, open: () => levelOf(node.label, node.children) };
    case 'names': return { kind: 'drill', label: node.label, open: () => ({ kind: 'names', label: node.label, names: node.rows }) };
  }
}

const pickerRows = (names: readonly VariableNameRow[]): BreadcrumbPickerRow<VariableNameRow>[] =>
  names.map((row, index) => ({ key: String(index), value: row, name: row.name, breadcrumb: row.trail }));

const ROW_TEXT = 'min-w-0 flex-1 break-words [overflow-wrap:anywhere]';

/** The leading icon slot, Back arrow wide. A level with a read-only row gives every row one, so the labels line up. */
const Gutter = ({ readOnly }: { readOnly: boolean }) => (
  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
    {readOnly && <Lock role="img" aria-label="Read-Only" className="h-3 w-3 text-muted-foreground" />}
  </span>
);

const isReadOnly = (row: Row): boolean => row.kind === 'field' && row.field.access === 'readOnly';

/** A field row: the read-only mark, its label, and its type on the right. A cut type rides in the tooltip whole. */
function FieldRow({ field, gutter, onPick }: { field: VariableField; gutter: boolean; onPick: () => void }) {
  const detailRef = useRef<HTMLSpanElement | null>(null);
  const cut = useIsCut(detailRef, field.detail);
  const info = infoWithAccess(field);
  return (
    <Tip tip={cut ? `${field.detail}\n${info}` : info} side="right" labelsChild={false}>
      {/* Named by its label alone: the mark and the type are the row's annotations, not its name. */}
      <button type="button" aria-label={field.label} className={MENU_ROW} onClick={onPick}>
        {gutter && <Gutter readOnly={field.access === 'readOnly'} />}
        <span className="min-w-0 truncate">{field.label}</span>
        <span ref={detailRef} className="ml-auto min-w-0 truncate pl-2 font-mono text-helper text-muted-foreground">{field.detail}</span>
      </button>
    </Tip>
  );
}

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
  const gutter = level.kind === 'rows' && level.rows.some(isReadOnly);

  // The rows the arrows step through. A name level's search box is one stop; its list moves itself.
  const enabledRows = () => [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input') ?? [])];

  // Each level focuses its first row as it opens: Back, below the top. A name level focuses its search box.
  useLayoutEffect(() => {
    (panelRef.current?.querySelector<HTMLInputElement>('input') ?? enabledRows()[0])?.focus();
  }, [stack]);

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
    // The name list's own keys: it moves its active row and drills with Enter.
    if (event.defaultPrevented) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const rows = enabledRows();
      const at = rows.indexOf(document.activeElement as HTMLElement);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      rows[(at + step + rows.length) % rows.length]?.focus();
    } else if (event.key === 'Backspace' || event.key === 'ArrowLeft') {
      // A search box with text keeps both keys to edit it.
      if (event.target instanceof HTMLInputElement && event.target.value !== '') return;
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
        {level.kind === 'names' ? (
          // Edge to edge, as the Back row's separator runs; the list leaves room for Back and the search box.
          <div
            role="group"
            aria-label={level.label}
            className="-mx-1 -mb-1 [&_[cmdk-list]]:max-h-[min(300px,calc(var(--radix-popover-content-available-height)-6.5rem))]"
          >
            <BreadcrumbPickerList
              sections={[{ rows: pickerRows(level.names) }]}
              onPick={(row) => (row.field ? onPick(row.field) : drill(levelOf(row.name, row.children)))}
              searchPlaceholder={`Search ${level.label.toLowerCase()}`}
            />
          </div>
        ) : (
          <ScrollArea className="max-h-[min(20rem,calc(var(--radix-popover-content-available-height)-4rem))]">
            <div role="group" aria-label={level.label}>
              {level.rows.map((row, index) => {
                if (row.kind === 'empty') {
                  return <button key={index} type="button" disabled className={MENU_ROW}>{gutter && <Gutter readOnly={false} />}{row.message}</button>;
                }
                if (row.kind === 'field') {
                  return <FieldRow key={index} field={row.field} gutter={gutter} onPick={() => onPick(row.field)} />;
                }
                return (
                  <button key={index} type="button" className={MENU_ROW} onClick={() => drill(row.open())}>
                    {gutter && <Gutter readOnly={false} />}
                    <span className={ROW_TEXT}>{row.label}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DrillSlide>
    </div>
  );
}

/**
 * The code Variable menu: the sandbox's globals, drilled level by level down to a field, which inserts
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
        className="w-72 overflow-hidden p-1"
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
