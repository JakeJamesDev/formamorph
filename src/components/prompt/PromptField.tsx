import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import {
  $getRoot, $getSelection, $isRangeSelection, $createParagraphNode,
  $isElementNode,
  COMMAND_PRIORITY_LOW, SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND, REDO_COMMAND, CAN_UNDO_COMMAND, CAN_REDO_COMMAND,
} from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin, createEmptyHistoryState } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  Bold, Italic, Strikethrough, Highlighter, Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, ListChecks, Link2, Image, Table, SquareCode, Minus, Subscript, Superscript,
  Quote, Code, Undo2, Redo2, ChevronDown,
  Maximize2, Minimize2, Columns2, Square,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tip } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FullscreenShell } from '@/components/FullscreenShell';
import { useMorphFullscreen } from '@/lib/useMorphFullscreen';
import { ReadOnlyNotice } from './ReadOnlyNotice';
import { CHIP_BASE } from '@/components/Chip';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { type MarkdownAction, HIGHLIGHT_COLORS } from '@/lib/markdownToolbar';
import { type PromptVariable } from '@/lib/promptVariables';
import { resolveToken } from '@/lib/promptTemplate';
import {
  tintValue, emptyMarker, stripTintSentinels, tintMarkStyle, emptyMarkStyle,
  TINT_MARK_CLASS, EMPTY_MARK_CLASS, EMPTY_MARK_LABEL,
} from '@/lib/previewTint';
import { ChipVocabularyContext, promptVocabulary, type ChipVocabulary } from '@/lib/chipVocabulary';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/useIsMobile';
import { resolveLayout, splitAvailable, usePromptSplitMode, useContainerWidth } from '@/lib/promptLayout';
import { VariableNode, $createVariableNode, PromptDragContext } from './VariableNode';
import { buildEditorState, serializeRoot, $applyMarkdownAction } from './promptFieldState';
import { ChipTypeaheadPlugin } from './ChipTypeahead';
import { ChipInsertTargetPlugin } from './ChipInsertTarget';
import { ChipDragPlugin } from './ChipDrag';
import { TOOLBAR_BTN } from './toolbarStyles';
import { anchorAt, applyAnchor, captureAnchor, caretOffset, PROMPT_ANCHORS, type ScrollAnchor } from './previewScrollSync';

interface ToolbarItem {
  action: MarkdownAction;
  Icon: typeof Bold;
  title: string;
  /** A `flexible-marker-*` class, on the items whose icon alone can't say them apart. */
  swatch?: string;
}

// Always visible: the formatting an author reaches for mid-sentence.
const MARKDOWN_TOOLBAR: ToolbarItem[] = [
  { action: 'bold', Icon: Bold, title: 'Bold' },
  { action: 'italic', Icon: Italic, title: 'Italic' },
  { action: 'strike', Icon: Strikethrough, title: 'Strikethrough' },
  { action: 'code', Icon: Code, title: 'Inline code' },
  { action: 'quote', Icon: Quote, title: 'Blockquote' },
];

// Ten highlighters sharing one icon, told apart by the color they paint. The class each carries is the one
// the renderer puts on the mark, so a swatch is drawn by the same rule as the highlight it stands for.
const HIGHLIGHT_ITEMS: ToolbarItem[] = [
  { action: 'highlight', Icon: Highlighter, title: 'Highlight', swatch: 'flexible-marker-default' },
  ...HIGHLIGHT_COLORS.map(({ key, label }) => ({
    action: `highlight:${key}` as MarkdownAction,
    Icon: Highlighter,
    title: `${label} Highlight`,
    swatch: `flexible-marker-${label.toLowerCase()}`,
  })),
];

/** Swatches show the color itself, not the wash it reads as behind text, so both alphas go to 1 locally. */
const OPAQUE_SWATCH = { '--md-hl-alpha': 1, '--md-hl-alpha-base': 1 } as CSSProperties;

