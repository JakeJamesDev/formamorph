/**
 * The CodeMirror editor behind `CodeArea`, wrapped as one plain object the component can drive.
 *
 * A session owns a single `EditorView`. The inline field and the full-screen overlay take turns hosting
 * that one view rather than each mounting their own, which is what makes undo history survive the toggle —
 * and what lets the morph measure the box the editor is actually in.
 *
 * Loaded on demand: only the world editor's code fields reach this module, so gameplay never fetches it.
 */

import { Compartment, EditorState, RangeSetBuilder, StateEffect, type Extension } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, placeholder as placeholderExt, highlightSpecialChars, drawSelection,
  rectangularSelection, crosshairCursor, tooltips, Decoration, ViewPlugin,
  type DecorationSet, type ViewUpdate,
} from '@codemirror/view';
import {
  defaultKeymap, history, historyKeymap, indentLess, indentMore, isolateHistory, redo, redoDepth,
  undo, undoDepth,
} from '@codemirror/commands';
import {
  bracketMatching, getIndentUnit, getIndentation, indentOnInput, indentString, syntaxHighlighting,
  indentUnit,
} from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import {
  acceptCompletion, autocompletion,
  type CompletionContext, type CompletionResult as CMCompletionResult,
} from '@codemirror/autocomplete';
import { forceLinting, linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import { codeHighlightStyle, SLOT_CLASS } from '@/lib/codeHighlight';
import { findSlotRanges } from '@/lib/statCodeTemplates';
import { statCodeCompletions, statCodeDiagnostics, type CodePlaceholders } from '@/lib/statCodeAnalysis';
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
  '.cm-scroller': {
    flex: '1 1 auto',
    fontFamily: 'inherit',
    lineHeight: '1.5',
    overflow: 'auto',
    // `!important` because CodeMirror's base theme marks its own `flex-start` that way. Stretching the
    // row is what makes the code area fill a field taller than what has been typed into it.
    alignItems: 'stretch !important',
  },
  '.cm-content': {
    padding: '0.5rem 0',
    caretColor: 'hsl(var(--foreground))',
    // The rule between gutter and code is drawn here rather than as the gutter's right border: the
    // gutter is only ever as tall as the code it holds and won't stretch, so its border stopped
    // mid-box. This edge sits at exactly the same place and runs the height of the field.
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'hsl(var(--border))',
  },
  '.cm-line': { padding: '0 0.75rem' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'hsl(var(--foreground))' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection':
    { backgroundColor: 'hsl(var(--primary) / 0.35)' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'hsl(var(--muted-foreground))',
    // CodeMirror draws its own rule here; the one that runs the full height is `.cm-content`'s left edge.
    borderRight: 'none',
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'hsl(var(--primary) / 0.3)',
    outline: 'none',
  },
  '.cm-nonmatchingBracket': { backgroundColor: 'hsl(var(--destructive) / 0.3)' },
  '.cm-placeholder': { color: 'hsl(var(--muted-foreground))' },
  // The popup and the squiggles hand out no colors of their own: both ride the app's tokens, so light
  // and dark come from the same place every other surface reads.
  // No `overflow: hidden` on the tooltip itself: the completion info pane is an absolutely-positioned
  // CHILD of it hanging at `left: 100%`, so clipping the tooltip erases the pane. The list clips instead.
  '.cm-tooltip.cm-tooltip-autocomplete': {
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.375rem',
    backgroundColor: 'hsl(var(--popover))',
    color: 'hsl(var(--popover-foreground))',
    boxShadow: '0 4px 12px hsl(var(--foreground) / 0.12)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    fontFamily: 'inherit',
    maxHeight: '14rem',
    borderRadius: 'calc(0.375rem - 1px)',
    overflow: 'hidden auto',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': { padding: '0.2rem 0.5rem', lineHeight: '1.5' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'hsl(var(--accent))',
    color: 'hsl(var(--accent-foreground))',
  },
  '.cm-completionDetail': { color: 'hsl(var(--muted-foreground))', fontStyle: 'normal', marginLeft: '0.5rem' },
  '.cm-completionMatchedText': { textDecoration: 'none', fontWeight: '600', color: 'hsl(var(--primary))' },
  '.cm-tooltip.cm-completionInfo': {
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.375rem',
    backgroundColor: 'hsl(var(--popover))',
    color: 'hsl(var(--muted-foreground))',
    padding: '0.375rem 0.5rem',
    maxWidth: '18rem',
  },
  '.cm-diagnostic': {
    backgroundColor: 'hsl(var(--popover))',
    color: 'hsl(var(--popover-foreground))',
    borderLeftWidth: '3px',
    padding: '0.25rem 0.5rem',
  },
  '.cm-diagnostic-error': { borderLeftColor: 'hsl(var(--destructive))' },
  '.cm-diagnostic-warning': { borderLeftColor: 'hsl(var(--warning))' },
  '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy hsl(var(--destructive))' },
  '.cm-lintRange-warning': { backgroundImage: 'none', textDecoration: 'underline wavy hsl(var(--warning))' },
  '.cm-tooltip.cm-tooltip-lint': {
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.375rem',
    backgroundColor: 'hsl(var(--popover))',
  },
  '.cm-gutter-lint .cm-gutterElement': { padding: '0 0.2rem' },
});

