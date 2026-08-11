import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Maximize2, Minimize2, Redo2, Undo2, Braces, Variable } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, dialogFullHeight } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TOOLBAR_BTN } from '@/components/prompt/toolbarStyles';
import { cn } from '@/lib/utils';
import {
  canRedo, canUndo, commitHistory, initHistory, redoHistory, undoHistory, type HistoryState,
} from '@/lib/textHistory';
import { SLOT_SNIPPETS, STAT_CODE_SNIPPETS, type InsertSnippet } from '@/lib/codeSnippets';

/** A step ends at whitespace, so undo walks back a word at a time rather than the whole line at once. */
function isTypingRun(before: string, after: string): boolean {
  if (Math.abs(before.length - after.length) !== 1) return false;
  const [longer, shorter] = before.length > after.length ? [before, after] : [after, before];
  let i = 0;
  while (i < shorter.length && longer[i] === shorter[i]) i += 1;
  return !/\s/.test(longer[i] ?? '');
}

function InsertMenu({ items, label, Icon, onPick }: {
  items: InsertSnippet[]; label: string; Icon: typeof Braces; onPick: (snippet: InsertSnippet) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button" title={label} aria-label={label}
          onMouseDown={(event) => event.preventDefault()}
          className={cn(TOOLBAR_BTN, 'flex items-center gap-1 data-[state=open]:bg-accent data-[state=open]:text-foreground')}
        >
          <Icon className="h-4 w-4" />
          <span className="text-meta">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-1" onOpenAutoFocus={(event) => event.preventDefault()}>
        <div className="flex flex-col">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onMouseDown={(event) => { event.preventDefault(); setOpen(false); onPick(item); }}
              className="text-left rounded px-2 py-1.5 text-helper text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface CodeAreaProps {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
  placeholder?: string;
  /** Shown at the start of the toolbar row, so a caption costs no extra line. */
  label?: ReactNode;
  /** Offer the `{{slot}}` menu. Template editing only. */
  slots?: boolean;
  className?: string;
  rows?: number;
}

/** Toolbar + textarea. Split out so the fullscreen overlay can mount a second copy against the same
 *  value without the outer component recursing into itself. */
function CodeAreaBody({
  value, onChange, ariaLabel, placeholder, label, slots, className, rows = 8, fullscreen, onToggleFullscreen,
}: CodeAreaProps & { fullscreen: boolean; onToggleFullscreen: () => void }) {
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const snap = (v: string, start = 0, end = 0) => ({ value: v, selectionStart: start, selectionEnd: end });
  const historyRef = useRef<HistoryState>(initHistory(snap(value)));
  const ownRef = useRef(value);
  // Selection to restore once React has painted the new value — an insert or an undo has to put the caret
  // back itself, since a controlled textarea re-renders with the caret at the end.
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const [, forceUpdate] = useState(0);

  // Edits arriving through `value` (typing, or a parent writing to it) fold into the history here, which
  // keeps the parent the single owner of the text.
  if (value !== ownRef.current) {
    historyRef.current = commitHistory(
      historyRef.current,
      snap(value, areaRef.current?.selectionStart ?? 0, areaRef.current?.selectionEnd ?? 0),
      isTypingRun(historyRef.current.present.value, value),
    );
    ownRef.current = value;
  }

  useLayoutEffect(() => {
    const pending = pendingSelection.current;
    const area = areaRef.current;
    if (!pending || !area) return;
    pendingSelection.current = null;
    area.focus();
    area.setSelectionRange(pending.start, pending.end);
  });

  const move = useCallback((next: HistoryState) => {
    if (next === historyRef.current) return;
    historyRef.current = next;
    ownRef.current = next.present.value;
    pendingSelection.current = { start: next.present.selectionStart, end: next.present.selectionEnd };
    onChange(next.present.value);
    forceUpdate((n) => n + 1);
  }, [onChange]);

  const insert = (snippet: InsertSnippet) => {
    const area = areaRef.current;
    const start = area?.selectionStart ?? value.length;
    const end = area?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + snippet.text + value.slice(end);
    // A snippet is one undo step, never folded into the typing around it.
    historyRef.current = commitHistory(historyRef.current, snap(next, start, start + snippet.text.length), false);
    ownRef.current = next;
    const offset = snippet.select ? snippet.text.indexOf(snippet.select) : -1;
    pendingSelection.current = offset >= 0
      ? { start: start + offset, end: start + offset + (snippet.select as string).length }
      : { start: start + snippet.text.length, end: start + snippet.text.length };
    onChange(next);
    forceUpdate((n) => n + 1);
  };

  return (
    <div className={cn('flex flex-col gap-1 min-h-0', className)}>
      {/* Same three-part chrome as PromptField: what you insert on the left, the field's own history and
          view controls on the right, one rule between them. */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {label && <Label className="leading-none">{label}</Label>}
          {slots && <InsertMenu items={SLOT_SNIPPETS} label="Slot" Icon={Braces} onPick={insert} />}
          <InsertMenu items={STAT_CODE_SNIPPETS} label="Variable" Icon={Variable} onPick={insert} />
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button" title="Undo" aria-label="Undo" className={TOOLBAR_BTN}
            disabled={!canUndo(historyRef.current)}
            onMouseDown={(event) => { event.preventDefault(); move(undoHistory(historyRef.current)); }}
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button" title="Redo" aria-label="Redo" className={TOOLBAR_BTN}
            disabled={!canRedo(historyRef.current)}
            onMouseDown={(event) => { event.preventDefault(); move(redoHistory(historyRef.current)); }}
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <span className="mx-0.5 w-px self-stretch bg-border" />
          <button
            type="button"
            title={fullscreen ? 'Exit full screen' : 'Edit full screen'}
            aria-label={fullscreen ? 'Exit full screen' : 'Edit full screen'}
            className={TOOLBAR_BTN}
            onMouseDown={(event) => { event.preventDefault(); onToggleFullscreen(); }}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <Textarea
        ref={areaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        rows={rows}
        // A floor, not `min-h-0`: in a height-pinned pane the field is a flex child, and with the
        // on-screen keyboard eating most of `--app-h` a zero minimum lets it collapse to nothing.
        // Keeping a usable minimum makes the pane around it scroll instead.
        className="font-mono text-label flex-1 min-h-[6rem] resize-none"
      />
    </div>
  );
}

/**
 * A plain-text code editor with the affordances a bare textarea has none of: undo and redo that survive
 * the programmatic writes a template insert makes, a full-screen toggle, and menus that name the
 * variables and slot forms the sandbox understands — none of which the field itself could hint at.
 *
 * Full screen raises an overlay holding only the editor, so it works the same whether the field sits on
 * a panel or inside a dialog — and a dialog's own buttons stay where they were rather than being grown
 * away from underneath the author.
 */
export function CodeArea(props: CodeAreaProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const toggle = () => setFullscreen((f) => !f);

  return (
    <>
      <CodeAreaBody {...props} fullscreen={false} onToggleFullscreen={toggle} />
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent
          aria-describedby={undefined}
          className={cn('flex flex-col', dialogFullHeight, 'max-w-none w-screen left-0 translate-x-0 rounded-none')}
        >
          <DialogHeader><DialogTitle>{props.ariaLabel}</DialogTitle></DialogHeader>
          <CodeAreaBody {...props} className="flex-1 min-h-0" fullscreen onToggleFullscreen={toggle} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CodeArea;