// Everything else groups behind a split button: its face applies the last action picked from the group,
// its chevron opens the rest. Nine buttons of markdown on one row read as a wall; three do not.
const HEADING_ITEMS: ToolbarItem[] = [
  { action: 'h1', Icon: Heading1, title: 'Heading 1' },
  { action: 'h2', Icon: Heading2, title: 'Heading 2' },
  { action: 'h3', Icon: Heading3, title: 'Heading 3' },
  { action: 'h4', Icon: Heading4, title: 'Heading 4' },
];

const LIST_ITEMS: ToolbarItem[] = [
  { action: 'ul', Icon: List, title: 'Bullet list' },
  { action: 'ol', Icon: ListOrdered, title: 'Numbered list' },
  { action: 'task', Icon: ListChecks, title: 'Task list' },
];

const INSERT_ITEMS: ToolbarItem[] = [
  { action: 'link', Icon: Link2, title: 'Link' },
  { action: 'image', Icon: Image, title: 'Image' },
  { action: 'table', Icon: Table, title: 'Table' },
  { action: 'codeblock', Icon: SquareCode, title: 'Code block' },
  { action: 'rule', Icon: Minus, title: 'Horizontal rule' },
  { action: 'sub', Icon: Subscript, title: 'Subscript' },
  { action: 'sup', Icon: Superscript, title: 'Superscript' },
];



/** Undo/redo for the editor, on every prompt field rather than only the markdown ones — the keyboard
 *  shortcuts always worked, but a field with no buttons gives no sign that they would. History lives in
 *  Lexical's HistoryPlugin; this mirrors its can-undo/redo so the buttons disable when there is nothing to do. */
function HistoryButtons({ disabled }: { disabled: boolean }) {
  const [editor] = useLexicalComposerContext();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  useEffect(() => mergeRegister(
    editor.registerCommand(CAN_UNDO_COMMAND, (v: boolean) => { setCanUndo(v); return false; }, COMMAND_PRIORITY_LOW),
    editor.registerCommand(CAN_REDO_COMMAND, (v: boolean) => { setCanRedo(v); return false; }, COMMAND_PRIORITY_LOW),
  ), [editor]);

  // Pressing the button must not take focus off the editor: the selection goes with it, and Lexical then
  // has no range to restore the undone state into — the command runs and nothing visibly changes.
  const run = (command: typeof UNDO_COMMAND) => (event: ReactMouseEvent) => {
    event.preventDefault();
    editor.dispatchCommand(command, undefined);
    editor.focus();
  };

  return (
    <>
      <Tip tip="Undo">
        <button
          type="button" className={TOOLBAR_BTN}
          disabled={disabled || !canUndo}
          onMouseDown={run(UNDO_COMMAND)}
        >
          <Undo2 className="h-4 w-4" />
        </button>
      </Tip>
      <Tip tip="Redo">
        <button
          type="button" className={TOOLBAR_BTN}
          disabled={disabled || !canRedo}
          onMouseDown={run(REDO_COMMAND)}
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </Tip>
    </>
  );
}

/**
 * One item's glyph. A swatch rides at the foot of the icon rather than beside it, so a colored item is the
 * same 16px box as an uncolored one and the toolbar row keeps one height.
 */
function ItemGlyph({ item }: { item: ToolbarItem }) {
  if (!item.swatch) return <item.Icon className="h-4 w-4" />;
  return (
    <span className="relative block h-4 w-4">
      <item.Icon className="h-4 w-4" />
      <span
        aria-hidden
        style={OPAQUE_SWATCH}
        className={cn('absolute inset-x-0 bottom-0 h-[3px] flexible-marker', item.swatch)}
      />
    </span>
  );
}

/**
 * A group of related actions as one control: the face applies whichever the author picked last, the
 * chevron beside it opens the rest. The two halves highlight separately and carry a divider, since one
 * hover state across both reads as a single button that then does two different things.
 *
 * Presses prevent their mousedown default so focus — and with it the selection the transform needs —
 * never leaves the editor. The chevron leaves *opening* to the trigger's own click handler: toggling on
 * mousedown as well made the menu open on press and close again on release, which on a touch screen is
 * a menu that only exists while a finger is held down.
 */
