/**
 * The CodeMirror editor behind `CodeArea`, wrapped as one plain object the component can drive.
 *
 * A session owns a single `EditorView`. The inline field and the full-screen overlay take turns hosting
 * that one view rather than each mounting their own, which is what makes undo history survive the toggle —
 * and what lets the morph measure the box the editor is actually in.
 *
 * Loaded on demand: only the world editor's code fields reach this module, so gameplay never fetches it.
 */

import { Compartment, EditorState, RangeSetBuilder, type Extension } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, placeholder as placeholderExt, highlightSpecialChars, drawSelection,
  rectangularSelection, crosshairCursor, Decoration, ViewPlugin, type DecorationSet, type ViewUpdate,
} from '@codemirror/view';
import {
  defaultKeymap, history, historyKeymap, indentLess, indentMore, isolateHistory, redo, redoDepth,
  undo, undoDepth,
} from '@codemirror/commands';
import {
  bracketMatching, indentOnInput, syntaxHighlighting, indentUnit,
} from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { codeHighlightStyle, SLOT_CLASS } from '@/lib/codeHighlight';
import { findSlotRanges } from '@/lib/statCodeTemplates';
import type { InsertSnippet } from '@/lib/codeSnippets';

/** Marks `{{slot}}` spans in the editor with the same class the read-only previews use. */
const slotDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = build(view); }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) this.decorations = build(update.view);
    }
  },
  { decorations: (value) => value.decorations },
);

const slotMark = Decoration.mark({ class: SLOT_CLASS });

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  // Whole-document rather than viewport-only: stat code is short, and a builder wants its ranges in order
  // anyway, so there is nothing to win by chasing visible ranges here.
  for (const { from, to } of findSlotRanges(view.state.doc.toString())) builder.add(from, to, slotMark);
  return builder.finish();
}

const editorTheme = EditorView.theme({
  // Grown by its host rather than sized in percentages: the host is a flex column with a floor, and a
  // percentage height against that resolves to the content's own height and leaves dead space below it.
  '&': { flex: '1 1 auto', minHeight: 0, fontSize: 'inherit', backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { flex: '1 1 auto', fontFamily: 'inherit', lineHeight: '1.5', overflow: 'auto' },
  '.cm-content': { padding: '0.5rem 0', caretColor: 'hsl(var(--foreground))' },
  '.cm-line': { padding: '0 0.75rem' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'hsl(var(--foreground))' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection':
    { backgroundColor: 'hsl(var(--primary) / 0.35)' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'hsl(var(--muted-foreground))',
    borderRight: '1px solid hsl(var(--border))',
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'hsl(var(--primary) / 0.3)',
    outline: 'none',
  },
  '.cm-nonmatchingBracket': { backgroundColor: 'hsl(var(--destructive) / 0.3)' },
  '.cm-placeholder': { color: 'hsl(var(--muted-foreground))' },
});

export interface CodeSession {
  /** The editor's root element, moved between the inline field and the overlay. */
  dom: HTMLElement;
  /** Write a value that came from outside the editor (the parent owns the text). */
  setValue: (value: string) => void;
  insert: (snippet: InsertSnippet) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  setLineNumbers: (show: boolean) => void;
  focus: () => void;
  destroy: () => void;
}

export interface CodeSessionOptions {
  doc: string;
  ariaLabel: string;
  placeholder?: string;
  /** Decorate `{{name:type=default}}` spans. Template editing only. */
  slots?: boolean;
  onChange: (value: string) => void;
  /** Any update at all, so the toolbar can re-read what undo and redo have to offer. */
  onUpdate?: () => void;
}

export function createCodeSession(options: CodeSessionOptions): CodeSession {
  const gutter = new Compartment();
  let applyingExternal = false;
  /** Set by Escape, so the next Tab moves focus instead of indenting — otherwise a keyboard-only user is
   *  trapped in the field. Spent by that Tab, and dropped by anything else typed in between. */
  let tabEscapes = false;

  /** Tab indents, except immediately after Escape, where declining it hands the key back to the browser and
   *  focus leaves the field. This is the only Tab binding, so nothing downstream can indent behind it. */
  const tabKeys: Extension = keymap.of([
    // Returning false lets Escape through to whatever is listening — the full-screen overlay closes on it.
    { key: 'Escape', run: () => { tabEscapes = true; return false; } },
    {
      key: 'Tab',
      run: (target) => { if (!tabEscapes) return indentMore(target); tabEscapes = false; return false; },
      shift: (target) => { if (!tabEscapes) return indentLess(target); tabEscapes = false; return false; },
    },
  ]);

  const view = new EditorView({
    state: EditorState.create({
      doc: options.doc,
      extensions: [
        history(),
        highlightSpecialChars(),
        drawSelection(),
        rectangularSelection(),
        crosshairCursor(),
        indentOnInput(),
        bracketMatching(),
        indentUnit.of('  '),
        EditorView.lineWrapping,
        javascript(),
        syntaxHighlighting(codeHighlightStyle),
        options.slots ? slotDecorations : [],
        gutter.of([]),
        tabKeys,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.domEventHandlers({
          keydown: (event) => { if (event.key !== 'Escape' && event.key !== 'Tab') tabEscapes = false; },
        }),
        editorTheme,
        EditorView.contentAttributes.of({ 'aria-label': options.ariaLabel }),
        options.placeholder ? placeholderExt(options.placeholder) : [],
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !applyingExternal) options.onChange(update.state.doc.toString());
          if (update.docChanged || update.selectionSet || update.transactions.length) options.onUpdate?.();
        }),
      ],
    }),
  });

  return {
    dom: view.dom,
    setValue(value) {
      if (value === view.state.doc.toString()) return;
      applyingExternal = true;
      try {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
      } finally {
        applyingExternal = false;
      }
    },
    insert(snippet) {
      const { from, to } = view.state.selection.main;
      const offset = snippet.select ? snippet.text.indexOf(snippet.select) : -1;
      const anchor = offset >= 0 ? from + offset : from + snippet.text.length;
      const head = offset >= 0 ? anchor + snippet.select!.length : anchor;
      view.dispatch({
        changes: { from, to, insert: snippet.text },
        selection: { anchor, head },
        // Its own undo step, whatever was typed either side of it.
        annotations: isolateHistory.of('full'),
        userEvent: 'input.snippet',
      });
      view.focus();
    },
    undo() { undo(view); view.focus(); },
    redo() { redo(view); view.focus(); },
    canUndo: () => undoDepth(view.state) > 0,
    canRedo: () => redoDepth(view.state) > 0,
    setLineNumbers(show) {
      view.dispatch({ effects: gutter.reconfigure(show ? lineNumbers() : []) });
    },
    focus() { view.focus(); },
    destroy() { view.destroy(); },
  };
}