/** Tooltips hang off `<body>` so nothing clips them, which puts them under the `pointer-events: none` a
 *  Radix dialog pins to the body — the completion list draws fine and swallows every click. `auto` on the
 *  host buys hit-testing back. Stopping propagation on the way out keeps a dismiss-on-outside-click layer
 *  from reading a pick as a click elsewhere; bubble phase, so the option is applied before the event dies. */
let tooltipHost: HTMLElement | null = null;
function getTooltipHost(): HTMLElement | undefined {
  if (typeof document === 'undefined') return undefined;
  if (!tooltipHost) {
    tooltipHost = document.createElement('div');
    tooltipHost.style.pointerEvents = 'auto';
    // Wheel and touch for the same reason as the pointer: a dialog's scroll lock listens on the document
    // and preventDefaults any scroll whose target sits outside the dialog, which is every option in a
    // body-parented list. Stopping the event here means it never reaches that listener.
    for (const type of ['pointerdown', 'wheel', 'touchmove']) {
      tooltipHost.addEventListener(type, (event) => event.stopPropagation());
    }
    document.body.appendChild(tooltipHost);
  }
  return tooltipHost;
}

/**
 * What Tab does to the document, following VS Code's own rule rather than always shifting the line:
 * a blank line takes the indent its syntax asks for, a caret takes one indent unit where it stands,
 * a selection inside one line is typed over, and only whole or multiple lines move as a block.
 */
function tabIndent(view: EditorView): boolean {
  const { state } = view;
  const range = state.selection.main;
  const first = state.doc.lineAt(range.from);
  const last = state.doc.lineAt(range.to);
  const wholeLine = range.from === first.from && range.to === first.to;
  if (first.number !== last.number || (!range.empty && wholeLine)) return indentMore(view);

  if (range.empty && !/\S/.test(first.text)) {
    const wanted = getIndentation(state, first.from);
    const good = wanted == null ? '' : indentString(state, wanted);
    // Already at or past the depth the syntax asks for, so Tab goes on adding units from here.
    if (good && !first.text.startsWith(good)) {
      view.dispatch(state.update({
        changes: { from: first.from, to: first.to, insert: good },
        selection: { anchor: first.from + good.length },
        userEvent: 'input.indent',
        scrollIntoView: true,
      }));
      return true;
    }
  }

  const unit = indentString(state, getIndentUnit(state));
  view.dispatch(state.update(state.replaceSelection(unit), {
    userEvent: 'input.indent',
    scrollIntoView: true,
  }));
  return true;
}

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
  /** Show the margin of lint marks beside the line numbers. Full screen only — it costs a column. */
  setLintGutter: (show: boolean) => void;
  /** The world's stat names, for completions and name checks. Re-lints when the names change. */
  setStatNames: (names: readonly string[] | undefined) => void;
  /** The name of the stat the code belongs to. Re-lints when it changes. */
  setSelfName: (name: string | undefined) => void;
  /** The world's placeholders, for completions and name checks. Re-lints when the list changes. */
  setPlaceholders: (placeholders: CodePlaceholders | undefined) => void;
  /** The world's trait names, for completions and name checks. Re-lints when the list changes. */
  setTraits: (traits: readonly string[] | undefined) => void;
  focus: () => void;
  destroy: () => void;
}

export interface CodeSessionOptions {
  doc: string;
  ariaLabel: string;
  placeholder?: string;
  /** Decorate `{{name:type=default}}` spans. Template editing only. */
  slots?: boolean;
  /** The world's stat names. Absent, stat names are neither offered nor checked. */
  statNames?: readonly string[];
  /** The name of the stat the code belongs to, so a write through `stats` to it counts as its own. */
  selfName?: string;
  /** The world's placeholders. Absent, placeholder names are neither offered nor checked. */
  placeholders?: CodePlaceholders;
  /** The world's trait names. Absent, trait names are neither offered nor checked. */
  traits?: readonly string[];
  onChange: (value: string) => void;
  /** Any update at all, so the toolbar can re-read what undo and redo have to offer. */
  onUpdate?: () => void;
}

const sameNames = (a?: readonly string[], b?: readonly string[]) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((name, i) => name === b[i]));

