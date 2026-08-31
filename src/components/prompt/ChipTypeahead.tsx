import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  $getSelection, $isRangeSelection, $isTextNode, $createRangeSelection, $setSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_DOWN_COMMAND, KEY_ARROW_UP_COMMAND, KEY_ARROW_LEFT_COMMAND, KEY_ARROW_RIGHT_COMMAND,
  KEY_ENTER_COMMAND, KEY_ESCAPE_COMMAND, KEY_TAB_COMMAND,
} from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { CHIP_BASE } from '@/components/Chip';
import { cn } from '@/lib/utils';
import { useWheelScroll } from '@/lib/useWheelScroll';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { $createVariableNode } from './VariableNode';

/**
 * Insert a chip by typing rather than reaching for a palette: the trigger character opens a filtered menu
 * of the vocabulary's tokens at the caret, and choosing one swaps the typed run for the chip.
 *
 * The menu only stays open while something matches, so a trigger character meant literally closes it as
 * soon as the following words rule every token out — typing prose never has to fight the menu.
 *
 * A vocabulary whose tokens hold parts (the placeholders) turns the menu into a drill: a row with parts
 * offers `›`, and walking into one filters that level instead of the root. Enter anywhere down there
 * inserts the path it took to get there, so `Molly › Hair` is one keyboard run rather than a trip to the
 * placeholder list. A vocabulary that can mint a token offers to make what the filter names, for the case
 * where the part an author wants does not exist yet.
 */

/** How many characters may follow the trigger before it is read as ordinary prose rather than a query. */
const MAX_QUERY = 32;

/** Reads a drill breadcrumb as one name. Matches the separator the chip labels themselves use. */
const PATH_SEPARATOR = ' › ';

/** One offered token, plus whether walking into it would show anything. */
interface Row {
  token: string;
  label: string;
  color?: string;
  parts: boolean;
}

/** A level the menu has walked into: the chip it stands for, named by the row that opened it. */
interface Level {
  token: string;
  label: string;
}

interface Match {
  query: string;
  rows: Row[];
  rect: { left: number; top: number; bottom: number };
}

/** The caret's viewport box, falling back to the editor's own when the caret sits against a chip and
 *  collapses to an empty rect. */
function caretRect(root: HTMLElement | null): Match['rect'] | null {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (r.height) return { left: r.left, top: r.top, bottom: r.bottom };
  }
  if (!root) return null;
  const r = root.getBoundingClientRect();
  return { left: r.left, top: r.top, bottom: r.bottom };
}

