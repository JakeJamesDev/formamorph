import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import { coverShieldedLayer, ensureShieldedLayer } from '@/components/ui/shielded-layer';
import { useBackStop } from '@/hooks/useBackStop';
import { useDevRoute } from '@/lib/devRouter';
import type { DocsIndex } from '@/lib/docs/docsIndex';
import { loadDocsIndex } from '@/lib/docs/loadDocsIndex';
import { docTargetId, type DocTarget } from '@/lib/docs/docsLinks';
import { opensInHelpWindow, resolveSurface, stepTab, targetRoute, type SurfaceRoute } from '@/lib/surface/surfaceRoute';
import { useRouteLanding } from '@/lib/surface/useLanding';
import { registerDocsOpener } from '@/lib/formaquestion/docsOpener';
import { createGuide } from '@/lib/formaquestion/guide';
import { cn } from '@/lib/utils';
import { wikiPageUrl } from '@/lib/helpTopics';
import { isEdge, type Edge } from '@/lib/formaquestion/tabPlace';
import {
  boxOf, defaultWindow, type MascotSide, isWide, movePieces, readStoredHeadView, readStoredWindow, resizePieces, swapWidth, viewportOf, windowLayout, withBox,
  headHeight, writeStoredHeadView, writeStoredWindow, HEAD_HEIGHT, NARROW_WIDTH, READER_GAP, SHEET_HEAD_HEIGHT, WIDE_WIDTH,
  type StoredWindow, type Viewport, type WindowBox, type WindowChrome,
} from '@/lib/formaquestion/windowBox';
import { chatChrome } from '@/lib/formaquestion/helpSettings';
import type { MenuActions } from './FormaquestionMenu';
import { useIsMobile } from '@/lib/useIsMobile';
import { useMountedRef } from '@/lib/useMountedRef';
import { EdgeTab } from './EdgeTab';
import { FormaquestionFrame } from './FormaquestionFrame';
import { FORMAQUESTION_TABS, openSectionChange, useGuideView, type GuideViewChange } from './formaquestionTabs';
import { asFormaquestionSettingsTab, type FormaquestionSettingsTab } from './formaquestionSettingsTabs';
import { FormaquestionSettings } from './FormaquestionSettings';
import { FormaquestionAiContext } from './FormaquestionAiContext';
import { HELP_CHIP, helpChipVocabulary } from '@/lib/formaquestion/helpChips';
import { composeMascot } from '@/lib/formaquestion/mascot';
import { cropFrame, fitMask, headSize, type MascotSize } from '@/lib/formaquestion/mascotMask';
import { activeMascotRig } from '@/lib/formaquestion/mascotPresets';
import { mascotImageRefs } from '@/lib/formaquestion/mascotRigEdits';
import { MascotPiece } from './MascotPiece';
import { ReaderPiece } from './ReaderPiece';
import { appLoadQuestion, mascotFace, mascotPhase } from './mascotPhase';
import { MinimalChat } from './MinimalChat';
import { DEFAULT_HELP_PROMPTS, HELP_PROMPT_CHIPS } from '@/lib/formaquestion/helpPrompt';
import { GuideBody } from './GuideBody';
import { useHelpAi } from './useHelpAi';
import { setMascotPlacement, useMascotPlacement, useMascotScale } from './useMascotDevice';
import { useHelpChat, type HelpExchange } from './useHelpChat';
import { useHelpSettings } from './useHelpSettings';
import { useSemanticSearch } from './useSemanticSearch';
import { usePointerDrag, type PointerDrag } from './usePointerDrag';
import { PromptCompareDialog } from '@/components/prompt/PromptCompareDialog';

const WINDOW_ID = 'formaquestion-window';

/** The chips of the answer prompt, for the DEV compare view. */
const DEV_COMPARE_VOCABULARY = helpChipVocabulary(HELP_PROMPT_CHIPS.answer);

/** The dialogs the window opens. */
type FormaquestionDialog = 'settings' | 'aiContext';

/** Close animation length in ms. It matches `data-[state=closed]:duration-150` in `WINDOW_MOTION`. */
const CLOSE_MS = 150;

/** Open and close timing. `transition-none` keeps `duration-*` from easing each drag step of `left` and `top`. */
const MOTION = 'transition-none ease-out data-[state=open]:animate-in data-[state=open]:duration-200 data-[state=closed]:animate-out data-[state=closed]:duration-150 data-[state=closed]:ease-in data-[state=closed]:fill-mode-forwards data-[state=closed]:pointer-events-none motion-reduce:!animate-none';

