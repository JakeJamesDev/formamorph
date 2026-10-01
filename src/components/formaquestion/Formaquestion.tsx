import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ensureShieldedLayer } from '@/components/ui/shielded-layer';
import { useBackStop } from '@/hooks/useBackStop';
import { useDevRoute } from '@/lib/devRouter';
import type { DocsIndex } from '@/lib/docs/docsIndex';
import { loadDocsIndex } from '@/lib/docs/loadDocsIndex';
import { registerDocsOpener, type DocsTarget } from '@/lib/formaquestion/docsOpener';
import { createGuide } from '@/lib/formaquestion/guide';
import { wikiPageUrl } from '@/lib/helpTopics';
import type { Edge } from '@/lib/formaquestion/tabPlace';
import {
  clampBox, defaultBox, isWide, moveBox, readStoredBox, resizeBox, swapWidth, viewportOf, writeStoredBox,
  NARROW_WIDTH, WIDE_WIDTH, type WindowBox,
} from '@/lib/formaquestion/windowBox';
import { MOBILE_BREAKPOINT, useIsMobile } from '@/lib/useIsMobile';
import { useMountedRef } from '@/lib/useMountedRef';
import { EdgeTab } from './EdgeTab';
import { FormaquestionFrame } from './FormaquestionFrame';
import { FORMAQUESTION_TABS, useGuideView, type GuideViewChange } from './formaquestionTabs';
import { GuideBody } from './GuideBody';

const WINDOW_ID = 'formaquestion-window';

/** Close animation length in ms. It matches `data-[state=closed]:duration-150` in `WINDOW_MOTION`. */
const CLOSE_MS = 150;

/**
 * Open and close timing for the window and the sheet. The closed state keeps its last frame until React
 * unmounts it, and takes no presses on the way out. Reduced motion shows and hides at once.
 *
 * `transition-none` is load-bearing: `duration-*` also sets the transition duration, and with no property
 * named a transition covers `left` and `top`, so every drag step would ease and the window would trail
 * the pointer.
 */
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

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The element that holds keyboard focus, or null when nothing does. */
function focusedElement(): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}

/**
 * Formaquestion: the Help tab and the help window, mounted once for the whole app in the shielded layer,
 * so both stay usable above every dialog. The window holds the guide and a search of it. On a mobile-size
 * screen the window is a full-screen sheet in the narrow layout.
 */