export function ChipTypeaheadPlugin({ trigger, vocab }: {
  /** Character that opens the menu (the placeholder family uses `{`). */
  trigger: string;
  vocab: ChipVocabulary;
}) {
  const [editor] = useLexicalComposerContext();
  const [match, setMatch] = useState<Match | null>(null);
  // The menu is portaled to the body, so a modal dialog's scroll lock cancels every wheel over it.
  const scroller = useWheelScroll<HTMLDivElement>();
  // -1 selects nothing, which is where a menu open only to offer a fresh placeholder starts: Enter then
  // still belongs to the field, so a `{` typed in prose cannot author a placeholder by accident.
  const [index, setIndex] = useState(-1);
  const [path, setPath] = useState<Level[]>([]);
  // Set by Escape so the menu stays shut for the run the caret is in; cleared once the run breaks.
  const dismissed = useRef(false);
  // Read by the key handlers, which are registered once and must not close over stale state.
  const matchRef = useRef<Match | null>(null);
  matchRef.current = match;
  const indexRef = useRef(-1);
  indexRef.current = index;
  // Written alongside its state so the update listener, which can run inside the same edit that walked a
  // level, reads the level the author just chose rather than the one before it.
  const pathRef = useRef<Level[]>([]);

  const close = useCallback(() => {
    setMatch(null);
    setIndex(-1);
    pathRef.current = [];
    setPath([]);
  }, []);

  /** Select the trigger and the query typed after it — the run an insertion replaces. */
  const selectTypedRun = useCallback((chars: number) => {
    const sel = $getSelection();
    if (!$isRangeSelection(sel) || !sel.isCollapsed()) return null;
    const node = sel.anchor.getNode();
    if (!$isTextNode(node)) return null;
    const end = sel.anchor.offset;
    const start = end - chars;
    if (start < 0) return null;
    const range = $createRangeSelection();
    range.anchor.set(node.getKey(), start, 'text');
    range.focus.set(node.getKey(), end, 'text');
    $setSelection(range);
    return range;
  }, []);

  const insert = useCallback((token: string) => {
    const current = matchRef.current;
    if (!current) return;
    const consumed = current.query.length + trigger.length;
    editor.update(() => {
      selectTypedRun(consumed)?.insertNodes([$createVariableNode(vocab.freshInsertToken(token))]);
    });
    close();
    editor.focus();
  }, [editor, vocab, trigger, close, selectTypedRun]);

  /** Drop the typed query, keeping the trigger — each level starts its own filter. */
  const clearQuery = useCallback(() => {
    const chars = matchRef.current?.query.length ?? 0;
    if (!chars) return;
    editor.update(() => { selectTypedRun(chars)?.removeText(); });
  }, [editor, selectTypedRun]);

  // Recompute what the menu offers from the caret's trailing text and the level it has walked to.
  const refresh = useCallback(() => {
    let next: Match | null = null;
    editor.getEditorState().read(() => {
      const sel = $getSelection();
      if (!$isRangeSelection(sel) || !sel.isCollapsed()) return;
      const node = sel.anchor.getNode();
      if (!$isTextNode(node)) return;
      const before = node.getTextContent().slice(0, sel.anchor.offset);
      const at = before.lastIndexOf(trigger);
      if (at < 0) return;
      const query = before.slice(at + trigger.length);
      if (query.length > MAX_QUERY || query.includes(trigger)) return;
      const level = pathRef.current[pathRef.current.length - 1];
      const source = level ? vocab.drill?.(level.token) ?? [] : vocab.palette();
      const rows = source
        .filter((r) => r.label.toLowerCase().includes(query.toLowerCase()))
        .map((r) => ({ ...r, parts: (vocab.drill?.(r.token) ?? []).length > 0 }));
      // Nothing to offer and nothing to make means the trigger was meant literally, and the menu gets out
      // of the prose's way. Inside a level it waits instead: the author opened that on purpose, and a
      // filter that currently matches nothing is a keystroke away from matching again.
      if (!rows.length && !level && !(vocab.create && query.trim())) return;
      const rect = caretRect(editor.getRootElement());
      if (rect) next = { query, rows, rect };
    });
    // Leaving the run re-arms the menu, so a later trigger in the same field still opens.
    if (!next) { dismissed.current = false; return close(); }
    if (dismissed.current) return;
    const found = next as Match;
    setMatch(found);
    setIndex((i) => (found.rows.length ? Math.min(Math.max(i, 0), found.rows.length - 1) : -1));
  }, [editor, vocab, trigger, close]);

  useEffect(() => editor.registerUpdateListener(() => refresh()), [editor, refresh]);

  /** Step into a level or back out of one. Dropping the filter is what makes each level searchable on its
   *  own terms; the refresh covers the step taken with nothing typed, which edits nothing to listen to. */
  const walk = useCallback((levels: Level[]) => {
    pathRef.current = levels;
    setPath(levels);
    setIndex(-1);
    clearQuery();
    refresh();
  }, [clearQuery, refresh]);

  // The create row sits past the last chip row, so one index covers the whole menu.
  const createName = !path.length && vocab.create ? match?.query.trim() || null : null;
  const rows = match?.rows;
  const count = (rows?.length ?? 0) + (createName ? 1 : 0);
  const countRef = useRef(0);
  countRef.current = count;
  const createRef = useRef<string | null>(null);
  createRef.current = createName;

  const create = useCallback(() => {
    const name = createRef.current;
    const token = name ? vocab.create?.(name) : undefined;
    if (token) insert(token);
  }, [vocab, insert]);

  // Arrow/Enter/Tab/Escape belong to the menu only while it is open; otherwise they fall through to the
  // editor untouched (Enter in a single-line field, Tab moving focus out of the form).
  useEffect(() => mergeRegister(
    editor.registerCommand(KEY_ARROW_DOWN_COMMAND, (e) => {
      if (!matchRef.current || !countRef.current) return false;
      e?.preventDefault();
      setIndex((i) => (i + 1) % countRef.current);
      return true;
    }, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(KEY_ARROW_UP_COMMAND, (e) => {
      if (!matchRef.current || !countRef.current) return false;
      e?.preventDefault();
      setIndex((i) => (i <= 0 ? countRef.current - 1 : i - 1));
      return true;
    }, COMMAND_PRIORITY_HIGH),
    // Right walks into the highlighted row's parts; with nothing to walk into it stays the caret key it is.
    editor.registerCommand(KEY_ARROW_RIGHT_COMMAND, (e) => {
      const row = matchRef.current?.rows[indexRef.current];
      if (!row?.parts) return false;
      e?.preventDefault();
      walk([...pathRef.current, { token: row.token, label: row.label }]);
      return true;
    }, COMMAND_PRIORITY_HIGH),
    // Left backs out of a level; at the root there is none, so the caret keeps it.
    editor.registerCommand(KEY_ARROW_LEFT_COMMAND, (e) => {
      if (!matchRef.current || !pathRef.current.length) return false;
      e?.preventDefault();
      walk(pathRef.current.slice(0, -1));
      return true;
    }, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(KEY_ENTER_COMMAND, (e) => {
      const m = matchRef.current;
      if (!m || indexRef.current < 0) return false;
      e?.preventDefault();
      const row = m.rows[indexRef.current];
      if (row) insert(row.token);
      else create();
      return true;
    }, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(KEY_TAB_COMMAND, (e) => {
      const m = matchRef.current;
      if (!m || indexRef.current < 0) return false;
      e?.preventDefault();
      const row = m.rows[indexRef.current];
      if (row) insert(row.token);
      else create();
      return true;
    }, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(KEY_ESCAPE_COMMAND, () => {
      if (!matchRef.current) return false;
      dismissed.current = true;
      close();
      return true;
    }, COMMAND_PRIORITY_HIGH),
  ), [editor, insert, create, walk, close]);

  const breadcrumb = useMemo(() => path.map((l) => l.label).join(PATH_SEPARATOR), [path]);

  if (!match) return null;
  const items = match.rows;
  const parent = path.length > 1 ? path[path.length - 2].label : null;

  // Fixed to the caret and portaled to the body so a field inside a scroll pane or dialog isn't clipped by it.
  const MENU_MAX = 240;
  const below = match.rect.bottom + MENU_MAX < window.innerHeight;
  return createPortal(
    <div
      data-testid="chip-typeahead"
      // `pointer-events-auto`: a modal Radix dialog sets `pointer-events: none` on the body, so anything
      // portaled out of its content is visible but unclickable.
      className="pointer-events-auto fixed z-[70] w-56 rounded-md border border-border bg-popover p-1 shadow-md"
      style={{
        left: Math.min(match.rect.left, window.innerWidth - 240),
        ...(below ? { top: match.rect.bottom + 4 } : { bottom: window.innerHeight - match.rect.top + 4 }),
      }}
    >
      {path.length > 0 && (
        <button
          type="button"
          aria-label={parent ? `Back to ${parent}` : 'Back to All Placeholders'}
          // The editor must keep focus and its selection, exactly as for an insert.
          onMouseDown={(e) => { e.preventDefault(); walk(path.slice(0, -1)); }}
          className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-helper text-muted-foreground hover:bg-accent"
        >
          <span aria-hidden>‹</span>
          <span className="truncate">{breadcrumb}</span>
        </button>
      )}
      <div ref={scroller} className="max-h-56 overflow-y-auto">
        {items.map((item, i) => (
          <div key={item.token} className={cn('flex items-center rounded', i === index && 'bg-accent')}>
            <button
              type="button"
              data-testid="chip-typeahead-row"
              // The editor must keep focus and its selection: the insert reads the caret to know what to replace.
              onMouseDown={(e) => { e.preventDefault(); insert(item.token); }}
              onMouseEnter={() => setIndex(i)}
              className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1 text-left text-label"
            >
              <span className={cn(CHIP_BASE, 'border')} style={{ backgroundColor: item.color, color: '#000' }}>
                {item.label}
              </span>
            </button>
            {item.parts && (
              <button
                type="button"
                aria-label={`Show ${item.label} Parts`}
                onMouseDown={(e) => { e.preventDefault(); walk([...path, { token: item.token, label: item.label }]); }}
                onMouseEnter={() => setIndex(i)}
                className="shrink-0 px-1.5 py-1 text-label text-muted-foreground hover:text-foreground"
              >
                <span aria-hidden>›</span>
              </button>
            )}
          </div>
        ))}
        {!items.length && !createName && (
          <div className="px-1.5 py-1 text-helper text-muted-foreground">No parts match.</div>
        )}
      </div>
      {createName && (
        <button
          type="button"
          data-testid="chip-typeahead-create"
          onMouseDown={(e) => { e.preventDefault(); create(); }}
          onMouseEnter={() => setIndex(count - 1)}
          className={cn(
            'mt-1 flex w-full items-center gap-2 rounded border-t border-border px-1.5 py-1 text-left text-label',
            index === count - 1 && 'bg-accent',
          )}
        >
          <span aria-hidden>+</span>
          <span className="truncate">{`New Placeholder "${createName}"`}</span>
        </button>
      )}
    </div>,
    document.body,
  );
}

export default ChipTypeaheadPlugin;