function SplitButton({ items, label, disabled, apply }: {
  items: ToolbarItem[]; label: string; disabled: boolean; apply: (action: MarkdownAction) => void;
}) {
  const [current, setCurrent] = useState(items[0]);
  const [open, setOpen] = useState(false);
  const { title } = current;

  const press = (item: ToolbarItem) => (event: ReactMouseEvent) => {
    event.preventDefault();
    setCurrent(item);
    setOpen(false);
    apply(item.action);
  };

  return (
    <span className="flex items-center">
      <Tip tip={title}>
        <button
          type="button" disabled={disabled}
          onMouseDown={press(current)}
          className={cn(TOOLBAR_BTN, 'rounded-r-none pr-1')}
        >
          <ItemGlyph item={current} />
        </button>
      </Tip>
      <span className="h-4 w-hairline bg-border" aria-hidden />
      <Popover open={open} onOpenChange={setOpen}>
        {/* Two triggers on one button: the tip wraps the popover's trigger, which passes both sets of
            props down through its own `asChild`. */}
        <Tip tip={label}>
          <PopoverTrigger asChild>
            <button
              type="button" disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              className={cn(TOOLBAR_BTN, 'rounded-l-none px-1 py-2 data-[state=open]:bg-accent data-[state=open]:text-foreground')}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </PopoverTrigger>
        </Tip>
        <PopoverContent
          align="start" className="w-auto p-1"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="flex flex-col">
            {items.map((item) => (
              <button
                key={item.action} type="button" onMouseDown={press(item)}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-helper text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ItemGlyph item={item} />
                {item.title}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
}

/** Markdown formatting toolbar. Reads the editor as a flat string, applies the pure transform, rebuilds,
 *  then restores the selection the transform asked for. Editing the tree directly (rather than routing
 *  through `onChange`) keeps ValueSyncPlugin's external-value path — and its scroll reset — out of it. */
function MarkdownToolbar({ parse, disabled }: { parse: ChipVocabulary['parse']; disabled: boolean }) {
  const [editor] = useLexicalComposerContext();

  const apply = (action: MarkdownAction) => {
    editor.update(() => $applyMarkdownAction(parse, action));
    editor.focus();
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {MARKDOWN_TOOLBAR.map(({ action, Icon, title }) => (
        <Tip key={action} tip={title}>
          <button
            type="button" disabled={disabled}
            onMouseDown={(event) => { event.preventDefault(); apply(action); }}
            className={TOOLBAR_BTN}
          >
            <Icon className="h-4 w-4" />
          </button>
        </Tip>
      ))}
      <SplitButton items={HIGHLIGHT_ITEMS} label="Highlight color" disabled={disabled} apply={apply} />
      <SplitButton items={HEADING_ITEMS} label="Heading level" disabled={disabled} apply={apply} />
      <SplitButton items={LIST_ITEMS} label="List type" disabled={disabled} apply={apply} />
      <SplitButton items={INSERT_ITEMS} label="Insert" disabled={disabled} apply={apply} />
    </div>
  );
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

  // Whether a person has done anything since this field mounted. A value that arrives on its own — a world
  // still loading, a draft resolving — is not an edit and must not become an undo step, or a freshly opened
  // editor offers to "undo" back to the empty field it rendered for one tick. A generation, a Reset or a
  // template swap all follow a click, which is what tells them apart: by shape they are the same change.
  const userActed = useRef(false);
  useEffect(() => {
    const mark = () => { userActed.current = true; };
    const doc = editor.getRootElement()?.ownerDocument ?? document;
    doc.addEventListener('pointerdown', mark, { capture: true });
    doc.addEventListener('keydown', mark, { capture: true });
    return () => {
      doc.removeEventListener('pointerdown', mark, { capture: true });
      doc.removeEventListener('keydown', mark, { capture: true });
    };
  }, [editor]);

  useEffect(() => {
    if (value === expected.current) return;
    expected.current = value;
    // `history-merge` folds the rebuild into the current history entry instead of pushing one.
    editor.update(
      () => buildEditorState(value, parseRef.current),
      userActed.current ? undefined : { tag: 'history-merge' },
    );
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

/**
 * Keeps the preview on the line being written. Every selection change (and the edit that follows it) reports
 * the caret, and the field scrolls the other pane to match — so with both panes on screen the resolved text
 * beside the cursor is the text the cursor is in, rather than whatever happens to be mid-view.
 *
 * Only reports while the editor holds focus: once the reader is scrolling instead of typing, the centre-based
 * sync should own the panes again, and a stale caret would keep yanking them back.
 */
function CaretFollowPlugin({ onCaret }: { onCaret: () => void }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    const report = () => { if (editor.getRootElement()?.contains(document.activeElement)) onCaret(); };
    return mergeRegister(
      editor.registerUpdateListener(report),
      editor.registerCommand(SELECTION_CHANGE_COMMAND, () => { report(); return false; }, COMMAND_PRIORITY_LOW),
    );
  }, [editor, onCaret]);
  return null;
}

/**
 * HistoryPlugin, given a baseline entry to undo *to*.
 *
 * It records a change by pushing the entry it was already holding, and starts holding none — so the
 * first change after mount becomes the baseline instead of an undo step. Typing hides that (the second
 * keystroke is undoable), but a field whose first change is a whole-value replace — Generate on an
 * untouched summary, a Reset, a template swap — had nothing to undo at all.
 */
function SeededHistoryPlugin() {
  const [editor] = useLexicalComposerContext();
  const historyState = useMemo(() => createEmptyHistoryState(), []);

  // In an effect, not in render: during render the initial state is still pending, so what's readable
  // is the bare root — and `setEditorState` rejects an empty state, which makes undoing to it a silent
  // no-op rather than an error.
  useEffect(() => {
    historyState.current ??= { editor, editorState: editor.getEditorState() };
  }, [editor, historyState]);

  return <HistoryPlugin externalHistoryState={historyState} />;
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
    // Narrow: one row that scrolls sideways rather than three that stack — the palette is reference
    // material while reading a prompt, and three rows of it cost more screen than the editor can spare.
    // `min-w-0` lets the strip size to its parent rather than to its chips; both halves of that need it,
    // since a flex item stuck at content width has nothing to scroll within and nothing to wrap into.
    // Insertable tokens, not this field's contents — see the palette bar for why the find bar skips them.
    <div data-editor-find-skip className="flex items-center gap-1 min-w-0 overflow-x-auto sm:flex-wrap sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]{display:none}">
      <span className="text-meta text-muted-foreground mr-1 flex-shrink-0">Insert:</span>
      {items.map((v) => (
        // Nothing to add while inert: the tip said the label the chip is already showing.
        <Tip key={v.token} tip={interactive ? `Insert ${v.label}` : undefined} labelsChild={false}>
          <button
            type="button"
            disabled={!interactive}
            onClick={interactive ? () => insert(v.token) : undefined}
            className={cn(CHIP_BASE, 'border flex-shrink-0', interactive ? 'cursor-pointer hover:brightness-95' : 'cursor-default')}
            style={{ backgroundColor: v.color, color: '#000' }}
          >
            {v.label}
          </button>
        </Tip>
      ))}
    </div>
  );
}

// --- editor + field ---

const EDITOR_CLASS =
  'h-full min-h-[160px] w-full overflow-auto rounded-md border border-input bg-background px-3 py-2 ' +
  'text-label outline-none whitespace-pre-wrap';

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
    <div ref={scrollRef} onScroll={onScroll} data-testid="prompt-preview" className="h-full min-h-[160px] overflow-auto rounded-md border border-input bg-muted/40 px-3 py-2 text-label whitespace-pre-wrap">
      {vocab.parse(value).map((seg, i) => {
        if (seg.type === 'text') return <span key={i}>{seg.value}</span>;
        const color = vocab.color(seg.token);
        // resolveToken applies the placement's affixes and the vanish-when-empty rule, so the preview
        // matches what the model receives. It returns undefined for another family's token (placeholders),
        // which then falls back to that family's own by-token lookup. `??` — '' is a real result.
        const rendered = resolveToken(seg.token, previewValues) ?? previewValues[seg.token] ?? seg.token;
        // A chip with nothing to show — an absent value, or an affixed placement whose whole phrase drops
        // out — leaves a marker rather than vanishing, so an empty resolution reads differently from a
        // placeholder the author never inserted. The model still receives nothing.
        if (rendered === '') {
          return (
            <mark
              key={i}
              role="img"
              aria-label={EMPTY_MARK_LABEL}
              className={EMPTY_MARK_CLASS}
              style={emptyMarkStyle(color)}
              data-tint=""
            />
          );
        }
        return (
          <mark key={i} className={TINT_MARK_CLASS} style={tintMarkStyle(color)} data-tint="">
            {rendered}
          </mark>
        );
      })}
    </div>
  );
}

/** Preview for a markdown field: resolve each chip to its value, then render the result the way the game
 *  will — with each value tinted its chip's color, the same as the plain pane. The renderer takes a string,
 *  so each value carries its color through the parse as sentinel characters and comes back out as a mark
 *  (see previewTint). Author text and values are scrubbed first, so neither can forge a pairing. */
function MarkdownPreviewPane({ value, previewValues, vocab, scrollRef, onScroll }: {
  value: string;
  previewValues?: Record<string, string>;
  vocab: ChipVocabulary;
  scrollRef?: React.Ref<HTMLDivElement>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}) {
  const resolved = vocab
    .parse(value)
    .map((seg) => {
      if (seg.type === 'text') return stripTintSentinels(seg.value);
      const rendered = resolveToken(seg.token, previewValues ?? {}) ?? previewValues?.[seg.token] ?? seg.token;
      const color = vocab.color(seg.token);
      return rendered === '' ? emptyMarker(color) : tintValue(stripTintSentinels(rendered), color);
    })
    .join('');
  return (
    <div ref={scrollRef} onScroll={onScroll} data-testid="prompt-preview" className="h-full min-h-[160px] overflow-auto rounded-md border border-input bg-muted/40 px-3 py-2 text-label">
      <MarkdownRenderer text={resolved} tinted />
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
const PromptField = ({ value, onChange, variables = [], vocabulary, previewValues, onPreviewOpen, markdown = false, resizable = false, placeholder, className, readOnly = false, ariaLabel, sampleData = false, onRequestEdit, readOnlyReason, onRequestFullscreen, fullscreen: fullscreenProp, insertTrigger, label, labelAside }: {
  value: string;
  onChange: (v: string) => void;
  /** Prompt-variable palette (used when no explicit `vocabulary` is given — the default prompt family). */
  variables?: PromptVariable[];
  /** Override the token family (e.g. world placeholders). Defaults to the prompt vocabulary from `variables`. */
  vocabulary?: ChipVocabulary;
  previewValues?: Record<string, string>;
  /** Fired when the Preview tab is opened — lets a caller re-derive `previewValues` (e.g. re-roll Wildcards). */
  onPreviewOpen?: () => void;
  /** The field's caption. Given one, the field owns it: a plain field puts it on the button row, and a
   *  markdown field keeps it on its own line and puts the formatting buttons on the button row instead —
   *  either way one row shorter than a caption stacked above the chrome. */
  label?: ReactNode;
  /** Rendered at the end of the caption's row (an AI generate/undo toolbar, say). Needs `label`. */
  labelAside?: ReactNode;
  /** Prose field: adds a markdown formatting toolbar and renders the Preview as markdown. */
  markdown?: boolean;
  /** Let the author drag the field taller/shorter. Only for fields in a content-height container (the
   *  world editor's scroll panes) — in a height-pinned pane the dragged box would just overflow its slot. */
  resizable?: boolean;
  /** Empty-field hint. */
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  /** Badge the Preview when some of it is stand-in content. `true` uses the default wording; a string names
   *  what is real and what isn't, for a pane that mixes the two. */
  sampleData?: boolean | string;
  /** Offered alongside the read-only notice: what to do about it (duplicate the preset and edit the copy). */
  onRequestEdit?: () => void;
  /** What is read-only, named in the notice (e.g. a built-in preset's name). */
  readOnlyReason?: string;
  /**
   * Hand fullscreen to the caller. Given this, the field stops rendering its own overlay and just reports
   * the request — which is how Settings gets the prompt rail into the full screen alongside the editor,
   * since the rail lives a level above this component and could never be pulled down into its overlay.
   * Call sites with no chrome of their own (world editor, dictionary entries) omit it and keep the
   * self-managed overlay.
   */
  onRequestFullscreen?: () => void;
  /** Whether the caller's overlay is open — only read when `onRequestFullscreen` is given. */
  fullscreen?: boolean;
  /** Names the editor for a screen reader. Lexical renders a `div`, so a `<label htmlFor>` cannot reach it. */
  ariaLabel?: string;
  /**
   * Switches the field to the shared-palette insert model: its own Insert row is dropped, typing this
   * character opens the insert menu at the caret, and the field claims the panel's palette while focused.
   * Placeholder fields pass `{`; prompt fields omit it and keep their per-field row.
   */
  insertTrigger?: string;
}) => {
  const vocab = useMemo(() => vocabulary ?? promptVocabulary(variables), [vocabulary, variables]);
  const dragKey = useRef<string | null>(null);
  const [tab, setTab] = useState('edit');
  // A markdown field always has something to preview (the rendered prose); a plain chip field only earns
  // the toggle once there are values to swap in.
  const showTabs = markdown || !!previewValues;
  // ...but with no chip in the text the preview is character-identical to the editor, so Preview disables.
  // Disabled rather than hidden: the tab strip taking height away exactly as the author inserts their
  // first chip is a reflow around the caret, worse than the strip idling.
  const hasChips = useMemo(() => vocab.parse(value).some((seg) => seg.type === 'variable'), [vocab, value]);
  const previewEnabled = markdown || hasChips;
  // The value can change under an open Preview (a preset switch, a find-bar replace). If that disables
  // Preview, land back on Edit — a disabled tab must not stay the active one.
  useEffect(() => {
    if (!previewEnabled && tab !== 'edit') setTab('edit');
  }, [previewEnabled, tab]);

  // Layout: the field measures itself rather than asking the device, so a shrunken desktop window falls
  // back to tabs and mobile never reaches the split threshold — no breakpoint to keep in sync.
  const [measureRef, containerWidth] = useContainerWidth();
  const [splitMode, setSplitMode] = usePromptSplitMode();
  // Fullscreen is either ours or the caller's; `hostedFullscreen` means the caller renders the overlay.
  const hostedFullscreen = !!onRequestFullscreen;
  // The field hands its body to the overlay rather than leaving a copy behind, so the morph measures this
  // wrapper on the way in and remembers it for the way back.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const morph = useMorphFullscreen(bodyRef);
  // `contentInOverlay`, not `mounted`: closing is the overlay fading out in place, so the body has to be
  // back in its docked slot — under the fading panel — from the first frame of the close.
  const fullscreen = hostedFullscreen ? !!fullscreenProp : morph.contentInOverlay;
  // The field's height, held open while its body is away in the overlay. Without it the panel this sits in
  // gets shorter by exactly one editor, and the browser clamps its scroll to the new bottom — so opening
  // full screen jumped the page behind it, and closing jumped it back.
  const [heldHeight, setHeldHeight] = useState<number | null>(null);
  const toggleFullscreen = () => {
    if (onRequestFullscreen) return onRequestFullscreen();
    // `offsetHeight`, not the bounding rect: the rect is in *painted* pixels, so under a page zoom or any
    // ancestor scale it comes back already multiplied. Feeding that number back as a CSS height gets it
    // scaled a second time and the spacer lands short — which is the panel shrinking, and the scroll
    // jumping, all over again.
    if (!morph.mounted) setHeldHeight(bodyRef.current?.offsetHeight ?? null);
    morph.toggle();
  };
  const isMobile = useIsMobile();
  // Fullscreen measures the viewport, not the inline slot it was opened from.
  const effectiveWidth = fullscreen ? (typeof window !== 'undefined' ? window.innerWidth - 48 : 0) : containerWidth;
  const layout = resolveLayout(splitMode, effectiveWidth, showTabs, fullscreen);
  // A split with Preview disabled would show two identical panes, so it waits for a chip too.
  const split = layout === 'split' && previewEnabled;
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

  // Scroll the preview to wherever the caret is. Shares the `applying` gate with the scroll sync, so the
  // preview's resulting scroll event is never mistaken for the reader scrolling it themselves.
  const followCaret = useCallback(() => {
    const edit = editScrollRef.current;
    const target = previewScrollRef.current;
    if (!split || !edit || !target) return;
    const offset = caretOffset(edit);
    if (offset === null) return;
    const anchor = anchorAt(edit, PROMPT_ANCHORS.edit, offset);
    proxyAnchor.current = anchor;
    applying.current = true;
    applyAnchor(target, PROMPT_ANCHORS.preview, anchor);
    releaseApplying();
  }, [split]);

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
    const anchor = captureAnchor(e.currentTarget, PROMPT_ANCHORS[from]);
    proxyAnchor.current = anchor;
    if (!split || !anchor) return;
    const target = from === 'edit' ? previewScrollRef.current : editScrollRef.current;
    if (!target) return;
    applying.current = true;
    applyAnchor(target, from === 'edit' ? PROMPT_ANCHORS.preview : PROMPT_ANCHORS.edit, anchor);
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
      applyAnchor(el, tab === 'edit' ? PROMPT_ANCHORS.edit : PROMPT_ANCHORS.preview, anchor);
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
      // On mobile the inline field is ~225px tall against a prompt many screens long, so tapping into it
      // opens the full screen instead. Deliberately a tap and not a focus event: focus also arrives when a
      // closing dialog hands it back, and reacting to that re-opened the full screen the player had just
      // left — with the keyboard, over and over. A restored focus never comes with a click.
      onClick={isMobile && !fullscreen ? toggleFullscreen : undefined}
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
          <div className="pointer-events-none absolute left-3 top-2 text-helper text-muted-foreground">
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
          {typeof sampleData === 'string' ? sampleData : 'Sample data'}
        </span>
      )}
    </div>
  );

  // Swipe between panes when they can't sit side by side and the screen is the whole surface — the
  // mobile expression of the split, landing on the same content position via the shared anchor. With
  // Preview disabled the tab bar shows instead: dots would offer a position the gesture can't reach.
  const swipeable = isMobile && fullscreen && !split && showTabs && previewEnabled;
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

  // Nothing to type into: read-only, or the preview pane is the one showing.
  const editingDisabled = readOnly || (!split && showTabs && tab !== 'edit');

  const chrome = (
    // The chip palette is many chips wide and wraps; it must be allowed to shrink (`min-w-0`) or its
    // intrinsic width shoves the buttons off the side of a mobile screen instead of wrapping.
    <div className="flex items-center gap-1 flex-shrink-0">
      <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        {label && !markdown && <Label className="leading-none">{label}</Label>}
        {markdown && <MarkdownToolbar parse={vocab.parse} disabled={editingDisabled} />}
        {/* With a shared palette the per-field row would repeat the same chips above every field on the
            panel — the whole reason the palette was hoisted out. */}
        {!insertTrigger && <VariableToolbar vocab={vocab} interactive={!readOnly && (split || !showTabs || tab === 'edit')} />}
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        {/* Contributed buttons (an AI generate, say) lead, divided from the field's own history the same
            way history is divided from the view controls — three groups, two rules. */}
        {label && !markdown && labelAside && (
          <>
            {labelAside}
            <span className="mx-0.5 w-hairline self-stretch bg-border" />
          </>
        )}
        <HistoryButtons disabled={editingDisabled} />
        <span className="mx-0.5 w-hairline self-stretch bg-border" />
        {showTabs && splitAvailable(effectiveWidth, fullscreen) && (
          <Tip tip={split ? 'Show one pane at a time' : 'Show edit and preview side by side'}>
            <button
              type="button"
              disabled={!previewEnabled}
              onClick={() => setSplitMode(split ? 'tabs' : 'split')}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              {split ? <Square className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
            </button>
          </Tip>
        )}
        {/* The tip is also the name the fullscreen shell hands focus back by, so the two cannot drift. */}
        <Tip tip={fullscreen ? 'Exit full screen' : 'Edit full screen'}>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </Tip>
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
        // Dots, not tab buttons: the gesture is the control, and a full-width tab bar on mobile spends
        // height the editor just got back.
        <div className="flex justify-center gap-1.5 py-1 flex-shrink-0" aria-hidden>
          {['edit', 'preview'].map((t) => (
            <span key={t} className={cn('h-1.5 w-1.5 rounded-full', tab === t ? 'bg-primary' : 'bg-muted-foreground/40')} />
          ))}
        </div>
      ) : (
        <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview" disabled={!previewEnabled}>Preview</TabsTrigger>
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
    <ReadOnlyNotice reason={readOnlyReason} onRequestEdit={onRequestEdit} />
  );

  const body = (
    // The caption doubles as the field's identity for the World Editor's find bar, which otherwise has only
    // the text to go on — and two fields on one panel routinely hold the very same text.
    <div
      ref={(element) => { measureRef(element); bodyRef.current = element; }}
      data-find-field={typeof label === 'string' ? label : undefined}
      className={cn('flex flex-col flex-1 min-h-0 gap-2', className)}
    >
      {/* Above the chrome, not below it: the Options panel shows the same notice with nothing above it, so
          anywhere else here makes it jump as you move between a prompt's sub-tabs. */}
      {readOnlyNotice}
      {label && markdown && (
        // A markdown field's caption gets its own row because the formatting toolbar takes the slot it
        // would otherwise sit in — and at full screen on mobile that row is the window's heading, so it
        // centers there the way every other full-screen heading does.
        <div className={cn(
          'flex items-center justify-between gap-2 flex-shrink-0',
          fullscreen && 'max-sm:justify-center',
        )}>
          <Label className="leading-none">{label}</Label>
          {labelAside}
        </div>
      )}
      {chrome}
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
        {!hostedFullscreen && morph.mounted ? (
          <>
            {/* While closing, the body is back here and the still-mounted shell above it is just the
                fading panel — so the spacer that held the body's slot open gives way to the body itself. */}
            {fullscreen
              ? <div aria-hidden className="flex-shrink-0" style={{ height: heldHeight ?? undefined }} />
              : body}
            <FullscreenShell
              morph={morph}
              title={ariaLabel ?? 'Prompt editor'}
              returnFocus={() => bodyRef.current?.querySelector<HTMLElement>('button[aria-label="Edit full screen"]')}
            >
              {fullscreen ? body : null}
            </FullscreenShell>
          </>
        ) : (
          body
        )}
        <SeededHistoryPlugin />
        <ValueSyncPlugin value={value} onChange={onChange} parse={vocab.parse} onExternalValue={resetScroll} />
        <EditablePlugin readOnly={readOnly} />
        <ChipDragPlugin dragKey={dragKey} vocab={insertTrigger ? vocab : undefined} />
        <CaretFollowPlugin onCaret={followCaret} />
        {insertTrigger && !readOnly && (
          <>
            <ChipTypeaheadPlugin trigger={insertTrigger} vocab={vocab} />
            <ChipInsertTargetPlugin vocab={vocab} />
          </>
        )}
      </PromptDragContext.Provider>
      </ChipVocabularyContext.Provider>
    </LexicalComposer>
  );
};

export default PromptField;