/** A world list the linter reads changed. `forceLinting` alone does nothing once the last lint has settled. */
const worldListsChanged = StateEffect.define<null>();

export function createCodeSession(options: CodeSessionOptions): CodeSession {
  const gutter = new Compartment();
  let applyingExternal = false;
  // Held rather than captured: the stat list changes while the editor is open, and the editor outlives
  // every render that could rebuild an extension around it.
  let statNames: readonly string[] | undefined = options.statNames;
  let selfName: string | undefined = options.selfName;
  let placeholders: CodePlaceholders | undefined = options.placeholders;
  let traits: readonly string[] | undefined = options.traits;

  /** The one completion source. Everything it offers comes from the analysis module; nothing here knows
   *  what the sandbox exposes. */
  const completeStatCode = (context: CompletionContext): CMCompletionResult | null => {
    const doc = context.state.doc.toString();
    const result = statCodeCompletions(doc, context.pos, { slots: options.slots, statNames, selfName, placeholders, traits });
    if (!result || result.options.length === 0) return null;
    // Explicit means the author asked for the list; otherwise an empty word is every option at once.
    if (!context.explicit && result.from === result.to && !context.matchBefore(/["'.]|\{\{/)) return null;
    // No `validFor`: which list applies depends on where the caret is, and a stat name may carry a space,
    // so re-asking on every keystroke is both cheaper to reason about and always right.
    return { from: result.from, to: result.to, options: result.options };
  };

  const statCodeLinter = linter(
    (view): Diagnostic[] => statCodeDiagnostics(view.state.doc.toString(), { slots: options.slots, statNames, selfName, placeholders, traits }),
    {
      delay: 400,
      needsRefresh: (update) => update.transactions.some((tr) => tr.effects.some((effect) => effect.is(worldListsChanged))),
    },
  );
  /** Set by Escape, so the next Tab moves focus instead of indenting — otherwise a keyboard-only user is
   *  trapped in the field. Spent by that Tab, and dropped by anything else typed in between. */
  let tabEscapes = false;

  /** Tab takes the highlighted completion, then indents, except immediately after Escape, where declining
   *  it hands the key back to the browser and focus leaves the field. These are the only Tab bindings, so
   *  nothing downstream can indent behind them. */
  const tabKeys: Extension = keymap.of([
    // Returning false lets Escape through to whatever is listening — the full-screen overlay closes on it.
    // An open completion popup takes the key before this binding is reached, so the Escape that dismisses
    // a list neither arms the tab escape nor shuts the window behind it.
    { key: 'Escape', run: () => { tabEscapes = true; return false; } },
    // Handlers for one key run in the order written, first true wins. `acceptCompletion` returns false
    // with no popup open, so Tab falls through to indenting on its own — no flag tracks the popup.
    { key: 'Tab', run: acceptCompletion },
    {
      key: 'Tab',
      run: (target) => { if (!tabEscapes) return tabIndent(target); tabEscapes = false; return false; },
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
        autocompletion({
          override: [completeStatCode],
          // A tap on the list is the only way to take a completion on a touch keyboard, and the default
          // closes the popup on the blur the tap causes.
          closeOnBlur: false,
          icons: false,
        }),
        statCodeLinter,
        // A completion list or a diagnostic is taller than the field it belongs to, so it is positioned
        // against the window instead — otherwise the box, the panel it scrolls in, or the dialog around
        // it cuts the popup off wherever the caret happens to be low.
        tooltips({ position: 'fixed', parent: getTooltipHost() }),
        // Marks first, then numbers: gutters sit in the order they are registered, and the marks belong
        // on the outside edge where nothing shifts them as the line count grows a digit.
        gutter.of([]),
        lineNumbers(),
        tabKeys,
        // `autocompletion()` installs `completionKeymap` at the top precedence itself, which is what puts
        // the popup ahead of the Escape binding above.
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

  const relint = () => {
    view.dispatch({ effects: worldListsChanged.of(null) });
    forceLinting(view);
  };

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
    // A rename or a new entry can clear or raise a name diagnostic with no edit to the code. The owner hands
    // a fresh stat list on every edit to any stat, the code included, so only new names re-lint.
    setStatNames(next) {
      if (sameNames(next, statNames)) return;
      statNames = next;
      relint();
    },
    setSelfName(next) {
      if (next === selfName) return;
      selfName = next;
      relint();
    },
    setPlaceholders(next) {
      if (next === placeholders) return;
      placeholders = next;
      relint();
    },
    setTraits(next) {
      if (next === traits) return;
      traits = next;
      relint();
    },
    setLintGutter(show) {
      view.dispatch({ effects: gutter.reconfigure(show ? lintGutter() : []) });
    },
    focus() { view.focus(); },
    destroy() { view.destroy(); },
  };
}
