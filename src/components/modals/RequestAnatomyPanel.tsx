import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { Columns2, Maximize2, Minimize2, Square } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HintInfo } from '@/components/SettingsRows';
import { ANATOMY_RUN_ATTR, RequestAnatomyView, type AnatomyViewMode } from '@/components/game/RequestAnatomyView';
import { applyAnchor, captureAnchor, type ScrollAnchor } from '@/components/prompt/previewScrollSync';
import type { PromptJumpTarget } from '@/lib/promptJump';
import { resolveLayout, splitAvailable, usePromptSplitMode, useContainerWidth } from '@/lib/promptLayout';
import {
  buildAnatomyHub,
  type AnatomyConditions, type AnatomyPreviewPrompts, type AnatomyPreviewSettings,
} from '@/lib/anatomyPreview';

/**
 * The Anatomy hub: what a prompt *is*, shown the moment it is selected in Settings → Prompts. The whole
 * request (or requests) that prompt is part of, drawn from an example playthrough under the player's own
 * generation settings, with every highlighted run a way into the editor that owns it.
 *
 * Chips or Preview, the same flip the prompt editors offer: Chips collapses everything the app injected to
 * the chip that asked for it, so the request reads as the player's own template with the blanks marked;
 * Preview shows the resolved request, whole and untruncated.
 */

/** The fixture playthrough at its fullest: every condition the player's settings allow is shown firing.
 *  One a playthrough could skip (no recall hit this turn) still can't promise anything — the builder
 *  drops what the settings themselves rule out. */
const ALL_CONDITIONS: AnatomyConditions = { recap: true, recall: true, brackets: true };

const MODE_LABELS: Record<AnatomyViewMode, string> = { chips: 'Chips', resolved: 'Preview' };

/** What the two views are scrolled together by: one element per run, drawn by both. */
const ANATOMY_RUN_SELECTOR = `[${ANATOMY_RUN_ATTR}]`;

