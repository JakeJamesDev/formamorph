import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Columns2, Maximize2, Minimize2, Redo2, Square, Undo2, Braces, Variable } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TOOLBAR_BTN } from '@/components/prompt/toolbarStyles';
import { resolveLayout, usePromptSplitMode, useContainerWidth, MIN_PANE_WIDTH } from '@/lib/promptLayout';
import { useMorphFullscreen } from '@/lib/useMorphFullscreen';
import { FullscreenShell } from '@/components/FullscreenShell';
import { cn } from '@/lib/utils';
import { SLOT_SNIPPETS, STAT_CODE_SNIPPETS, type InsertSnippet } from '@/lib/codeSnippets';
import type { CodeSession } from '@/components/prompt/codeSession';

function InsertMenu({ items, label, Icon, onPick }: {
  items: InsertSnippet[]; label: string; Icon: typeof Braces; onPick: (snippet: InsertSnippet) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button" title={label} aria-label={label}
          onMouseDown={(event) => event.preventDefault()}
          className={cn(TOOLBAR_BTN, 'flex items-center gap-1 data-[state=open]:bg-accent data-[state=open]:text-foreground')}
        >
          <Icon className="h-4 w-4" />
          <span className="text-meta">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-1" onOpenAutoFocus={(event) => event.preventDefault()}>
        <div className="flex flex-col">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onMouseDown={(event) => { event.preventDefault(); setOpen(false); onPick(item); }}
              className="text-left rounded px-2 py-1.5 text-helper text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface CodeAreaProps {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
  placeholder?: string;
  /** Shown at the start of the toolbar row, so a caption costs no extra line. */
  label?: ReactNode;
  /** Offer the `{{slot}}` menu. Template editing only. */
  slots?: boolean;
  /** The world's stat names, completed inside string literals — the one place a typo fails silently. */
  statNames?: readonly string[];
  /** What the code produces. Given this, the field grows the Edit | Preview pair, which becomes a
   *  side-by-side split once full screen has the width for it. */
  preview?: ReactNode;
  className?: string;
  rows?: number;
}

/** Toolbar + editor. Split out so the fullscreen overlay can mount a second copy against the same
 *  value without the outer component recursing into itself. */
function CodeAreaBody({
  value, onChange, ariaLabel, placeholder, label, slots, preview, className, rows = 8, fullscreen,
  onToggleFullscreen, session, active, expose,
}: Omit<CodeAreaProps, 'statNames'> & {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  /** The one editor both copies take turns hosting. Null until its chunk has loaded. */
  session: CodeSession | null;
  /** Whether this copy is the one holding the editor right now. */
  active: boolean;
  /** The inline copy reports its own field up, so full screen knows which box to grow out of. */
  expose?: (element: HTMLElement | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [measureRef, containerWidth] = useContainerWidth();
  const [splitMode, setSplitMode] = usePromptSplitMode();
  // Full screen measures the window it just took over, not the slot the field was opened from.
  const effectiveWidth = fullscreen ? (typeof window !== 'undefined' ? window.innerWidth - 48 : 0) : containerWidth;
  const showTabs = !!preview;
  const split = resolveLayout(splitMode, effectiveWidth, showTabs, fullscreen) === 'split';

  // The editor is moved rather than copied: two views would mean two histories, and the toggle would throw
  // one of them away every trip. Done from the ref callback as well as an effect, because the box it lives
  // in is remounted by things the effect can't see — switching to the Preview tab and back unmounts it.
  const attach = useCallback((element: HTMLElement | null) => {
    hostRef.current = element as HTMLDivElement | null;
    expose?.(element);
    if (element && session && active && session.dom.parentElement !== element) element.appendChild(session.dom);
  }, [session, active, expose]);

  useLayoutEffect(() => {
    if (!session || !active) return;
    const host = hostRef.current;
    if (host && session.dom.parentElement !== host) host.appendChild(session.dom);
    if (fullscreen) session.focus();
  }, [session, active, fullscreen]);

  const insert = (snippet: InsertSnippet) => {
    if (session) { session.insert(snippet); return; }
    // Fallback path: the chunk is still loading, so the plain textarea takes the insert itself.
    const area = hostRef.current?.querySelector('textarea');
    const start = area?.selectionStart ?? value.length;
    const end = area?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + snippet.text + value.slice(end));
  };

  const editSurface = (
    <div
      ref={attach}
      // A floor, not `min-h-0`: in a height-pinned pane the field is a flex child, and with the
      // on-screen keyboard eating most of `--app-h` a zero minimum lets it collapse to nothing.
      // Keeping a usable minimum makes the pane around it scroll instead.
      className={cn(
        'font-mono text-label flex flex-col flex-1 min-h-[6rem] overflow-hidden rounded-md border border-input bg-transparent',
        'focus-within:ring-1 focus-within:ring-ring',
      )}
      // The row count the field was asked for, as a floor rather than a height: a flex column would
      // otherwise squeeze the box below the size its caller sized it for.
      style={fullscreen ? undefined : { minHeight: `${rows * 1.5 + 1}rem` }}
    >
      {!session && active && (
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="h-full w-full resize-none border-0 font-mono text-label focus-visible:ring-0"
        />
      )}
    </div>
  );
  const previewSurface = (
    <div className="h-full min-h-[6rem] overflow-auto rounded-md border border-input bg-muted/40 px-3 py-2">
      {preview}
    </div>
  );

  return (
    <div ref={measureRef} className={cn('flex flex-col gap-1 min-h-0', className)}>
      {/* Same three-part chrome as PromptField: what you insert on the left, the field's own history and
          view controls on the right, one rule between them. */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {label && <Label className="leading-none">{label}</Label>}
          {slots && <InsertMenu items={SLOT_SNIPPETS} label="Slot" Icon={Braces} onPick={insert} />}
          <InsertMenu items={STAT_CODE_SNIPPETS} label="Variable" Icon={Variable} onPick={insert} />
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button" title="Undo" aria-label="Undo" className={TOOLBAR_BTN}
            disabled={!session?.canUndo()}
            onMouseDown={(event) => { event.preventDefault(); session?.undo(); }}
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button" title="Redo" aria-label="Redo" className={TOOLBAR_BTN}
            disabled={!session?.canRedo()}
            onMouseDown={(event) => { event.preventDefault(); session?.redo(); }}
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <span className="mx-0.5 w-px self-stretch bg-border" />
          {showTabs && fullscreen && effectiveWidth - 12 >= MIN_PANE_WIDTH * 2 && (
            <button
              type="button"
              onMouseDown={(event) => { event.preventDefault(); setSplitMode(split ? 'tabs' : 'split'); }}
              title={split ? 'Show one pane at a time' : 'Show edit and preview side by side'}
              aria-label={split ? 'Show one pane at a time' : 'Show edit and preview side by side'}
              className={TOOLBAR_BTN}
            >
              {split ? <Square className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
            </button>
          )}
          <button
            type="button"
            title={fullscreen ? 'Exit full screen' : 'Edit full screen'}
            aria-label={fullscreen ? 'Exit full screen' : 'Edit full screen'}
            className={TOOLBAR_BTN}
            onMouseDown={(event) => { event.preventDefault(); onToggleFullscreen(); }}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {!showTabs ? editSurface : split ? (
        <div className="flex-1 min-h-0 flex gap-3">
          <div className="flex-1 min-w-0 flex flex-col">{editSurface}</div>
          <div className="flex-1 min-w-0 flex flex-col">{previewSurface}</div>
        </div>
      ) : (
        <Tabs defaultValue="edit" className="flex flex-col flex-1 min-h-0">
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="edit" className="mt-2 flex-1 min-h-0 data-[state=active]:flex flex-col">
            {editSurface}
          </TabsContent>
          <TabsContent value="preview" className="mt-2 flex-1 min-h-0 data-[state=active]:flex flex-col">
            {previewSurface}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/**
 * A JavaScript editor with the affordances a bare textarea has none of: syntax colouring, bracket
 * matching, undo and redo that survive the programmatic writes a template insert makes, a full-screen
 * toggle, and menus that name the variables and slot forms the sandbox understands — none of which the
 * field itself could hint at.
 *
 * CodeMirror arrives on demand, so a session that never opens the world editor never fetches it; until it
 * lands the field is a plain textarea on the same value, which is editable rather than merely visible.
 *
 * Full screen raises an overlay holding only the editor, so it works the same whether the field sits on
 * a panel or inside a dialog — and a dialog's own buttons stay where they were rather than being grown
 * away from underneath the author.
 */
export function CodeArea(props: CodeAreaProps) {
  const sourceRef = useRef<HTMLElement | null>(null);
  const morph = useMorphFullscreen(sourceRef);
  const [session, setSession] = useState<CodeSession | null>(null);
  // The editor is created once and outlives every render, so what it calls back into has to be read at
  // call time rather than captured.
  const latest = useRef(props);
  latest.current = props;
  const [, bump] = useState(0);
  const onUpdate = useCallback(() => bump((n) => n + 1), []);
  // Stable, so the field's ref callback isn't torn down and re-run on every render — which would detach and
  // re-append the editor underneath the caret.
  const holdSource = useCallback((element: HTMLElement | null) => {
    // A remount of the box behind the Preview tab reports null on the way out; the rect the morph grows from
    // is the inline field, so a transient null must not replace it.
    if (element) sourceRef.current = element;
  }, []);

  const { ariaLabel, placeholder, slots } = props;
  useEffect(() => {
    let live = true;
    let created: CodeSession | null = null;
    void import('@/components/prompt/codeSession').then(({ createCodeSession }) => {
      if (!live) return;
      created = createCodeSession({
        doc: latest.current.value,
        ariaLabel,
        placeholder,
        slots,
        statNames: latest.current.statNames,
        onChange: (next) => latest.current.onChange(next),
        onUpdate,
      });
      setSession(created);
    });
    return () => { live = false; created?.destroy(); setSession(null); };
  }, [ariaLabel, placeholder, slots, onUpdate]);

  // The parent stays the single owner of the text: anything it writes lands in the editor here.
  useEffect(() => { session?.setValue(props.value); }, [session, props.value]);
  // A gutter is worth its width only where there is width to spare.
  useEffect(() => { session?.setLineNumbers(morph.mounted); }, [session, morph.mounted]);
  // Stats are renamed and added while a code field is open, so the completions follow the list.
  useEffect(() => { session?.setStatNames(props.statNames ?? []); }, [session, props.statNames]);

  return (
    <>
      <CodeAreaBody
        {...props}
        fullscreen={false}
        onToggleFullscreen={morph.toggle}
        session={session}
        active={!morph.mounted}
        expose={holdSource}
      />
      {/* No heading: the field's own caption rides in the toolbar and comes with it, so a header row
          would name the box twice and spend a row doing it. */}
      <FullscreenShell morph={morph} title={props.ariaLabel}>
        <CodeAreaBody
          {...props}
          className="flex-1 min-h-0"
          fullscreen
          onToggleFullscreen={morph.close}
          session={session}
          active
        />
      </FullscreenShell>
    </>
  );
}

export default CodeArea;
