import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  $getRoot, $getNodeByKey, $getSelection, $isRangeSelection, $createRangeSelection, $setSelection,
  $insertNodes, $createParagraphNode,
  $isElementNode,
  COMMAND_PRIORITY_LOW, COMMAND_PRIORITY_HIGH, DRAGOVER_COMMAND, DROP_COMMAND,
  UNDO_COMMAND, REDO_COMMAND, CAN_UNDO_COMMAND, CAN_REDO_COMMAND,
} from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  Bold, Italic, Heading1, Heading2, List, ListOrdered, Link2, Quote, Code, Undo2, Redo2,
  Maximize2, Minimize2, Columns2, Square, Lock, Copy,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CHIP_BASE } from '@/components/Chip';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { type MarkdownAction } from '@/lib/markdownToolbar';
import { type PromptVariable } from '@/lib/promptVariables';
import { resolveToken } from '@/lib/promptTemplate';
import { ChipVocabularyContext, promptVocabulary, type ChipVocabulary } from '@/lib/chipVocabulary';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/useIsMobile';
import { resolveLayout, usePromptSplitMode, useContainerWidth, MIN_PANE_WIDTH } from '@/lib/promptLayout';
import { VariableNode, $createVariableNode, $isVariableNode, PromptDragContext } from './VariableNode';
import { buildEditorState, serializeRoot, $applyMarkdownAction } from './promptFieldState';

const MARKDOWN_TOOLBAR: { action: MarkdownAction; Icon: typeof Bold; title: string }[] = [
  { action: 'bold', Icon: Bold, title: 'Bold' },
  { action: 'italic', Icon: Italic, title: 'Italic' },
  { action: 'h1', Icon: Heading1, title: 'Heading 1' },
  { action: 'h2', Icon: Heading2, title: 'Heading 2' },
  { action: 'ul', Icon: List, title: 'Bullet list' },
  { action: 'ol', Icon: ListOrdered, title: 'Numbered list' },
  { action: 'link', Icon: Link2, title: 'Link' },
  { action: 'quote', Icon: Quote, title: 'Blockquote' },
  { action: 'code', Icon: Code, title: 'Inline code' },
];


/** Markdown formatting toolbar. Reads the editor as a flat string, applies the pure transform, rebuilds,
 *  then restores the selection the transform asked for. Editing the tree directly (rather than routing
 *  through `onChange`) keeps ValueSyncPlugin's external-value path — and its scroll reset — out of it. */
