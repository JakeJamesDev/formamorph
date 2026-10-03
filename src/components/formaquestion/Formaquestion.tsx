import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ensureShieldedLayer } from '@/components/ui/shielded-layer';
import { useBackStop } from '@/hooks/useBackStop';
import { useDevRoute } from '@/lib/devRouter';
import type { DocsIndex } from '@/lib/docs/docsIndex';
import { loadDocsIndex } from '@/lib/docs/loadDocsIndex';
import { docTargetId, type DocTarget } from '@/lib/docs/docsLinks';
import { registerDocsOpener } from '@/lib/formaquestion/docsOpener';
import { createGuide } from '@/lib/formaquestion/guide';
import { cn } from '@/lib/utils';
import { wikiPageUrl } from '@/lib/helpTopics';
import { isEdge, type Edge } from '@/lib/formaquestion/tabPlace';
import {
  clampBox, defaultBox, isWide, moveBox, readStoredBox, resizeBox, swapWidth, viewportOf, writeStoredBox,
  NARROW_WIDTH, WIDE_WIDTH, type WindowBox,
} from '@/lib/formaquestion/windowBox';
import { MOBILE_BREAKPOINT, useIsMobile } from '@/lib/useIsMobile';
import { useMountedRef } from '@/lib/useMountedRef';
import { EdgeTab } from './EdgeTab';
import { FormaquestionFrame } from './FormaquestionFrame';
import { FORMAQUESTION_TABS, openSectionChange, useGuideView, type GuideViewChange } from './formaquestionTabs';
import { asFormaquestionSettingsTab, type FormaquestionSettingsTab } from './formaquestionSettingsTabs';
import { FormaquestionSettings } from './FormaquestionSettings';
import { GuideBody } from './GuideBody';
import { useHelpAi } from './useHelpAi';
import { useHelpChat } from './useHelpChat';
import { useHelpSettings } from './useHelpSettings';
import { useSemanticSearch } from './useSemanticSearch';
import { usePointerDrag, type PointerDrag } from './usePointerDrag';

const WINDOW_ID = 'formaquestion-window';

/** The dialogs the window opens. */
type FormaquestionDialog = 'settings';

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

/** A title bar or corner grip drag: where it started, and the box it gives now. */
interface BoxPress {
  x: number;
  y: number;
  start: WindowBox;
  latest: WindowBox;
}

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
  const [box, setBox] = useState<WindowBox>(() => readStoredBox(viewportOf(window)) ?? defaultBox(viewportOf(window)));

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
  const chat = useHelpChat(index, useHelpAi(open), settings);

  // A dialog opened from the window. On the sheet it fills the screen, so the sheet hides under it and keeps its state.
  const [dialog, setDialog] = useState<FormaquestionDialog | null>(null);
  const [settingsTab, setSettingsTab] = useState<FormaquestionSettingsTab>('general');
  const covered = sheet && dialog !== null;

  // A resize keeps the window on the screen. At a mobile width the sheet shows and the box waits unchanged.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= MOBILE_BREAKPOINT) setBox((current) => clampBox(current, viewportOf(window)));
    };
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

  // A "Learn more" link or a notice asks for a docs heading. The window opens now and shows it once the
  // docs have loaded. While nothing is registered, those links go to the wiki.
  const [target, setTarget] = useState<DocTarget | null>(null);
  useEffect(() => {
    if (suspended) return;
    return registerDocsOpener((next) => {
      if (!open) openWindow();
      setTarget(next);
    });
  }, [suspended, open, openWindow]);

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
    changeViewInWindow(openSectionChange(sectionId, guide.section(sectionId)?.page));
  }, [target, guide, changeViewInWindow]);

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
  useEffect(() => {
    if (!import.meta.env.DEV || devRoute?.modal !== 'formaquestion') return;
    setOpen(true);
    const tab = FORMAQUESTION_TABS.find((entry) => entry.value === devRoute.tab)?.value;
    if (devRoute.subtab) changeView({ sectionId: devRoute.subtab, tab: 'guide', reading: true });
    else if (tab) changeView({ tab });
    if (devRoute.mode === 'wide' || devRoute.mode === 'narrow') {
      const w = devRoute.mode === 'wide' ? WIDE_WIDTH : NARROW_WIDTH;
      setBox((current) => (isWide(current) === (devRoute.mode === 'wide') ? current : clampBox({ ...current, w }, viewportOf(window))));
    }
  }, [devRoute, changeView]);

  const boxDrag = (step: typeof moveBox): PointerDrag<BoxPress> => ({
    start: (event) => (event.button !== 0 || (event.target as HTMLElement).closest('button')
      ? null
      : { x: event.clientX, y: event.clientY, start: box, latest: box }),
    move: (press, event) => {
      press.latest = step(press.start, event.clientX - press.x, event.clientY - press.y, viewportOf(window));
      setBox(press.latest);
    },
    // The device keeps the place and size the player left the window at.
    end: (press) => writeStoredBox(press.latest),
  });
  const moveHandlers = usePointerDrag(boxDrag(moveBox));
  const resizeHandlers = usePointerDrag(boxDrag(resizeBox));
  const wide = !sheet && isWide(box);
  const swap = () => {
    const next = swapWidth(box, viewportOf(window));
    setBox(next);
    writeStoredBox(next);
  };

  return createPortal(
    <>
      {!suspended && (
        <EdgeTab open={open} concealed={sheet && open} controls={WINDOW_ID} onToggle={() => (open ? closeWindow() : openWindow())} />
      )}
      {shown && (
        <FormaquestionFrame
          ref={windowRef}
          id={WINDOW_ID}
          data-state={open ? 'open' : 'closed'}
          data-fq-sheet={sheet ? '' : undefined}
          onAnimationEnd={(event) => { if (!open && event.target === event.currentTarget) setPresent(false); }}
          sheet={sheet}
          onOpenSettings={() => setDialog('settings')}
          onClose={closeWindow}
          {...(sheet ? {
            className: cn('app-viewport pointer-events-auto', SHEET_MOTION[origin?.edge ?? 'right'], covered && 'invisible'),
          } : {
            wide,
            onSwapWidth: swap,
            move: moveHandlers,
            resize: resizeHandlers,
            className: `pointer-events-auto fixed ${WINDOW_MOTION}`,
            style: {
              left: box.x,
              top: box.y,
              width: box.w,
              height: box.h,
              transformOrigin: origin ? `${origin.x - box.x}px ${origin.y - box.y}px` : undefined,
            },
          })}
        >
          <GuideBody guide={guide} failed={failed} onRetry={load} view={view} onViewChange={changeViewInWindow} wide={wide} chat={chat} />
        </FormaquestionFrame>
      )}
      <FormaquestionSettings
        open={dialog === 'settings' && !suspended}
        onOpenChange={(next) => setDialog(next ? 'settings' : null)}
        tab={settingsTab}
        onTabChange={setSettingsTab}
        settings={settings}
        onChange={changeSettings}
        semantic={semantic}
      />
    </>,
    layer,
  );
}