/** The window zooms out of the Help tab and fades in, and goes back the same way. */
const WINDOW_MOTION = `${MOTION} data-[state=open]:fade-in-0 data-[state=open]:zoom-in-75 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-75`;

/** The sheet slides in from the edge that holds the Help tab, and goes back to it. */
const SHEET_MOTION: Record<Edge, string> = {
  right: `${MOTION} data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right`,
  left: `${MOTION} data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left`,
  top: `${MOTION} data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top`,
  bottom: `${MOTION} data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom`,
};

/** A move or corner grip drag: where it started, the chrome and stored window it started on, and the box it gives now. */
interface BoxPress {
  x: number;
  y: number;
  chrome: WindowChrome;
  stored: StoredWindow;
  start: WindowBox;
  latest: WindowBox;
}

/** Opens a docs section in the wiki, in a new browser tab. */
const openInWiki = (id: string) => window.open(wikiPageUrl(id), '_blank', 'noopener,noreferrer');

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The element that holds keyboard focus, or null when nothing does. */
function focusedElement(): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}

/**
 * Formaquestion: the Help tab and the help window, mounted once for the whole app in the shielded layer,
 * so both stay usable above every dialog. The window holds the help conversation, the guide and a search
 * of it. On a mobile-size screen the window is a full-screen sheet in the narrow layout.
 */
