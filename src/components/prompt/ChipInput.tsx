import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  $getRoot, $createTextNode, $selectAll, LineBreakNode,
  KEY_ENTER_COMMAND, KEY_ESCAPE_COMMAND, COMMAND_PRIORITY_LOW,
} from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ChipVocabularyContext, type ChipVocabulary } from '@/lib/chipVocabulary';
import { cn } from '@/lib/utils';
import { VariableNode, PromptDragContext } from './VariableNode';
import { buildEditorState, serializeRoot } from './promptFieldState';
import { ChipTypeaheadPlugin } from './ChipTypeahead';
import { ChipInsertTargetPlugin } from './ChipInsertTarget';
import { ChipDragPlugin } from './ChipDrag';

/**
 * A one-line chip editor shaped like an ordinary text input — for name fields, where the full prompt editor's
 * tabs, toolbars and full-screen belong to prose, not to a label a few words long. Chips render inline and
 * store the same token string as every other chip field; the only insert paths are the typeahead and the
 * panel's shared palette, so the field itself carries no chrome.
 *
 * Line breaks are stripped rather than blocked outright, so a multi-line paste flattens instead of being
 * rejected.
 */

// Matches the shadcn Input shape (see components/ui/input.tsx); min-height rather than a fixed one so a name
// long enough to wrap grows the box instead of hiding its own end.
const INPUT_CLASS =
  'flex min-h-10 w-full flex-wrap items-center gap-y-0.5 rounded-md border border-input bg-background ' +
  'px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

/** Two-way sync between the controlled string and the editor state (the single-line twin of PromptField's). */
function ValueSyncPlugin({ value, onChange, parse }: {
  value: string;
  onChange: (v: string) => void;
  parse: ChipVocabulary['parse'];
}) {
  const [editor] = useLexicalComposerContext();
  const expected = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const parseRef = useRef(parse);
  parseRef.current = parse;

  useEffect(() => {
    if (value === expected.current) return;
    expected.current = value;
    editor.update(() => buildEditorState(value, parseRef.current));
  }, [value, editor]);

  useEffect(
    () => editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const next = serializeRoot();
        if (next === expected.current) return;
        expected.current = next;
        onChangeRef.current(next);
      });
    }),
    [editor],
  );
  return null;
}

/** Keeps the field to one line: Enter never breaks the line, and any line break that arrives by paste or
 *  by the external value becomes a space. A host that wants Enter to mean something (a tag input, where it
 *  commits the tag) gets it through `onSubmit`. */
function SingleLinePlugin({ onSubmit }: { onSubmit?: () => void }) {
  const [editor] = useLexicalComposerContext();
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  useEffect(() => {
    const stopEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => { event?.preventDefault(); submitRef.current?.(); return true; },
      // Below the typeahead's HIGH so its Enter-to-insert still wins while its menu is open.
      COMMAND_PRIORITY_LOW,
    );
    const flatten = editor.registerNodeTransform(LineBreakNode, (node) => {
      node.replace($createTextNode(' '));
    });
    return () => { stopEnter(); flatten(); };
  }, [editor]);
  return null;
}

/** Reports focus leaving the editor. A DOM listener on the root rather than Lexical's BLUR_COMMAND, for the
 *  same reason the insert-target plugin uses focusin: the command does not cover every route out. */
function BlurPlugin({ onBlur }: { onBlur: () => void }) {
  const [editor] = useLexicalComposerContext();
  const ref = useRef(onBlur);
  ref.current = onBlur;
  useEffect(() => editor.registerRootListener((root, prevRoot) => {
    const fire = () => ref.current();
    prevRoot?.removeEventListener('focusout', fire);
    root?.addEventListener('focusout', fire);
  }), [editor]);
  return null;
}

/** Focus the field on mount with everything selected, so an inline edit behaves like the text input it
 *  replaces: start typing and the old value goes. */
function AutoFocusPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    // $selectAll, not a root select(0, n): the latter addresses child indices, which for a value that is a
    // single paragraph selects nothing useful.
    editor.update(() => { $selectAll(); });
    editor.focus();
  }, [editor]);
  return null;
}