export function RequestAnatomyPanel({
  tab,
  prompts,
  values,
  settings,
  mode,
  onModeChange,
  onJump,
  fullscreen,
  onRequestFullscreen,
}: {
  /** Which prompt's hub this is — one of the rail's own ids. */
  tab: string;
  prompts: AnatomyPreviewPrompts;
  values: Record<string, string>;
  settings: AnatomyPreviewSettings;
  /** Which view is showing. Held by the caller, so a trip into an editor and back keeps it. */
  mode: AnatomyViewMode;
  onModeChange: (mode: AnatomyViewMode) => void;
  /** Open the editor a clicked run belongs to, or the prompt an assembled block came from. */
  onJump: (target: PromptJumpTarget) => void;
  /** The Prompts panel's fullscreen, same as the editors toggle — shown as a button when wired. */
  fullscreen?: boolean;
  onRequestFullscreen?: () => void;
}) {
  const requests = useMemo(
    () => buildAnatomyHub(tab, prompts, values, ALL_CONDITIONS, settings),
    [tab, prompts, values, settings],
  );
  // The same split the prompt editors offer, on the same shared preference: full screen, wide enough, and
  // the author's own pin. Measured rather than assumed, since the rail keeps its width beside the panel;
  // keyed on the fullscreen flip, which re-parents the panel without a resize the observer would see.
  const [measureRef, width] = useContainerWidth(fullscreen);
  const [splitMode, setSplitMode] = usePromptSplitMode();
  const split = resolveLayout(splitMode, width, true, !!fullscreen) === 'split';
  const canSplit = splitAvailable(width, !!fullscreen);

  // Where the reader is, held as the pane-independent anchor the prompt editors use — so flipping the view
  // lands on the same run rather than at the top, and side by side the two panes travel together. Both
  // views draw one element per run, so the anchor maps between them exactly.
  const viewports = useRef<Record<AnatomyViewMode, HTMLDivElement | null>>({ chips: null, resolved: null });
  const anchor = useRef<ScrollAnchor | null>(null);
  // True while a scroll of ours is in flight, so the event it provokes is not read back as the reader's.
  const applying = useRef(false);
  const release = () => {
    const open = () => { applying.current = false; };
    // rAF alone strands the gate in a tab that is not compositing; the timer is the one that always comes.
    requestAnimationFrame(open);
    setTimeout(open, 50);
  };
  // Read inside the scroll handler, which outlives the render that bound it.
  const splitNow = useRef(split);
  splitNow.current = split;

  /**
   * A pane's scroller arriving or leaving.
   *
   * Everything happens here rather than in an effect because the view bar mounts its new pane in a later
   * commit than the one that switched to it: an effect keyed on the mode runs while this ref is still null,
   * and would silently do nothing. The listener goes on the viewport itself, since a scroll event does not
   * bubble and the Root a handler on `<ScrollArea>` would land on is not the element that moved.
   */
  const unbind = useRef<Record<AnatomyViewMode, (() => void) | null>>({ chips: null, resolved: null });
  const bindViewport = useCallback((m: AnatomyViewMode) => (el: HTMLDivElement | null) => {
    unbind.current[m]?.();
    unbind.current[m] = null;
    viewports.current[m] = el;
    if (!el) return;
    const onScroll = () => {
      if (applying.current) return;
      anchor.current = captureAnchor(el, ANATOMY_RUN_SELECTOR);
      const other = viewports.current[m === 'chips' ? 'resolved' : 'chips'];
      if (!splitNow.current || !anchor.current || !other) return;
      applying.current = true;
      applyAnchor(other, ANATOMY_RUN_SELECTOR, anchor.current);
      release();
    };
    el.addEventListener('scroll', onScroll);
    unbind.current[m] = () => el.removeEventListener('scroll', onScroll);
    // Arriving where the reader already was, which is what makes the flip land on the same run.
    if (!anchor.current) return;
    applying.current = true;
    applyAnchor(el, ANATOMY_RUN_SELECTOR, anchor.current);
    release();
  }, []);
  // Stable per pane, so the ref fires on a real mount rather than on every render.
  const bindChips = useMemo(() => bindViewport('chips'), [bindViewport]);
  const bindResolved = useMemo(() => bindViewport('resolved'), [bindViewport]);

  // Landing on a freshly mounted pane: put it where the reader was. Layout, so it lands before paint.
  //
  // A different prompt is a different document, so it opens at its own top — and the panes it opens in are
  // the ones the last prompt left scrolled, so they are put back rather than merely un-anchored. Both are
  // handled here rather than in an effect of their own: a passive effect would run after this one had
  // already applied the stale position.
  const lastTab = useRef(tab);
  useLayoutEffect(() => {
    applying.current = true;
    const panes = split ? (['chips', 'resolved'] as const) : ([mode] as const);
    if (lastTab.current !== tab) {
      lastTab.current = tab;
      anchor.current = null;
      for (const m of panes) { const el = viewports.current[m]; if (el) el.scrollTop = 0; }
    } else if (anchor.current) {
      for (const m of panes) applyAnchor(viewports.current[m], ANATOMY_RUN_SELECTOR, anchor.current);
    }
    release();
  }, [mode, split, requests, tab]);

  const pane = (paneMode: AnatomyViewMode) => (
    <ScrollArea
      className="flex-1 min-h-0 pr-3"
      viewportRef={paneMode === 'chips' ? bindChips : bindResolved}
    >
      {requests.length === 0 ? (
        <p className="text-helper text-muted-foreground">
          Your current settings never send this request, so there is nothing to draw.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {requests.map((request) => (
            <div key={request.key} className="flex flex-col gap-1.5">
              {request.caption && (
                <p className="text-helper text-muted-foreground italic">{request.caption}</p>
              )}
              <RequestAnatomyView
                blocks={request.blocks}
                mode={paneMode}
                type={request.type}
                onJump={onJump}
              />
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );

  return (
    <div ref={measureRef} className="flex flex-1 min-h-0 flex-col">
      {/* A description line like the System editor's, not a toolbar: one sentence, the fuller legend
          behind the ⓘ, and the panel's own controls at the far end. */}
      <div className="mb-2 flex flex-shrink-0 items-center gap-1.5">
        <p className="text-helper text-muted-foreground">
          {split
            ? 'Your template on the left, the request it produces on the right — click a chip to open it.'
            : mode === 'chips'
              ? 'Your text, with every blank shown as the chip that fills it — click one to open it.'
              : 'The whole request as the AI receives it. Highlighted text is yours — click it to open its editor.'}
        </p>
        <HintInfo>
          {`${requests.length > 1 ? 'The requests' : 'The request'} this prompt is part of, drawn from an example playthrough under your current settings.\n\n` +
            '- **Chips** shows the request as your template: every value collapses to the chip behind it.\n' +
            '- **Preview** shows the same request resolved, exactly as the AI receives it.\n' +
            '- **Highlighted text** is your own — click it to open the field it comes from.\n' +
            '- **A dashed chip** is a block the app assembled; where another prompt wrote it, clicking opens that prompt.\n' +
            '- **A message that is missing** is one your settings never send.'}
        </HintInfo>
        <div className="ml-auto flex items-center gap-1">
          {canSplit && (
            <button
              type="button"
              onClick={() => setSplitMode(split ? 'tabs' : 'split')}
              title={split ? 'Show one view at a time' : 'Show chips and preview side by side'}
              aria-label={split ? 'Show one view at a time' : 'Show chips and preview side by side'}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {split ? <Square className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
            </button>
          )}
          {onRequestFullscreen && (
            <button
              type="button"
              onClick={onRequestFullscreen}
              title={fullscreen ? 'Exit full screen' : 'View full screen'}
              aria-label={fullscreen ? 'Exit full screen' : 'View full screen'}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
      {/* The prompt editors' own chrome: the description row above, then a full-width two-value bar over
          the pane it switches. Same shape, same place, so the hub and a field read as one surface. */}
      {split ? (
        <div className="flex flex-1 min-h-0 gap-3">
          <div className="flex-1 min-w-0 flex flex-col">{pane('chips')}</div>
          <div className="flex-1 min-w-0 flex flex-col">{pane('resolved')}</div>
        </div>
      ) : (
        <Tabs
          value={mode}
          onValueChange={(v) => onModeChange(v as AnatomyViewMode)}
          className="flex flex-col flex-1 min-h-0"
        >
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            {(Object.keys(MODE_LABELS) as AnatomyViewMode[]).map((m) => (
              <TabsTrigger key={m} value={m}>{MODE_LABELS[m]}</TabsTrigger>
            ))}
          </TabsList>
          {/* One panel per value, so every trigger's `aria-controls` resolves; only the open one has a body. */}
          {(Object.keys(MODE_LABELS) as AnatomyViewMode[]).map((m) => (
            <TabsContent key={m} value={m} className="mt-2 flex-1 min-h-0 data-[state=active]:flex flex-col">
              {mode === m ? pane(m) : null}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
