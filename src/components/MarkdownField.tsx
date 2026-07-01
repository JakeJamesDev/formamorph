import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bold, Italic, Heading1, Heading2, List, ListOrdered, Link2, Quote, Code, Undo2, Redo2,
} from 'lucide-react';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { applyMarkdownAction, type MarkdownAction } from '@/lib/markdownToolbar';
import {
  initHistory, commitHistory, undoHistory, redoHistory, canUndo, canRedo, type HistoryState,
} from '@/lib/textHistory';
import { cn } from '@/lib/utils';

const TOOLBAR: { action: MarkdownAction; Icon: typeof Bold; title: string }[] = [
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

// Group consecutive keystrokes within this window into a single undo step.
const COALESCE_MS = 500;

/**
 * Markdown text field with Edit/Preview tabs, a formatting toolbar, undo/redo, and a Streamdown
 * preview that matches in-game rendering. Toolbar actions wrap/insert markdown into the current
 * selection; undo/redo are driven by an internal history (a controlled textarea breaks native undo).
 */
const MarkdownField = ({ value, onChange, placeholder, className }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) => {
  // A loaded/migrated world can carry an undefined description at runtime; coalesce so the controlled
  // textarea and history never see undefined.
  const text = value ?? '';
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Selection to restore after an edit (the value is controlled, so we set it post-render).
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);

  const historyRef = useRef<HistoryState>(
    initHistory({ value: text, selectionStart: text.length, selectionEnd: text.length }),
  );
  const lastEditRef = useRef<{ kind: 'type' | 'discrete'; time: number }>({ kind: 'discrete', time: 0 });
  const expectedValueRef = useRef(text); // the value our own edits will push in; used to spot external resets
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  // Reset history when the value changes from outside (e.g. a different world loads).
  useEffect(() => {
    if (text === expectedValueRef.current) return;
    historyRef.current = initHistory({ value: text, selectionStart: text.length, selectionEnd: text.length });
    expectedValueRef.current = text;
    forceUpdate();
  }, [text]);

  // Share the field height across the Edit textarea and Preview box: resizing either records the
  // height, and the other adopts it when it mounts (only one is mounted at a time per tab).
  const heightRef = useRef<number>();
  const observerRef = useRef<ResizeObserver | null>(null);
  const attachResize = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect();
    if (!node) return;
    if (heightRef.current != null) node.style.height = `${heightRef.current}px`;
    const observer = new ResizeObserver(() => {
      heightRef.current = node.getBoundingClientRect().height;
    });
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  // One callback ref for the textarea: keep the node for selection ops AND attach the resize observer.
  const attachTextarea = useCallback((node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
    attachResize(node);
  }, [attachResize]);

  useLayoutEffect(() => {
    const pending = pendingSelectionRef.current;
    const node = textareaRef.current;
    if (!pending || !node) return;
    pendingSelectionRef.current = null;
    node.focus();
    node.setSelectionRange(pending.start, pending.end);
  });

  const commit = (next: HistoryState, restoreSelection: boolean) => {
    historyRef.current = next;
    expectedValueRef.current = next.present.value;
    if (restoreSelection) {
      pendingSelectionRef.current = { start: next.present.selectionStart, end: next.present.selectionEnd };
    }
    onChange(next.present.value);
    forceUpdate();
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const node = e.target;
    const now = Date.now();
    const coalesce = lastEditRef.current.kind === 'type' && now - lastEditRef.current.time < COALESCE_MS;
    lastEditRef.current = { kind: 'type', time: now };
    commit(
      commitHistory(
        historyRef.current,
        { value: node.value, selectionStart: node.selectionStart, selectionEnd: node.selectionEnd },
        coalesce,
      ),
      false, // the textarea already holds the right caret while typing
    );
  };

  const runAction = (action: MarkdownAction) => {
    const node = textareaRef.current;
    if (!node) return;
    const next = applyMarkdownAction(text, node.selectionStart, node.selectionEnd, action);
    lastEditRef.current = { kind: 'discrete', time: Date.now() };
    commit(
      commitHistory(
        historyRef.current,
        { value: next.value, selectionStart: next.selectionStart, selectionEnd: next.selectionEnd },
        false,
      ),
      true,
    );
  };

  const doUndo = () => {
    const next = undoHistory(historyRef.current);
    if (next === historyRef.current) return;
    lastEditRef.current = { kind: 'discrete', time: 0 };
    commit(next, true);
  };

  const doRedo = () => {
    const next = redoHistory(historyRef.current);
    if (next === historyRef.current) return;
    lastEditRef.current = { kind: 'discrete', time: 0 };
    commit(next, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault();
      doUndo();
    } else if ((key === 'z' && e.shiftKey) || key === 'y') {
      e.preventDefault();
      doRedo();
    }
  };

  return (
    <Tabs defaultValue="edit" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="edit">Edit</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>
      <TabsContent value="edit" className="space-y-2">
        <div className="flex flex-wrap items-center gap-1">
          {TOOLBAR.map(({ action, Icon, title }) => (
            <Button
              key={action}
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={title}
              aria-label={title}
              onClick={() => runAction(action)}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
          <div className="mx-1 h-5 w-px bg-border" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Undo"
            aria-label="Undo"
            disabled={!canUndo(historyRef.current)}
            onClick={doUndo}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Redo"
            aria-label="Redo"
            disabled={!canRedo(historyRef.current)}
            onClick={doRedo}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>
        <Textarea
          ref={attachTextarea}
          value={text}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn('min-h-[100px] resize-y', className)}
        />
      </TabsContent>
      <TabsContent value="preview">
        <div
          ref={attachResize}
          className="min-h-[100px] resize-y overflow-auto rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {text.trim()
            ? <MarkdownRenderer text={text} />
            : <span className="text-muted-foreground">Nothing to preview.</span>}
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default MarkdownField;