export function Formaquestion({ suspended = false, loadIndex = loadDocsIndex }: {
  /** Hides the tab and the window and turns F1 off, while something covers the whole screen. */
  suspended?: boolean;
  loadIndex?: () => Promise<DocsIndex>;
}) {
  const [layer] = useState(ensureShieldedLayer);
  const sheet = useIsMobile();
  const mountedRef = useMountedRef();
  const windowRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const [open, setOpen] = useState(false);
  const [view, changeView] = useGuideView();
  const [stored, setStored] = useState<StoredWindow>(() => readStoredWindow() ?? defaultWindow(viewportOf(window)));
  const [viewport, setViewport] = useState<Viewport>(() => viewportOf(window));
  /** The Mascot base's natural size, once its image has loaded. */
  const [mascotBase, setMascotBase] = useState<MascotSize | null>(null);
  /** The desktop shows the Mascot's head alone. The sheet always does. */
  const [headView, setHeadView] = useState(readStoredHeadView);
  const scale = useMascotScale();
  const placement = useMascotPlacement();
  /** The section the minimal chrome's reader piece shows, or null while it is closed. */
  const [readerId, setReaderId] = useState<string | null>(null);

  // The docs load on the first open, from their own chunk.
  const [index, setIndex] = useState<DocsIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const loading = useRef(false);
  const load = useCallback(() => {
    if (loading.current) return;
    loading.current = true;
    setFailed(false);
    loadIndex().then(
      (loaded) => { if (mountedRef.current) setIndex(loaded); },
      () => {
        loading.current = false;
        if (mountedRef.current) setFailed(true);
      },
    );
  }, [loadIndex, mountedRef]);
  useEffect(() => {
    if (open && !index && !failed) load();
  }, [open, index, failed, load]);
  const guide = useMemo(() => (index ? createGuide(index) : null), [index]);

  // The conversation lives here, so it outlives the window. The AI check runs only while the window is open.
  const [settings, changeSettings] = useHelpSettings();
  const semantic = useSemanticSearch(settings, changeSettings);
  const ai = useHelpAi(open, settings);
  const chat = useHelpChat(index, ai, settings);
  // The app load's first question ends the Initial look, across a remount too.
  const [beforeFirstQuestion, setBeforeFirstQuestion] = useState(() => !appLoadQuestion.asked());
  const sent = chat.exchanges.length > 0;
  useEffect(() => {
    if (!sent) return;
    appLoadQuestion.record();
    setBeforeFirstQuestion(false);
  }, [sent]);
  const phase = mascotPhase(chat.exchanges.at(-1), beforeFirstQuestion);
  // A change of style or of the Mascot switch swaps the chrome in place; the conversation lives above both.
  const chrome = chatChrome(settings);
  const minimal = chrome === 'minimal';
  const box = boxOf(stored, chrome);
  // A swap while open draws in place, with no open animation, until the window closes.
  const [lastChrome, setLastChrome] = useState(chrome);
  const [swapped, setSwapped] = useState(false);
  if (lastChrome !== chrome) {
    setLastChrome(chrome);
    setSwapped(open);
  }
  if (!open && swapped) setSwapped(false);

  // A dialog opened from the window. On the sheet it fills the screen, so it slides over the sheet, which waits under it.
  // On the desktop the window closes while the dialog is open, and opens again when the dialog closes.
  const [dialog, setDialog] = useState<FormaquestionDialog | null>(null);
  const [settingsTab, setSettingsTab] = useState<FormaquestionSettingsTab>('general');
  const covered = sheet && dialog !== null;
  // Before paint, so the dialog's first frame already draws above the sheet.
  useLayoutEffect(() => {
    if (!covered) return;
    coverShieldedLayer(true);
    return () => coverShieldedLayer(false);
  }, [covered]);
  // Set while the window waits behind a dialog, with the element focus goes back to when the window closes.
  const reopen = useRef<{ focus: HTMLElement | null } | null>(null);

  // The layout fits the stored window to the screen as drawn, so a resize leaves the stored window unchanged.
  useEffect(() => {
    const onResize = () => setViewport(viewportOf(window));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // On the sheet, focus stops at the sheet: a text field would open the on-screen keyboard.
  const focusWindow = useCallback(() => {
    const root = windowRef.current;
    ((sheet ? null : root?.querySelector<HTMLElement>('[data-fq-autofocus]')) ?? root)?.focus();
  }, [sheet]);

  // The window grows out of the Help tab and shrinks back into it. The sheet slides from the tab's edge.
  const [origin, setOrigin] = useState<{ x: number; y: number; edge: Edge } | null>(null);
  const still = (motion: string) => (swapped ? 'transition-none' : motion);
  const windowMotion = still(WINDOW_MOTION);
  const sheetMotion = still(SHEET_MOTION[origin?.edge ?? 'right']);
  /** The zoom's fixed point, the Help tab, from a box's top left corner. */
  const originFrom = (x: number, y: number) => (origin ? `${origin.x - x}px ${origin.y - y}px` : undefined);
  const aimAtTab = useCallback(() => {
    const tab = layer.querySelector<HTMLElement>('[data-fq-launcher]');
    const rect = tab?.getBoundingClientRect();
    const edge = isEdge(tab?.dataset.fqEdge) ? tab.dataset.fqEdge : 'right';
    setOrigin(rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, edge } : null);
  }, [layer]);

  const openWindow = useCallback(() => {
    returnFocusRef.current = focusedElement();
    aimAtTab();
    setOpen(true);
  }, [aimAtTab]);

  const closeWindow = useCallback(() => {
    aimAtTab();
    setOpen(false);
  }, [aimAtTab]);

  const openDialog = useCallback((kind: FormaquestionDialog) => {
    setDialog(kind);
    if (sheet || !open) return;
    reopen.current = { focus: returnFocusRef.current };
    closeWindow();
  }, [sheet, open, closeWindow]);
  const closeDialog = useCallback(() => {
    setDialog(null);
    const waiting = reopen.current;
    reopen.current = null;
    if (!waiting) return;
    returnFocusRef.current = waiting.focus;
    aimAtTab();
    setOpen(true);
  }, [aimAtTab]);

  // A "Learn more" link or a notice asks for a docs heading. The window opens now and shows it once the
  // docs have loaded. While nothing is registered, those links go to the wiki.
  const [target, setTarget] = useState<DocTarget | null>(null);
  useEffect(() => {
    if (suspended) return;
    return registerDocsOpener((next) => {
      if (!open) openWindow();
      // The sheet's minimal chrome has no reader piece, so the heading opens in the wiki.
      if (minimal && sheet) openInWiki(docTargetId(next));
      else setTarget(next);
    });
  }, [suspended, open, openWindow, minimal, sheet]);

  // The Android back action closes the window before any dialog under it.
  useBackStop(open && !suspended && !covered ? closeWindow : undefined, windowRef);

  // The window stays mounted while its close animation runs. `present` drops when the animation ends.
  const [present, setPresent] = useState(false);
  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    if (!present) return;
    if (suspended || reducedMotion()) {
      setPresent(false);
      return;
    }
    // A hidden browser tab does not finish animations, so the end event has a timed backstop.
    const backstop = window.setTimeout(() => setPresent(false), CLOSE_MS + 150);
    return () => window.clearTimeout(backstop);
  }, [open, present, suspended]);

  const shown = (open || present) && !suspended;

  // Focus moves in on open and back on close, after the commit that shows the Help tab again.
  const wasOpen = useRef(false);
  useLayoutEffect(() => {
    if (open && !wasOpen.current && !suspended) focusWindow();
    if (!open && wasOpen.current) {
      const back = returnFocusRef.current;
      returnFocusRef.current = null;
      if (back?.isConnected) back.focus();
    }
    wasOpen.current = open;
  }, [open, suspended, focusWindow]);

  // A chrome swap removes the focused ⋮ button, so focus moves into the new chrome.
  const focusChrome = useRef(chrome);
  useLayoutEffect(() => {
    if (focusChrome.current === chrome) return;
    focusChrome.current = chrome;
    if (open && !focusedElement()) focusWindow();
  }, [chrome, open, focusWindow]);

  // A press in the window can remove the control it was on: a result row, a contents row, a link.
  // Focus then stays in the window, on its frame, so the next F1 closes it.
  const hadFocus = useRef(false);
  const changeViewInWindow = useCallback((change: GuideViewChange) => {
    hadFocus.current = !!windowRef.current?.contains(document.activeElement);
    changeView(change);
  }, [changeView]);
  useEffect(() => {
    if (!hadFocus.current) return;
    // A tab panel leaves the DOM one commit after the change, so the check waits for the next frame.
    const frame = requestAnimationFrame(() => {
      hadFocus.current = false;
      if (!windowRef.current?.contains(document.activeElement)) windowRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [view]);

  // Take Me There. The window opens its own surfaces; any other goes to the app, and the sheet steps aside (Q24, Q30).
  const { requestSurface } = ai;
  // A target the surface registers lands once its tab has mounted; one that is not on screen lands nothing.
  const land = useRouteLanding();
  const go = useCallback((route: SurfaceRoute) => {
    const steps = resolveSurface(route.id, route.target);
    if (!steps) return;
    const target = targetRoute(steps);
    if (!opensInHelpWindow(steps)) {
      requestSurface(route);
      if (sheet) closeWindow();
      return;
    }
    if (steps.dialog === 'formaquestionSettings') {
      setSettingsTab(asFormaquestionSettingsTab(stepTab(steps, 'formaquestionSettings')) ?? 'general');
      openDialog('settings');
    } else if (steps.dialog === 'formaquestionAiContext') {
      openDialog('aiContext');
    } else {
      const tab = stepTab(steps, 'formaquestion');
      if (tab) changeViewInWindow({ tab });
    }
    if (target) land(target);
  }, [requestSurface, sheet, closeWindow, openDialog, changeViewInWindow, land]);

  // A failed load drops the request, so a later Try Again does not jump the view.
  useEffect(() => {
    if (failed) setTarget(null);
  }, [failed]);
  useEffect(() => {
    if (!target || !guide) return;
    const sectionId = guide.resolve('', docTargetId(target));
    setTarget(null);
    // The coverage test keeps this case from shipping. The wiki is the way out if it ever does.
    if (!sectionId) {
      window.open(wikiPageUrl(docTargetId(target)), '_blank', 'noopener,noreferrer');
      return;
    }
    if (minimal) setReaderId(sectionId);
    else changeViewInWindow(openSectionChange(sectionId, guide.section(sectionId)?.page));
  }, [target, guide, changeViewInWindow, minimal]);

  // The docs can load after the window opens. Focus then goes from the frame to the window's first field, except on the sheet.
  useEffect(() => {
    if (guide && document.activeElement === windowRef.current) focusWindow();
  }, [guide, focusWindow]);

  // F1 opens the window, then moves focus in when focus is elsewhere, then closes it.
  useEffect(() => {
    if (suspended) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'F1' || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      // A held key repeats. One press is one step.
      if (event.repeat) return;
      if (!open) openWindow();
      else if (!windowRef.current?.contains(document.activeElement)) {
        returnFocusRef.current = focusedElement() ?? returnFocusRef.current;
        focusWindow();
      } else closeWindow();
    };
    // Capture: a prompt field stops keydown from bubbling.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [suspended, open, openWindow, closeWindow, focusWindow]);

  // DEV: `#dev?modal=formaquestion&tab=guide&subtab=<section id>&mode=wide` opens the window in one jump.
  // `#dev?modal=formaquestionSettings&tab=general` opens the window and its settings.
  const devRoute = useDevRoute();
  useEffect(() => {
    if (!import.meta.env.DEV || devRoute?.modal !== 'formaquestionSettings') return;
    setOpen(true);
    setSettingsTab(asFormaquestionSettingsTab(devRoute.tab) ?? 'general');
    setDialog('settings');
  }, [devRoute]);
  // `#dev?modal=formaquestionCompare` opens the settings and the compare view on a canned custom answer prompt.
  const [devCompare, setDevCompare] = useState(false);
  useEffect(() => {
    if (!import.meta.env.DEV || devRoute?.modal !== 'formaquestionCompare') return;
    setOpen(true);
    setSettingsTab('prompts');
    setDialog('settings');
    setDevCompare(true);
  }, [devRoute]);
  // `#dev?modal=formaquestionAiContext` opens the window and AI Context on two canned questions with traces.
  // The sample loads on demand, so it stays out of the shipped bundle.
  const [devTrace, setDevTrace] = useState<HelpExchange[] | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV || devRoute?.modal !== 'formaquestionAiContext' || !index) return;
    setOpen(true);
    setDialog('aiContext');
    void import('@/lib/devHelpTraceSample').then(({ devHelpTraceSample }) => { if (mountedRef.current) setDevTrace([devHelpTraceSample(index), devHelpTraceSample(index, 'And how do I remove one?', 'dev-trace-2')]); });
  }, [devRoute, index, mountedRef]);
  const tracedExchanges = devTrace ?? chat.exchanges;
  useEffect(() => {
    if (!import.meta.env.DEV || devRoute?.modal !== 'formaquestion') return;
    setOpen(true);
    const tab = FORMAQUESTION_TABS.find((entry) => entry.value === devRoute.tab)?.value;
    if (devRoute.subtab) changeView({ sectionId: devRoute.subtab, tab: 'guide', reading: true });
    else if (tab) changeView({ tab });
    if (devRoute.mode === 'wide' || devRoute.mode === 'narrow') {
      const w = devRoute.mode === 'wide' ? WIDE_WIDTH : NARROW_WIDTH;
      setStored((current) => (isWide(boxOf(current, 'full')) === (devRoute.mode === 'wide') ? current : { ...current, full: { ...current.full, w } }));
    }
  }, [devRoute, changeView]);

  // Only the whole Mascot widens the box; under Full it ignores the head view, and the sheet draws none (Q25, Q26).
  const readerShown = guide !== null && readerId !== null;
  const showHead = sheet || headView;
  const mascotAspect = settings.mascot && mascotBase && !(minimal && showHead) ? mascotBase.width / mascotBase.height : null;
  // The side flips once as the column crosses the middle; the last side decides a tie.
  const sideRef = useRef<MascotSide>('left');
  const pieces = { mascotAspect, showReader: readerShown, side: sideRef.current, scale, baseHeight: mascotBase?.height, placement };
  const layout = sheet ? null : windowLayout(chrome, box, viewport, pieces);
  if (layout) sideRef.current = layout.side;
  const side = layout?.side ?? 'left';
  const below = layout?.placement === 'below';
  // Below, she centers under the column; beside, she takes the side the reader leaves.
  const mascotSide = below ? null : side;
  const readerSide = layout?.readerSide ?? 'right';
  // Picking Below clamps the column to the cap at once and keeps that height (Q9).
  const shownPlacement = useRef(placement);
  const drawnPlacement = layout?.placement;
  const drawnHeight = layout?.column.h;
  useEffect(() => {
    if (shownPlacement.current === placement) return;
    shownPlacement.current = placement;
    const kept = boxOf(stored, chrome);
    if (drawnPlacement !== 'below' || drawnHeight === undefined || drawnHeight === kept.h) return;
    const next = withBox(stored, chrome, { ...kept, h: drawnHeight });
    setStored(next);
    writeStoredWindow(next);
  }, [placement, drawnPlacement, drawnHeight, stored, chrome]);
  // A drag starts from the box as drawn, which a small screen can shift.
  const drawn = layout?.column ?? box;
  const boxDrag = (step: typeof movePieces): PointerDrag<BoxPress> => ({
    start: (event) => (event.button !== 0 || (event.target as HTMLElement).closest('button')
      ? null
      : { x: event.clientX, y: event.clientY, chrome, stored, start: drawn, latest: drawn }),
    move: (press, event) => {
      press.latest = step(press.chrome, press.start, event.clientX - press.x, event.clientY - press.y, viewportOf(window), pieces);
      setStored(withBox(press.stored, press.chrome, press.latest));
    },
    // The device keeps the place and the chrome's size the player left the window at.
    end: (press) => writeStoredWindow(withBox(press.stored, press.chrome, press.latest)),
  });
  const moveHandlers = usePointerDrag(boxDrag(movePieces));
  const resizeHandlers = usePointerDrag(boxDrag(resizePieces));
  const wide = !sheet && isWide(drawn);
  const swap = () => {
    const toggled = swapWidth(drawn, viewportOf(window));
    const next = withBox(stored, chrome, windowLayout(chrome, toggled, viewportOf(window), pieces).column);
    setStored(next);
    writeStoredWindow(next);
  };
  const toggleHead = () => {
    setHeadView(!headView);
    writeStoredHeadView(!headView);
  };

  const rig = activeMascotRig(settings.mascotPresets);
  const mascotImages = composeMascot(rig, phase, mascotFace(chat.exchanges.at(-1)));
  const crop = mascotBase && fitMask(rig.mask, mascotBase);
  const menuActions: MenuActions = {
    onOpenAiContext: () => openDialog('aiContext'),
    onOpenSettings: () => openDialog('settings'),
    onClear: chat.exchanges.length > 0 ? chat.clear : undefined,
    chatStyle: settings.chatStyle,
    onChatStyleChange: (chatStyle) => changeSettings({ chatStyle }),
    ...(sheet ? {} : { mascotPlacement: placement, onMascotPlacementChange: setMascotPlacement }),
  };

  const wholeMascot = layout && settings.mascot && !(minimal && showHead) && (
    <MascotPiece images={mascotImages} hold={mascotImageRefs(rig)} transition={rig.transition} size={layout.mascot} onBase={setMascotBase} />
  );
  const readerPiece = layout?.reader && guide && readerId && (
    <ReaderPiece guide={guide} sectionId={readerId} size={layout.reader} onOpen={setReaderId} onClose={() => setReaderId(null)} />
  );
  // Below, the column's row holds the reader too.
  const readerSpace = layout?.reader ? READER_GAP + layout.reader.w : 0;
  const head = minimal && settings.mascot && showHead && (
    <MascotPiece
      view="head"
      images={mascotImages}
      hold={mascotImageRefs(rig)}
      transition={rig.transition}
      size={crop && headSize(crop, sheet ? SHEET_HEAD_HEIGHT : headHeight(scale, crop.height, layout?.column.h ?? HEAD_HEIGHT))}
      frame={crop && mascotBase ? cropFrame(crop, mascotBase) : undefined}
      onBase={setMascotBase}
    />
  );

  const chatColumn = (
    <MinimalChat
      guide={guide}
      failed={failed}
      onRetry={load}
      chat={chat}
      settings={settings}
      onSettingsChange={changeSettings}
      draft={view.draft}
      onDraftChange={(draft) => changeView({ draft })}
      onOpen={sheet ? openInWiki : setReaderId}
      onGo={go}
      move={sheet ? undefined : moveHandlers}
      resize={sheet ? undefined : resizeHandlers}
      large={sheet}
      head={head}
      headSide={side}
      headToggle={sheet || !settings.mascot ? undefined : { showingHead: headView, onToggle: toggleHead }}
      menu={{ ...menuActions, container: layer }}
      onClose={closeWindow}
      height={layout?.column.h}
    />
  );

  return createPortal(
    <>
      {!suspended && (
        <EdgeTab open={open} concealed={sheet && open} controls={WINDOW_ID} onToggle={() => (open ? closeWindow() : openWindow())} />
      )}
      {shown && minimal && (
        <section
          ref={windowRef}
          id={WINDOW_ID}
          role="dialog"
          aria-modal="false"
          aria-label="Formaquestion"
          tabIndex={-1}
          data-state={open ? 'open' : 'closed'}
          data-fq-chrome="minimal"
          data-fq-sheet={sheet ? '' : undefined}
          onAnimationEnd={(event) => { if (!open && event.target === event.currentTarget) setPresent(false); }}
          className={cn(
            'flex text-foreground outline-none',
            sheet
              // On the sheet a dim, blurred backdrop stands in for the frame, because the bubbles fill the screen.
              ? cn('app-viewport pointer-events-auto bg-background/80 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm', sheetMotion)
              // Only the pieces take presses; the gaps between them belong to the app.
              : `pointer-events-none fixed ${below ? 'flex-col' : 'items-end'} ${windowMotion}`,
          )}
          style={layout ? {
            left: layout.group.x,
            top: layout.group.y,
            width: layout.group.w,
            height: layout.group.h,
            transformOrigin: originFrom(layout.group.x, layout.group.y),
          } : undefined}
        >
          {layout && below ? (
            <>
              <div
                className="flex shrink-0 items-end"
                style={{
                  marginLeft: layout.column.x - (readerSide === 'left' ? readerSpace : 0) - layout.group.x,
                  width: layout.column.w + readerSpace,
                  height: layout.column.h,
                }}
              >
                {readerSide === 'left' && readerPiece}
                {chatColumn}
                {readerSide === 'right' && readerPiece}
              </div>
              <div className="mt-auto flex" style={{ marginLeft: (layout.mascotAt?.x ?? 0) - layout.group.x }}>{wholeMascot}</div>
            </>
          ) : (
            <>
              {mascotSide === 'left' && wholeMascot}
              {readerSide === 'left' && readerPiece}
              {chatColumn}
              {readerSide === 'right' && readerPiece}
              {mascotSide === 'right' && wholeMascot}
            </>
          )}
        </section>
      )}
      {shown && !minimal && layout && wholeMascot && (
        <div
          data-state={open ? 'open' : 'closed'}
          className={`pointer-events-none fixed flex items-end ${windowMotion}`}
          style={below && layout.mascot && layout.mascotAt ? {
            left: layout.mascotAt.x,
            top: layout.mascotAt.y,
            width: layout.mascot.w,
            height: layout.mascot.h,
            transformOrigin: originFrom(layout.mascotAt.x, layout.mascotAt.y),
          } : {
            left: side === 'left' ? layout.group.x : layout.column.x + layout.column.w,
            top: layout.group.y,
            width: layout.group.w - layout.column.w,
            height: layout.group.h,
            transformOrigin: originFrom(layout.group.x, layout.group.y),
          }}
        >
          {wholeMascot}
        </div>
      )}
      {shown && !minimal && (
        <FormaquestionFrame
          ref={windowRef}
          id={WINDOW_ID}
          data-state={open ? 'open' : 'closed'}
          data-fq-sheet={sheet ? '' : undefined}
          onAnimationEnd={(event) => { if (!open && event.target === event.currentTarget) setPresent(false); }}
          sheet={sheet}
          menu={menuActions}
          menuContainer={layer}
          onClose={closeWindow}
          {...(sheet ? {
            className: cn('app-viewport pointer-events-auto', sheetMotion),
          } : {
            wide,
            onSwapWidth: swap,
            move: moveHandlers,
            resize: resizeHandlers,
            className: `pointer-events-auto fixed ${windowMotion}`,
            style: {
              left: drawn.x,
              top: drawn.y,
              width: drawn.w,
              height: drawn.h,
              transformOrigin: originFrom(drawn.x, drawn.y),
            },
          })}
        >
          <GuideBody guide={guide} failed={failed} onRetry={load} view={view} onViewChange={changeViewInWindow} wide={wide} chat={chat} settings={settings} onSettingsChange={changeSettings} onGo={go} />
        </FormaquestionFrame>
      )}
      <FormaquestionSettings
        open={dialog === 'settings' && !suspended}
        onOpenChange={(next) => (next ? setDialog('settings') : closeDialog())}
        tab={settingsTab}
        onTabChange={setSettingsTab}
        settings={settings}
        onChange={changeSettings}
        semantic={semantic}
        answerTarget={ai.answerTarget}
      />
      <FormaquestionAiContext
        open={dialog === 'aiContext' && !suspended}
        onOpenChange={(next) => (next ? setDialog('aiContext') : closeDialog())}
        exchanges={tracedExchanges}
      />
      {import.meta.env.DEV && (
        <PromptCompareDialog
          open={devCompare}
          onOpenChange={setDevCompare}
          name="Answer Prompt"
          defaultText={DEFAULT_HELP_PROMPTS.answer}
          text={`Be brief.
${DEFAULT_HELP_PROMPTS.answer.replace(HELP_CHIP.marker, '')}`}
          vocabulary={DEV_COMPARE_VOCABULARY}
          surface="formaquestionCompare"
        />
      )}
    </>,
    layer,
  );
}
