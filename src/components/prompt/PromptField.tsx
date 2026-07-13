import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { type PromptVariable } from '@/lib/promptVariables';
import { ChipVocabularyContext, promptVocabulary, type ChipVocabulary } from '@/lib/chipVocabulary';
import { cn } from '@/lib/utils';
import { VariableNode, $createVariableNode, $isVariableNode, PromptDragContext } from './VariableNode';

// --- string <-> editor conversion (a single plain-text paragraph of text / line breaks / chips) ---

function appendSegments(para: ElementNode, value: string, parse: ChipVocabulary['parse']) {
  for (const seg of parse(value)) {
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

function buildEditorState(value: string, parse: ChipVocabulary['parse']) {
  const root = $getRoot();
  root.clear();
  const para = $createParagraphNode();
  appendSegments(para, value, parse);
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
function ValueSyncPlugin({ value, onChange, parse }: { value: string; onChange: (v: string) => void; parse: ChipVocabulary['parse'] }) {
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

/** Reflects `readOnly` into the editor's editability (initialConfig only applies it at mount). */
function EditablePlugin({ readOnly }: { readOnly: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => editor.setEditable(!readOnly), [editor, readOnly]);
  return null;
}

/** Toolbar of colored variable chips. Interactive (Edit tab): clicking inserts a fresh chip at the
 *  caret. Non-interactive (Preview tab): the same chips persist as a color key — which also keeps the
 *  row from reflowing when the tab switches. */
function VariableToolbar({ vocab, interactive }: {
  vocab: ChipVocabulary;
  interactive: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const items = vocab.palette();
  if (!items.length) return null;

  const insert = (paletteToken: string) => {
    editor.update(() => {
      const node = $createVariableNode(vocab.freshInsertToken(paletteToken));
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
      {items.map((v) => (
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

// --- edit <-> preview scroll sync ---
// The two panes have very different heights (a chip is one short token; its expanded value can be many
// lines), so a whole-document fraction maps poorly. Instead we anchor on the variable elements both panes
// share in the same order — Lexical chips (`data-lexical-decorator`) in Edit, expanded `<mark>`s in
// Preview — and record the viewport center as a position *between two chips*, which we then reproduce in
// the other pane. Non-uniform expansion above/below the reading spot no longer skews the result.

/** A captured scroll position: interpolated between shared anchors `seg`..`seg+1`, or a whole-document
 *  fraction when the pane has no chips to align on. */
type ScrollAnchor = { seg: number; t: number } | { frac: number };

const anchorSelector = (tab: string) => (tab === 'edit' ? '[data-lexical-decorator]' : 'mark');

/** Anchor element tops (px from content top), bracketed by the content's own top (0) and bottom
 *  (scrollHeight) — giving `chips + 1` gaps to interpolate within. */
function anchorPositions(el: HTMLElement, tab: string): number[] {
  const contentTop = el.getBoundingClientRect().top - el.scrollTop;
  const tops = Array.from(el.querySelectorAll<HTMLElement>(anchorSelector(tab)))
    .map((a) => a.getBoundingClientRect().top - contentTop);
  return [0, ...tops, el.scrollHeight];
}

function captureAnchor(el: HTMLElement | null, tab: string): ScrollAnchor | null {
  if (!el || el.scrollHeight <= el.clientHeight) return null;
  const center = el.scrollTop + el.clientHeight / 2;
  const pos = anchorPositions(el, tab);
  if (pos.length <= 2) return { frac: center / el.scrollHeight }; // no chips → whole-document fraction
  let seg = 0;
  while (seg < pos.length - 2 && center >= pos[seg + 1]) seg++;
  return { seg, t: (center - pos[seg]) / (pos[seg + 1] - pos[seg] || 1) };
}

function applyAnchor(el: HTMLElement | null, tab: string, anchor: ScrollAnchor): void {
  if (!el) return;
  let center: number;
  if ('frac' in anchor) center = anchor.frac * el.scrollHeight;
  else {
    const pos = anchorPositions(el, tab);
    const seg = Math.min(anchor.seg, pos.length - 2); // guard against a differing anchor count
    center = pos[seg] + anchor.t * (pos[seg + 1] - pos[seg]);
  }
  el.scrollTop = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, center - el.clientHeight / 2));
}

/** The substituted prompt, with each variable's value lightly tinted its accent color (matching the
 *  chip and the Insert key) so it's obvious which text came from which variable. */
function PreviewPane({ value, previewValues, vocab, scrollRef, onScroll }: {
  value: string;
  previewValues: Record<string, string>;
  vocab: ChipVocabulary;
  scrollRef?: React.Ref<HTMLDivElement>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}) {
  return (
    <div ref={scrollRef} onScroll={onScroll} className="h-full min-h-[160px] overflow-auto rounded-md border border-input bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap">
      {vocab.parse(value).map((seg, i) => {
        if (seg.type === 'text') return <span key={i}>{seg.value}</span>;
        const color = vocab.color(seg.token);
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
const PromptField = ({ value, onChange, variables = [], vocabulary, previewValues, onPreviewOpen, className, readOnly = false }: {
  value: string;
  onChange: (v: string) => void;
  /** Prompt-variable palette (used when no explicit `vocabulary` is given — the default prompt family). */
  variables?: PromptVariable[];
  /** Override the token family (e.g. world placeholders). Defaults to the prompt vocabulary from `variables`. */
  vocabulary?: ChipVocabulary;
  previewValues?: Record<string, string>;
  /** Fired when the Preview tab is opened — lets a caller re-derive `previewValues` (e.g. re-roll Wildcards). */
  onPreviewOpen?: () => void;
  className?: string;
  readOnly?: boolean;
}) => {
  const vocab = useMemo(() => vocabulary ?? promptVocabulary(variables), [vocabulary, variables]);
  const dragKey = useRef<string | null>(null);
  const [tab, setTab] = useState('edit');
  // Scroll containers for each tab (only one is mounted at a time). ContentEditable forwards its ref to
  // the editable <div>, which is the Edit-mode scroller (overflow-auto via EDITOR_CLASS).
  const editScrollRef = useRef<HTMLDivElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  // The canonical scroll position, held as a height-independent anchor we own — so it maps between the two
  // panes and, crucially, toggling re-applies this exact value instead of re-reading the browser's rounded
  // scrollTop. That removes the round-trip that caused peek-drift; only genuine user scrolling refreshes it.
  const proxyAnchor = useRef<ScrollAnchor | null>(null);
  // True while we're programmatically scrolling, so our own scroll events don't clobber the proxy.
  const applying = useRef(false);

  // A real user scroll on the visible pane refreshes the proxy from that pane (currentTarget is the
  // scroller). Our own apply-driven scrolls are gated out via `applying`.
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (applying.current) return;
    proxyAnchor.current = captureAnchor(e.currentTarget, tab);
  };

  useLayoutEffect(() => {
    const anchor = proxyAnchor.current;
    if (!anchor) return;
    // Edit's chips are Lexical decorators whose content portals in a frame or two after mount, growing the
    // pane. Re-apply the proxy each frame until scrollHeight settles so the final apply measures the
    // finished layout; suppress our own scroll events throughout so the proxy stays exact.
    applying.current = true;
    let raf = 0;
    let prevHeight = -1;
    let tries = 0;
    const run = () => {
      const el = tab === 'edit' ? editScrollRef.current : previewScrollRef.current;
      if (!el) { applying.current = false; return; }
      applyAnchor(el, tab, anchor);
      if (el.scrollHeight !== prevHeight && tries < 10) {
        prevHeight = el.scrollHeight;
        tries++;
        raf = requestAnimationFrame(run);
      } else {
        // Re-enable capture one frame later, once the final programmatic scroll event has flushed
        // (scroll events fire before the next rAF, so it's already been gated out by then).
        raf = requestAnimationFrame(() => { applying.current = false; });
      }
    };
    raf = requestAnimationFrame(run);
    return () => { cancelAnimationFrame(raf); applying.current = false; };
  }, [tab]);
  // Capture `value` at mount; live edits flow through ValueSyncPlugin, external resets through it too.
  const initialConfig = useMemo(
    () => ({
      namespace: 'PromptField',
      nodes: [VariableNode],
      onError: (error: Error) => { throw error; },
      editable: !readOnly,
      editorState: () => buildEditorState(value, vocab.parse),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only the mount-time value seeds the editor
    [],
  );

  const editorSurface = (
    <div className="relative flex-1 min-h-0">
      <PlainTextPlugin
        contentEditable={<ContentEditable ref={editScrollRef} onScroll={handleScroll} className={EDITOR_CLASS} />}
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
      <ChipVocabularyContext.Provider value={vocab}>
      <PromptDragContext.Provider value={dragKey}>
        <div className={cn('flex flex-col flex-1 min-h-0 gap-2', className)}>
          <VariableToolbar vocab={vocab} interactive={!readOnly && (!previewValues || tab === 'edit')} />
          {previewValues ? (
            <Tabs value={tab} onValueChange={(v) => { setTab(v); if (v === 'preview') onPreviewOpen?.(); }} className="flex flex-col flex-1 min-h-0">
              <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit" className="mt-2 flex-1 min-h-0 data-[state=active]:flex flex-col">
                {editorSurface}
              </TabsContent>
              <TabsContent value="preview" className="mt-2 flex-1 min-h-0 data-[state=active]:flex flex-col">
                <PreviewPane value={value} previewValues={previewValues} vocab={vocab} scrollRef={previewScrollRef} onScroll={handleScroll} />
              </TabsContent>
            </Tabs>
          ) : (
            editorSurface
          )}
        </div>
        <HistoryPlugin />
        <ValueSyncPlugin value={value} onChange={onChange} parse={vocab.parse} />
        <EditablePlugin readOnly={readOnly} />
        <ChipDragPlugin dragKey={dragKey} />
      </PromptDragContext.Provider>
      </ChipVocabularyContext.Provider>
    </LexicalComposer>
  );
};

export default PromptField;
