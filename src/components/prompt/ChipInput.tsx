import { useEffect, useMemo, useRef } from 'react';
import {
  $getRoot, $createTextNode, LineBreakNode,
  KEY_ENTER_COMMAND, COMMAND_PRIORITY_LOW,
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

/** Keeps the field to one line: Enter does nothing, and any line break that arrives by paste or by the
 *  external value becomes a space. */
function SingleLinePlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    const stopEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => { event?.preventDefault(); return true; },
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

const ChipInput = ({ value, onChange, vocabulary, placeholder, ariaLabel, className, readOnly = false, trigger = '{' }: {
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
          <SingleLinePlugin />
          <EditablePlugin readOnly={readOnly} />
          <ChipInsertTargetPlugin vocab={vocabulary} />
          {trigger && !readOnly && <ChipTypeaheadPlugin trigger={trigger} vocab={vocabulary} />}
        </PromptDragContext.Provider>
      </ChipVocabularyContext.Provider>
    </LexicalComposer>
  );
};

export default ChipInput;