export function Formaquestion({ suspended = false, loadIndex = loadDocsIndex }: {
  /** Hides the tab and the window and turns F1 off, while something covers the whole screen. */
  suspended?: boolean;
  loadIndex?: () => Promise<DocsIndex>;
}) {
  const [layer] = useState(ensureShieldedLayer);
  const sheet = useIsMobile();
  const hidden = suspended;
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

  // The window stays inside the screen after a browser resize. At a mobile width it does not show, so
  // it keeps its place and size for when the screen is wide again.
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
    const edge = (tab?.dataset.fqEdge ?? 'right') as Edge;
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
  const [target, setTarget] = useState<DocsTarget | null>(null);
  useEffect(() => {
    if (hidden) return;
    return registerDocsOpener((next) => {
      if (!open) openWindow();
      setTarget(next);
    });
  }, [hidden, open, openWindow]);

  // The Android back action closes the window before any dialog under it.
  useBackStop(open && !hidden ? closeWindow : undefined, windowRef);

  // The window stays mounted while its close animation runs. `present` drops when the animation ends.
  const [present, setPresent] = useState(false);
  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    if (!present) return;
    if (hidden || reducedMotion()) {
      setPresent(false);
      return;
    }
    // A hidden browser tab does not finish animations, so the end event has a timed backstop.
    const backstop = window.setTimeout(() => setPresent(false), CLOSE_MS + 150);
    return () => window.clearTimeout(backstop);
  }, [open, present, hidden]);

  const shown = (open || present) && !hidden;

  // Focus moves into the window when it opens, and back where it was when it closes. A window that shows
  // again after it was hidden leaves focus where the player has it. The return waits for the commit,
  // because the Help tab under the sheet shows again only then.
  const wasOpen = useRef(false);
  useLayoutEffect(() => {
    if (open && !wasOpen.current && !hidden) focusWindow();
    if (!open && wasOpen.current) {
      const back = returnFocusRef.current;
      returnFocusRef.current = null;
      if (back?.isConnected) back.focus();
    }
    wasOpen.current = open;
  }, [open, hidden, focusWindow]);

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
    const sectionId = guide.resolve('', target.anchor ? `${target.page}#${target.anchor}` : target.page);
    setTarget(null);
    // The coverage test keeps this case from shipping. The wiki is the way out if it ever does.
    if (!sectionId) {
      window.open(wikiPageUrl(target.page) + (target.anchor ? `#${target.anchor}` : ''), '_blank', 'noopener,noreferrer');
      return;
    }
    changeViewInWindow((current) => {
      const page = guide.section(sectionId)?.page;
      const openPages = page === undefined || current.openPages.includes(page) ? current.openPages : [...current.openPages, page];
      return { sectionId, tab: 'guide', reading: true, openPages };
    });
  }, [target, guide, changeViewInWindow]);

  // The docs can load after the window opens. Focus then goes from the frame to the search field.
  useEffect(() => {
    if (guide && document.activeElement === windowRef.current) focusWindow();
  }, [guide, focusWindow]);

  // F1 opens the window, then moves focus in when focus is elsewhere, then closes it.
  useEffect(() => {
    if (hidden) return;
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
  }, [hidden, open, openWindow, closeWindow, focusWindow]);

  // DEV: `#dev?modal=formaquestion&tab=guide&subtab=<section id>&mode=wide` opens the window in one jump.
  const devRoute = useDevRoute();
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

  const drag = useRef<{ kind: 'move' | 'resize'; x: number; y: number; start: WindowBox; latest: WindowBox } | null>(null);
  // The device keeps the place and size the player left the window at.
  const endDrag = () => {
    if (drag.current) writeStoredBox(drag.current.latest);
    drag.current = null;
  };
  const dragHandlers = (kind: 'move' | 'resize') => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { kind, x: event.clientX, y: event.clientY, start: box, latest: box };
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const current = drag.current;
      if (!current) return;
      const step = current.kind === 'move' ? moveBox : resizeBox;
      current.latest = step(current.start, event.clientX - current.x, event.clientY - current.y, viewportOf(window));
      setBox(current.latest);
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  });
  const wide = !sheet && isWide(box);
  const swap = () => {
    const next = swapWidth(box, viewportOf(window));
    setBox(next);
    writeStoredBox(next);
  };

  return createPortal(
    <>
      {!hidden && (
        <EdgeTab open={open} concealed={sheet && open} controls={WINDOW_ID} onToggle={() => (open ? closeWindow() : openWindow())} />
      )}
      {shown && (
        <FormaquestionFrame
          ref={windowRef}
          id={WINDOW_ID}
          data-state={open ? 'open' : 'closed'}
          data-fq-sheet={sheet ? '' : undefined}
          onAnimationEnd={(event) => { if (!open && event.target === event.currentTarget) setPresent(false); }}
          wide={wide}
          onSwapWidth={swap}
          sheet={sheet}
          onClose={closeWindow}
          {...(sheet ? {
            className: `app-viewport pointer-events-auto ${SHEET_MOTION[origin?.edge ?? 'right']}`,
          } : {
            move: dragHandlers('move'),
            resize: dragHandlers('resize'),
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
          <GuideBody guide={guide} failed={failed} onRetry={load} view={view} onViewChange={changeViewInWindow} wide={wide} />
        </FormaquestionFrame>
      )}
    </>,
    layer,
  );
}
