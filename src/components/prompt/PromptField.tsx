import { useEffect, useMemo, useRef, useState } from 'react';
import {
  $getRoot, $getNodeByKey, $getSelection, $isRangeSelection, $createRangeSelection, $setSelection,
  $insertNodes, $createParagraphNode, $createTextNode, $createLineBreakNode,
  $isElementNode, $isTextNode, $isLineBreakNode,
  COMMAND_PRIORITY_LOW, COMMAND_PRIORITY_HIGH, DRAGOVER_COMMAND, DROP_COMMAND,
  type LexicalNode, type ElementNode,
} from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CHIP_BASE } from '@/components/Chip';
import { parsePromptTemplate } from '@/lib/promptTemplate';
import { colorForToken, type PromptVariable } from '@/lib/promptVariables';
import { cn } from '@/lib/utils';
import { VariableNode, $createVariableNode, $isVariableNode, PromptDragContext } from './VariableNode';

// --- string <-> editor conversion (a single plain-text paragraph of text / line breaks / chips) ---

function appendSegments(para: ElementNode, value: string) {
  for (const seg of parsePromptTemplate(value)) {
    if (seg.type === 'variable') {
      para.append($createVariableNode(seg.token));
      continue;
    }
    seg.value.split('\n').forEach((line, i) => {
      if (i > 0) para.append($createLineBreakNode());
      if (line.length) para.append($createTextNode(line));
    });
  }
}

function buildEditorState(value: string) {
  const root = $getRoot();
  root.clear();
  const para = $createParagraphNode();
  appendSegments(para, value);
  root.append(para);
}

function serializeNode(node: LexicalNode): string {
  if ($isVariableNode(node)) return node.getToken();
  if ($isLineBreakNode(node)) return '\n';
  if ($isTextNode(node)) return node.getTextContent();
  if ($isElementNode(node)) return node.getChildren().map(serializeNode).join('');
  return '';
}

function serializeRoot(): string {
  return $getRoot().getChildren().map(serializeNode).join('\n');
}

function caretRangeFromPoint(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretRangeFromPoint) return doc.caretRangeFromPoint(x, y);
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (!pos) return null;
  const range = document.createRange();
  range.setStart(pos.offsetNode, pos.offset);
  range.collapse(true);
  return range;
}

// --- plugins ---

/** Two-way sync between the controlled `value` string and the Lexical editor state. Our own edits set
 *  `expected` first so the external-value effect never rebuilds (and jolts the caret) on an echo. */