/** Escape, once the insert menu is not the one consuming it — an inline edit uses it to abandon the change. */
function CancelPlugin({ onCancel }: { onCancel: () => void }) {
  const [editor] = useLexicalComposerContext();
  const ref = useRef(onCancel);
  ref.current = onCancel;
  useEffect(() => editor.registerCommand(
    KEY_ESCAPE_COMMAND,
    () => { ref.current(); return true; },
    // Below the typeahead's HIGH, so Escape first dismisses its menu and only then abandons the edit.
    COMMAND_PRIORITY_LOW,
  ), [editor]);
  return null;
}

/** Reflects `readOnly` into editability (initialConfig only applies it at mount). */
function EditablePlugin({ readOnly }: { readOnly: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => editor.setEditable(!readOnly), [editor, readOnly]);
  return null;
}

/** Puts the caret at the end when the field is clicked in its empty right-hand space, so clicking the box
 *  anywhere behaves like clicking an input rather than doing nothing. */
function useFocusEnd() {
  const [editor] = useLexicalComposerContext();
  return () => {
    editor.update(() => { $getRoot().selectEnd(); });
    editor.focus();
  };
}

function Surface({ placeholder, ariaLabel, className }: {
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const focusEnd = useFocusEnd();
  return (
    <div className="relative" onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); focusEnd(); } }}>
      <PlainTextPlugin
        contentEditable={<ContentEditable className={cn(INPUT_CLASS, className)} aria-label={ariaLabel} />}
        placeholder={
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 truncate text-sm text-muted-foreground">
            {placeholder}
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
    </div>
  );
}

const ChipInput = ({ value, onChange, vocabulary, placeholder, ariaLabel, className, readOnly = false, trigger = '{', onSubmit, onBlur, multiline = false, children, autoFocus = false, onCancel }: {
  value: string;
  onChange: (v: string) => void;
  vocabulary: ChipVocabulary;
  placeholder?: string;
  /** Names the editor for a screen reader — Lexical renders a `div`, so `<label htmlFor>` cannot reach it. */
  ariaLabel?: string;
  className?: string;
  readOnly?: boolean;
  /** Character that opens the insert menu; pass `undefined` to leave typing untouched. */
  trigger?: string;
  /** Enter, once the insert menu is not the one consuming it. For tag inputs, where Enter commits. */
  onSubmit?: () => void;
  /** Focus leaving the field — a tag input commits a half-typed tag on the way out. */
  onBlur?: () => void;
  /** Let the value wrap onto real lines. The tag field wants this; a name never does. */
  multiline?: boolean;
  /** Extra Lexical plugins, rendered inside this field's composer (e.g. the tag autocomplete). */
  children?: ReactNode;
  /** Take focus on mount, selecting the current value. For a field that replaces a chip on double-click. */
  autoFocus?: boolean;
  /** Escape pressed with no menu open — abandon the edit. */
  onCancel?: () => void;
}) => {
  const dragKey = useRef<string | null>(null);
  const initialConfig = useMemo(
    () => ({
      namespace: 'ChipInput',
      nodes: [VariableNode],
      onError: (error: Error) => { throw error; },
      editable: !readOnly,
      editorState: () => buildEditorState(value, vocabulary.parse),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only the mount-time value seeds the editor
    [],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <ChipVocabularyContext.Provider value={vocabulary}>
        <PromptDragContext.Provider value={dragKey}>
          <Surface placeholder={placeholder} ariaLabel={ariaLabel} className={className} />
          <HistoryPlugin />
          <ValueSyncPlugin value={value} onChange={onChange} parse={vocabulary.parse} />
          {!multiline && <SingleLinePlugin onSubmit={onSubmit} />}
          {onBlur && <BlurPlugin onBlur={onBlur} />}
          {autoFocus && <AutoFocusPlugin />}
          {onCancel && <CancelPlugin onCancel={onCancel} />}
          <EditablePlugin readOnly={readOnly} />
          <ChipInsertTargetPlugin vocab={vocabulary} />
          <ChipDragPlugin dragKey={dragKey} vocab={readOnly ? undefined : vocabulary} />
          {trigger && !readOnly && <ChipTypeaheadPlugin trigger={trigger} vocab={vocabulary} />}
          {children}
        </PromptDragContext.Provider>
      </ChipVocabularyContext.Provider>
    </LexicalComposer>
  );
};

export default ChipInput;
