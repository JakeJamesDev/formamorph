import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  $getSelection, $isRangeSelection, $isTextNode, $createRangeSelection, $setSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_DOWN_COMMAND, KEY_ARROW_UP_COMMAND, KEY_ENTER_COMMAND, KEY_ESCAPE_COMMAND, KEY_TAB_COMMAND,
} from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { CHIP_BASE } from '@/components/Chip';
import { cn } from '@/lib/utils';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { $createVariableNode } from './VariableNode';

/**
 * Insert a chip by typing rather than reaching for a palette: the trigger character opens a filtered menu
 * of the vocabulary's tokens at the caret, and choosing one swaps the typed run for the chip.
 *
 * The menu only stays open while something matches, so a trigger character meant literally closes it as
 * soon as the following words rule every token out — typing prose never has to fight the menu.
 */

/** How many characters may follow the trigger before it is read as ordinary prose rather than a query. */
const MAX_QUERY = 32;

interface Match {
  query: string;
  items: { token: string; label: string; color?: string }[];
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
  const [index, setIndex] = useState(0);
  // Set by Escape so the menu stays shut for the run the caret is in; cleared once the run breaks.
  const dismissed = useRef(false);
  // Read by the key handlers, which are registered once and must not close over stale state.
  const matchRef = useRef<Match | null>(null);
  matchRef.current = match;
  const indexRef = useRef(0);
  indexRef.current = index;

  const close = useCallback(() => { setMatch(null); setIndex(0); }, []);

  const insert = useCallback((token: string) => {
    const current = matchRef.current;
    if (!current) return;
    const consumed = current.query.length + trigger.length;
    editor.update(() => {
      const sel = $getSelection();
      if (!$isRangeSelection(sel) || !sel.isCollapsed()) return;
      const node = sel.anchor.getNode();
      if (!$isTextNode(node)) return;
      const end = sel.anchor.offset;
      const start = end - consumed;
      if (start < 0) return;
      // Select the typed trigger+query so inserting the chip replaces it rather than appending after it.
      const range = $createRangeSelection();
      range.anchor.set(node.getKey(), start, 'text');
      range.focus.set(node.getKey(), end, 'text');
      $setSelection(range);
      range.insertNodes([$createVariableNode(vocab.freshInsertToken(token))]);
    });
    close();
    editor.focus();
  }, [editor, vocab, trigger, close]);

  // Track the caret's trailing text and decide whether it reads as a query.
  useEffect(() => editor.registerUpdateListener(({ editorState }) => {
    const palette = vocab.palette();
    if (!palette.length) return close();
    let next: Match | null = null;
    editorState.read(() => {
      const sel = $getSelection();
      if (!$isRangeSelection(sel) || !sel.isCollapsed()) return;
      const node = sel.anchor.getNode();
      if (!$isTextNode(node)) return;
      const before = node.getTextContent().slice(0, sel.anchor.offset);
      const at = before.lastIndexOf(trigger);
      if (at < 0) return;
      const query = before.slice(at + trigger.length);
      if (query.length > MAX_QUERY || query.includes(trigger)) return;
      const items = palette.filter((p) => p.label.toLowerCase().includes(query.toLowerCase()));
      if (!items.length) return;
      const rect = caretRect(editor.getRootElement());
      if (rect) next = { query, items, rect };
    });
    // Leaving the run re-arms the menu, so a later trigger in the same field still opens.
    if (!next) { dismissed.current = false; return close(); }
    if (dismissed.current) return;
    setMatch(next);
    setIndex((i) => Math.min(i, (next as Match).items.length - 1));
  }), [editor, vocab, trigger, close]);

  // Arrow/Enter/Tab/Escape belong to the menu only while it is open; otherwise they fall through to the
  // editor untouched (Enter in a single-line field, Tab moving focus out of the form).
  useEffect(() => mergeRegister(
    editor.registerCommand(KEY_ARROW_DOWN_COMMAND, (e) => {
      const m = matchRef.current;
      if (!m) return false;
      e?.preventDefault();
      setIndex((i) => (i + 1) % m.items.length);
      return true;
    }, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(KEY_ARROW_UP_COMMAND, (e) => {
      const m = matchRef.current;
      if (!m) return false;
      e?.preventDefault();
      setIndex((i) => (i - 1 + m.items.length) % m.items.length);
      return true;
    }, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(KEY_ENTER_COMMAND, (e) => {
      const m = matchRef.current;
      if (!m) return false;
      e?.preventDefault();
      insert(m.items[indexRef.current].token);
      return true;
    }, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(KEY_TAB_COMMAND, (e) => {
      const m = matchRef.current;
      if (!m) return false;
      e?.preventDefault();
      insert(m.items[indexRef.current].token);
      return true;
    }, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(KEY_ESCAPE_COMMAND, () => {
      if (!matchRef.current) return false;
      dismissed.current = true;
      close();
      return true;
    }, COMMAND_PRIORITY_HIGH),
  ), [editor, insert, close]);

  if (!match) return null;

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
      <div className="max-h-56 overflow-y-auto">
        {match.items.map((item, i) => (
          <button
            key={item.token}
            type="button"
            // The editor must keep focus and its selection: the insert reads the caret to know what to replace.
            onMouseDown={(e) => { e.preventDefault(); insert(item.token); }}
            onMouseEnter={() => setIndex(i)}
            className={cn(
              'flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm',
              i === index && 'bg-accent',
            )}
          >
            <span className={cn(CHIP_BASE, 'border')} style={{ backgroundColor: item.color, color: '#000' }}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

export default ChipTypeaheadPlugin;