function MarkdownToolbar({ parse, disabled }: { parse: ChipVocabulary['parse']; disabled: boolean }) {
  const [editor] = useLexicalComposerContext();
  // History lives in Lexical's HistoryPlugin; mirror its can-undo/redo so the buttons disable like the rest.
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  useEffect(() => mergeRegister(
    editor.registerCommand(CAN_UNDO_COMMAND, (v: boolean) => { setCanUndo(v); return false; }, COMMAND_PRIORITY_LOW),
    editor.registerCommand(CAN_REDO_COMMAND, (v: boolean) => { setCanRedo(v); return false; }, COMMAND_PRIORITY_LOW),
  ), [editor]);

  const apply = (action: MarkdownAction) => {
    editor.update(() => $applyMarkdownAction(parse, action));
    editor.focus();
  };

  const btn = 'rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50';
  return (
    <div className="flex flex-wrap gap-1">
      {MARKDOWN_TOOLBAR.map(({ action, Icon, title }) => (
        <button key={action} type="button" title={title} aria-label={title} disabled={disabled} onClick={() => apply(action)} className={btn}>
          <Icon className="h-4 w-4" />
        </button>
      ))}
      <span className="mx-1 w-px self-stretch bg-border" />
      <button
        type="button" title="Undo" aria-label="Undo" className={btn}
        disabled={disabled || !canUndo}
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        type="button" title="Redo" aria-label="Redo" className={btn}
        disabled={disabled || !canRedo}
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
      >
        <Redo2 className="h-4 w-4" />
      </button>
    </div>
  );
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
function ValueSyncPlugin({ value, onChange, parse, onExternalValue }: {
  value: string;
  onChange: (v: string) => void;
  parse: ChipVocabulary['parse'];
  /** Fired when `value` changes from outside the editor (a Reset or a template swap), not on a typed echo. */
  onExternalValue?: () => void;
}) {
  const [editor] = useLexicalComposerContext();
  const expected = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const parseRef = useRef(parse);
  parseRef.current = parse;
  const onExternalRef = useRef(onExternalValue);
  onExternalRef.current = onExternalValue;

  useEffect(() => {
    if (value === expected.current) return;
    expected.current = value;
    editor.update(() => buildEditorState(value, parseRef.current));
    onExternalRef.current?.();
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
    // Browsers don't render a native drop caret when dragging our contenteditable=false chip, so we draw our
    // own: a thin vertical line positioned at the drop caret during dragover, hidden on drop / drag end.
    const caret = document.createElement('div');
    caret.style.cssText =
      'position:fixed;width:2px;pointer-events:none;z-index:60;background:hsl(var(--foreground));display:none';
    document.body.appendChild(caret);
    const hideCaret = () => { caret.style.display = 'none'; };
    const showCaretAt = (x: number, y: number) => {
      const range = caretRangeFromPoint(x, y);
      const rect = range?.getBoundingClientRect();
      if (!rect) return hideCaret();
      caret.style.left = `${rect.left}px`;
      caret.style.top = `${rect.top}px`;
      caret.style.height = `${rect.height || 18}px`;
      caret.style.display = 'block';
    };

    const removeOver = editor.registerCommand(
      DRAGOVER_COMMAND,
      (event: DragEvent) => {
        if (!dragKey.current) return false;
        event.preventDefault(); // allow the drop
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        showCaretAt(event.clientX, event.clientY);
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
        hideCaret();
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
    // dragend fires even when the drag is canceled or dropped outside the editor, so the caret never lingers.
    // Clear the parked node key too, or a canceled/outside drop leaves it set and the next unrelated drag
    // (text, a file) satisfies the dragover guard and gets treated as a continued chip move.
    const onDragEnd = () => {
      hideCaret();
      dragKey.current = null;
    };
    document.addEventListener('dragend', onDragEnd);
    return () => {
      removeOver();
      removeDrop();
      document.removeEventListener('dragend', onDragEnd);
      caret.remove();
    };
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
        // resolveToken applies the placement's affixes and the vanish-when-empty rule, so the preview
        // matches what the model receives. It returns undefined for another family's token (placeholders),
        // which then falls back to that family's own by-token lookup. `??` — '' is a real result.
        const rendered = resolveToken(seg.token, previewValues) ?? previewValues[seg.token] ?? seg.token;
        // An affixed chip with nothing to show renders as nothing, not an empty highlight.
        if (rendered === '') return null;
        return (
          <mark
            key={i}
            className="rounded px-0.5"
            style={color ? { backgroundColor: `${color}59`, color: 'inherit' } : undefined}
          >
            {rendered}
          </mark>
        );
      })}
    </div>
  );
}

/** Preview for a markdown field: resolve each chip to its value, then render the result the way the game
 *  will. Deliberately untinted — this pane's job is to show exactly what the player sees, and the markdown
 *  renderer takes a string (no raw HTML), so a chip-colored span couldn't survive it anyway. */
function MarkdownPreviewPane({ value, previewValues, vocab, scrollRef, onScroll }: {
  value: string;
  previewValues?: Record<string, string>;
  vocab: ChipVocabulary;
  scrollRef?: React.Ref<HTMLDivElement>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}) {
  const resolved = vocab
    .parse(value)
    .map((seg) => (seg.type === 'text' ? seg.value : resolveToken(seg.token, previewValues ?? {}) ?? previewValues?.[seg.token] ?? seg.token))
    .join('');
  return (
    <div ref={scrollRef} onScroll={onScroll} className="h-full min-h-[160px] overflow-auto rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
      <MarkdownRenderer text={resolved} />
    </div>
  );
}

/**
 * Chip-based prompt editor: variable tokens render as draggable/removable chips, a colored toolbar
 * inserts more, and (when `previewValues` is supplied — i.e. a game is active) a Preview tab swaps each
 * chip for its live value. The composer wraps both tabs so the Insert toolbar persists across them —
 * interactive in Edit, a static color key in Preview. Storage stays the same token-string.
 *
 * With `markdown`, it also gains a formatting toolbar and its Preview renders markdown instead of tinting
 * chips — for author-facing prose fields (world description, readme) that the player reads as markdown.
 */
const PromptField = ({ value, onChange, variables = [], vocabulary, previewValues, onPreviewOpen, markdown = false, resizable = false, placeholder, className, readOnly = false, ariaLabel, sampleData = false, onRequestEdit, readOnlyReason }: {
  value: string;
  onChange: (v: string) => void;
  /** Prompt-variable palette (used when no explicit `vocabulary` is given — the default prompt family). */
  variables?: PromptVariable[];
  /** Override the token family (e.g. world placeholders). Defaults to the prompt vocabulary from `variables`. */
  vocabulary?: ChipVocabulary;
  previewValues?: Record<string, string>;
  /** Fired when the Preview tab is opened — lets a caller re-derive `previewValues` (e.g. re-roll Wildcards). */
  onPreviewOpen?: () => void;
  /** Prose field: adds a markdown formatting toolbar and renders the Preview as markdown. */
  markdown?: boolean;
  /** Let the author drag the field taller/shorter. Only for fields in a content-height container (the
   *  world editor's scroll panes) — in a height-pinned pane the dragged box would just overflow its slot. */
  resizable?: boolean;
  /** Empty-field hint. */
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  /** Badge the Preview as stand-in content — set when `previewValues` are samples, not a live game's. */
  sampleData?: boolean;
  /** Offered alongside the read-only notice: what to do about it (duplicate the preset and edit the copy). */
  onRequestEdit?: () => void;
  /** What is read-only, named in the notice (e.g. a built-in preset's name). */
  readOnlyReason?: string;
  /** Names the editor for a screen reader. Lexical renders a `div`, so a `<label htmlFor>` cannot reach it. */
  ariaLabel?: string;
}) => {
  const vocab = useMemo(() => vocabulary ?? promptVocabulary(variables), [vocabulary, variables]);
  const dragKey = useRef<string | null>(null);
  const [tab, setTab] = useState('edit');
  // A markdown field always has something to preview (the rendered prose); a plain chip field only earns
  // the toggle once there are values to swap in.
  const showTabs = markdown || !!previewValues;

  // Layout: the field measures itself rather than asking the device, so a shrunken desktop window falls
  // back to tabs and phones never reach the split threshold — no breakpoint to keep in sync.
  const [measureRef, containerWidth] = useContainerWidth();
  const [splitMode, setSplitMode] = usePromptSplitMode();
  const [fullscreen, setFullscreen] = useState(false);
  const isMobile = useIsMobile();
  // Fullscreen measures the viewport, not the inline slot it was opened from.
  const effectiveWidth = fullscreen ? (typeof window !== 'undefined' ? window.innerWidth - 48 : 0) : containerWidth;
  const layout = resolveLayout(splitMode, effectiveWidth, showTabs);
  const split = layout === 'split';
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

  // Re-open the gate once the scroll event our own `applyAnchor` provoked has been and gone. rAF alone
  // would strand it: a hidden or non-compositing tab stops firing frames, and a gate that never re-opens
  // kills scroll sync for the rest of the session. The timer is the one that always arrives.
  const releaseApplying = () => {
    const open = () => { applying.current = false; };
    requestAnimationFrame(open);
    setTimeout(open, 50);
  };

  // A real user scroll on the visible pane refreshes the proxy from that pane (currentTarget is the
  // scroller). Our own apply-driven scrolls are gated out via `applying`.
  //
  // With both panes on screen the same proxy drives the other pane live: the anchor was always a
  // pane-independent position, so keeping two panes together is the same mapping a tab switch made once.
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (applying.current) return;
    const from = e.currentTarget === editScrollRef.current ? 'edit' : 'preview';
    const anchor = captureAnchor(e.currentTarget, from);
    proxyAnchor.current = anchor;
    if (!split || !anchor) return;
    const target = from === 'edit' ? previewScrollRef.current : editScrollRef.current;
    if (!target) return;
    applying.current = true;
    applyAnchor(target, from === 'edit' ? 'preview' : 'edit', anchor);
    releaseApplying();
  };

  // On an external value change (Reset / template swap), snap both panes back to the top — the browser keeps
  // the old scrollTop when the content is replaced, so a reset would otherwise leave you mid-prompt. rAF so it
  // lands after the editor rebuild's layout. `applying` gates out the resulting scroll event.
  const resetScroll = () => {
    proxyAnchor.current = null;
    applying.current = true;
    requestAnimationFrame(() => {
      if (editScrollRef.current) editScrollRef.current.scrollTop = 0;
      if (previewScrollRef.current) previewScrollRef.current.scrollTop = 0;
      releaseApplying();
    });
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

  // The resize grabber goes on whichever element outlives a tab switch — the Tabs root, or this surface when
  // there are no tabs. Putting it on the editor itself would lose the dragged height every toggle (Radix
  // unmounts the inactive pane) and would size Edit without Preview. `h-full` panes then fill the new height.
  // `flex-none` is what makes the drag take: as a flex-1 item, flex owns the main size and the height a
  // resize writes is ignored. Unset, it sizes to content (floored at min-h) exactly as before.
  // A dragged height only makes sense inline: fullscreen owns its own height.
  const resizeClass = resizable && !fullscreen && 'flex-none resize-y overflow-hidden min-h-[160px]';
  const editorSurface = (
    <div
      className={cn('relative flex-1 min-h-0', !showTabs && resizeClass)}
      // On a phone the inline field is ~225px tall against a prompt many screens long, so editing there is
      // the cramped case this whole feature exists to fix — go straight to the full screen. The handler
      // sits on this wrapper because Lexical's ContentEditable doesn't forward arbitrary DOM props;
      // focus bubbles here as focusin, which is what React's onFocus listens for anyway.
      onFocus={isMobile && !fullscreen ? () => setFullscreen(true) : undefined}
    >
      <PlainTextPlugin
        contentEditable={
          <ContentEditable
            ref={editScrollRef}
            onScroll={handleScroll}
            className={EDITOR_CLASS}
            aria-label={ariaLabel}
          />
        }
        placeholder={
          <div className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">
            {placeholder ?? 'Empty prompt'}
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
    </div>
  );

  const previewSurface = (
    <div className="relative flex flex-1 min-h-0 flex-col">
      {markdown ? (
        <MarkdownPreviewPane value={value} previewValues={previewValues} vocab={vocab} scrollRef={previewScrollRef} onScroll={handleScroll} />
      ) : (
        <PreviewPane value={value} previewValues={previewValues ?? {}} vocab={vocab} scrollRef={previewScrollRef} onScroll={handleScroll} />
      )}
      {/* Stand-in content, not this player's world — say so on the pane rather than in a tooltip nobody opens. */}
      {sampleData && (
        <span className="pointer-events-none absolute right-2 top-2 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">
          Sample data
        </span>
      )}
    </div>
  );

  // Swipe between panes when they can't sit side by side and the screen is the whole surface — the
  // mobile expression of the split, landing on the same content position via the shared anchor.
  const swipeable = fullscreen && !split && showTabs;
  const touchX = useRef<number | null>(null);
  const swipeHandlers = swipeable ? {
    onTouchStart: (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; },
    onTouchEnd: (e: React.TouchEvent) => {
      if (touchX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchX.current;
      touchX.current = null;
      if (Math.abs(dx) < 60) return;
      const next = dx < 0 ? 'preview' : 'edit';
      if (next !== tab) { setTab(next); if (next === 'preview') onPreviewOpen?.(); }
    },
  } : {};

  const chrome = (
    // The chip palette is many chips wide and wraps; it must be allowed to shrink (`min-w-0`) or its
    // intrinsic width shoves the buttons off the side of a phone instead of wrapping.
    <div className="flex items-start gap-1 flex-shrink-0">
      <div className="min-w-0 flex-1">
        <VariableToolbar vocab={vocab} interactive={!readOnly && (split || !showTabs || tab === 'edit')} />
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        {showTabs && !fullscreen && containerWidth - 12 >= MIN_PANE_WIDTH * 2 && (
          <button
            type="button"
            onClick={() => setSplitMode(split ? 'tabs' : 'split')}
            title={split ? 'Show one pane at a time' : 'Show edit and preview side by side'}
            aria-label={split ? 'Show one pane at a time' : 'Show edit and preview side by side'}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {split ? <Square className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => setFullscreen((f) => !f)}
          title={fullscreen ? 'Exit full screen' : 'Edit full screen'}
          aria-label={fullscreen ? 'Exit full screen' : 'Edit full screen'}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  const panes = split ? (
    <div className="flex flex-1 min-h-0 gap-3">
      <div className="flex-1 min-w-0 flex flex-col">{editorSurface}</div>
      <div className="flex-1 min-w-0 flex flex-col">{previewSurface}</div>
    </div>
  ) : showTabs ? (
    <Tabs value={tab} onValueChange={(v) => { setTab(v); if (v === 'preview') onPreviewOpen?.(); }} className={cn('flex flex-col flex-1 min-h-0', resizeClass)}>
      {swipeable ? (
        // Dots, not tab buttons: the gesture is the control, and a full-width tab bar on a phone spends
        // height the editor just got back.
        <div className="flex justify-center gap-1.5 py-1 flex-shrink-0" aria-hidden>
          {['edit', 'preview'].map((t) => (
            <span key={t} className={cn('h-1.5 w-1.5 rounded-full', tab === t ? 'bg-primary' : 'bg-muted-foreground/40')} />
          ))}
        </div>
      ) : (
        <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
      )}
      <TabsContent value="edit" className="mt-2 flex-1 min-h-0 data-[state=active]:flex flex-col" {...swipeHandlers}>
        {editorSurface}
      </TabsContent>
      <TabsContent value="preview" className="mt-2 flex-1 min-h-0 data-[state=active]:flex flex-col" {...swipeHandlers}>
        {previewSurface}
      </TabsContent>
    </Tabs>
  ) : (
    editorSurface
  );

  // A read-only editor looks broken rather than protected — the caret simply does nothing — and that reads
  // worst at full screen, where the field is the whole window. Say why, and offer the way out.
  const readOnlyNotice = readOnly && readOnlyReason && (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-2 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
      <Lock className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">{readOnlyReason}</span>
      {onRequestEdit && (
        <Button variant="outline" size="sm" className="h-7 shrink-0 px-2" onClick={onRequestEdit}>
          <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate &amp; Edit
        </Button>
      )}
    </div>
  );

  const body = (
    <div ref={measureRef} className={cn('flex flex-col flex-1 min-h-0 gap-2', className)}>
      {chrome}
      {readOnlyNotice}
      {markdown && <MarkdownToolbar parse={vocab.parse} disabled={readOnly || (!split && showTabs && tab !== 'edit')} />}
      {panes}
    </div>
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <ChipVocabularyContext.Provider value={vocab}>
      <PromptDragContext.Provider value={dragKey}>
        {/* A real (nested) dialog rather than a hand-rolled overlay: most of these fields live inside the
            Settings dialog, and Radix parks `pointer-events: none` on the body while one is open — a
            plain portaled div inherits that and renders dead, under Radix's own overlay. Letting Radix
            own the stack also gives the fullscreen its focus trap and Escape for free. */}
        {fullscreen ? (
          <Dialog open onOpenChange={(o) => { if (!o) setFullscreen(false); }}>
            <DialogContent
              hideClose
              aria-describedby={undefined}
              aria-label={ariaLabel ?? 'Prompt editor'}
              className="flex h-[100dvh] w-screen max-w-none flex-col gap-2 rounded-none border-0 p-4 sm:rounded-none"
            >
              {body}
            </DialogContent>
          </Dialog>
        ) : (
          body
        )}
        <HistoryPlugin />
        <ValueSyncPlugin value={value} onChange={onChange} parse={vocab.parse} onExternalValue={resetScroll} />
        <EditablePlugin readOnly={readOnly} />
        <ChipDragPlugin dragKey={dragKey} />
      </PromptDragContext.Provider>
      </ChipVocabularyContext.Provider>
    </LexicalComposer>
  );
};

export default PromptField;