function ValueSyncPlugin({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editor] = useLexicalComposerContext();
  const expected = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (value === expected.current) return;
    expected.current = value;
    editor.update(() => buildEditorState(value));
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

/** Reflects `readOnly` into the editor's editability (initialConfig only applies it at mount). */
function EditablePlugin({ readOnly }: { readOnly: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => editor.setEditable(!readOnly), [editor, readOnly]);
  return null;
}

/** Toolbar of colored variable chips. Interactive (Edit tab): clicking inserts a fresh chip at the
 *  caret. Non-interactive (Preview tab): the same chips persist as a color key — which also keeps the
 *  row from reflowing when the tab switches. */
function VariableToolbar({ variables, interactive }: {
  variables: PromptVariable[];
  interactive: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  if (!variables.length) return null;

  const insert = (token: string) => {
    editor.update(() => {
      const node = $createVariableNode(token);
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertNodes([node]);
        return;
      }
      const root = $getRoot();
      const last = root.getLastChild();
      if ($isElementNode(last)) last.append(node);
      else {
        const para = $createParagraphNode();
        para.append(node);
        root.append(para);
      }
    });
    editor.focus();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 flex-shrink-0">
      <span className="text-xs text-muted-foreground mr-1">Insert:</span>
      {variables.map((v) => (
        <button
          key={v.token}
          type="button"
          disabled={!interactive}
          onClick={interactive ? () => insert(v.token) : undefined}
          title={interactive ? `Insert ${v.label}` : v.label}
          className={cn(CHIP_BASE, 'border', interactive ? 'cursor-pointer hover:brightness-95' : 'cursor-default')}
          style={{ backgroundColor: v.color, color: '#000' }}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

/** Lets a chip be dragged to a new caret position within the prompt. The dragged node's key is parked
 *  in PromptDragContext on dragstart; on drop we resolve the caret and relocate the node. */
function ChipDragPlugin({ dragKey }: { dragKey: { current: string | null } }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    const removeOver = editor.registerCommand(
      DRAGOVER_COMMAND,
      (event: DragEvent) => {
        if (!dragKey.current) return false;
        event.preventDefault(); // allow the drop
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
    const removeDrop = editor.registerCommand(
      DROP_COMMAND,
      (event: DragEvent) => {
        const key = dragKey.current;
        if (!key) return false;
        event.preventDefault();
        dragKey.current = null;
        const range = caretRangeFromPoint(event.clientX, event.clientY);
        if (!range) return true;
        editor.update(() => {
          const node = $getNodeByKey(key);
          if (!$isVariableNode(node)) return;
          const token = node.getToken();
          const selection = $createRangeSelection();
          selection.applyDOMRange(range);
          if (selection.anchor.getNode().getKey() === key) return; // dropped onto itself
          node.remove();
          $setSelection(selection);
          $insertNodes([$createVariableNode(token)]);
        });
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
    return () => { removeOver(); removeDrop(); };
  }, [editor, dragKey]);
  return null;
}

// --- editor + field ---

const EDITOR_CLASS =
  'h-full min-h-[160px] w-full overflow-auto rounded-md border border-input bg-background px-3 py-2 ' +
  'text-sm outline-none whitespace-pre-wrap';

/** The substituted prompt, with each variable's value lightly tinted its accent color (matching the
 *  chip and the Insert key) so it's obvious which text came from which variable. */
function PreviewPane({ value, previewValues }: {
  value: string;
  previewValues: Record<string, string>;
}) {
  return (
    <div className="h-full min-h-[160px] overflow-auto rounded-md border border-input bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap">
      {parsePromptTemplate(value).map((seg, i) => {
        if (seg.type === 'text') return <span key={i}>{seg.value}</span>;
        const color = colorForToken(seg.token);
        return (
          <mark
            key={i}
            className="rounded px-0.5"
            style={color ? { backgroundColor: `${color}59`, color: 'inherit' } : undefined}
          >
            {previewValues[seg.token] ?? seg.token}
          </mark>
        );
      })}
    </div>
  );
}

/**
 * Chip-based prompt editor: variable tokens render as draggable/removable chips, a colored toolbar
 * inserts more, and (when `previewValues` is supplied — i.e. a game is active) a Preview tab swaps each
 * chip for its live value. The composer wraps both tabs so the Insert toolbar persists across them —
 * interactive in Edit, a static color key in Preview. Storage stays the same token-string.
 */
const PromptField = ({ value, onChange, variables, previewValues, className, readOnly = false }: {
  value: string;
  onChange: (v: string) => void;
  variables: PromptVariable[];
  previewValues?: Record<string, string>;
  className?: string;
  readOnly?: boolean;
}) => {
  const dragKey = useRef<string | null>(null);
  const [tab, setTab] = useState('edit');
  // Capture `value` at mount; live edits flow through ValueSyncPlugin, external resets through it too.
  const initialConfig = useMemo(
    () => ({
      namespace: 'PromptField',
      nodes: [VariableNode],
      onError: (error: Error) => { throw error; },
      editable: !readOnly,
      editorState: () => buildEditorState(value),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only the mount-time value seeds the editor
    [],
  );

  const editorSurface = (
    <div className="relative flex-1 min-h-0">
      <PlainTextPlugin
        contentEditable={<ContentEditable className={EDITOR_CLASS} />}
        placeholder={
          <div className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">
            Empty prompt
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
    </div>
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <PromptDragContext.Provider value={dragKey}>
        <div className={cn('flex flex-col flex-1 min-h-0 gap-2', className)}>
          <VariableToolbar variables={variables} interactive={!readOnly && (!previewValues || tab === 'edit')} />
          {previewValues ? (
            <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
              <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit" className="mt-2 flex-1 min-h-0 data-[state=active]:flex flex-col">
                {editorSurface}
              </TabsContent>
              <TabsContent value="preview" className="mt-2 flex-1 min-h-0 data-[state=active]:flex flex-col">
                <PreviewPane value={value} previewValues={previewValues} />
              </TabsContent>
            </Tabs>
          ) : (
            editorSurface
          )}
        </div>
        <HistoryPlugin />
        <ValueSyncPlugin value={value} onChange={onChange} />
        <EditablePlugin readOnly={readOnly} />
        <ChipDragPlugin dragKey={dragKey} />
      </PromptDragContext.Provider>
    </LexicalComposer>
  );
};

export default PromptField;
