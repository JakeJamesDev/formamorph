import * as React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { useMountedRef } from '@/lib/useMountedRef';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

const SLOP = 10; // px a touch moves before it picks an axis
const COMMIT_SHARE = 0.25; // of the stage width
const FLICK_SPEED = 0.4; // px per ms
const EDGE_GIVE = 0.3; // how far the panel follows past the first or last tab
const SETTLE_MS = 300;
const EASE = 'cubic-bezier(0.2, 0, 0, 1)';
// Targets that keep a sideways drag for themselves.
const OWN_DRAG = 'input, textarea, select, canvas, [contenteditable="true"], [role="slider"], [data-no-swipe]';

type Gesture = { id: number; x0: number; y0: number; axis: 'x' | 'y' | null; dx: number; lastX: number; lastT: number; speed: number };

const scrollsSideways = (from: Element, stop: Element) => {
  for (let el: Element | null = from; el && el !== stop; el = el.parentElement) {
    const { overflowX } = getComputedStyle(el);
    if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) return true;
  }
  return false;
};

/**
 * The mobile game view's panels, one per tab of the enclosing `Tabs`. A tab change slides them across, and a
 * touch drag moves them under the finger: drag left for the tab to the right, right for the tab to the left.
 */
export function MobilePanelStage<V extends string>({ tabs, value, onValueChange, renderPanel }: {
  tabs: readonly { value: V }[];
  value: V;
  onValueChange: (value: V) => void;
  renderPanel: (value: V) => React.ReactNode;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const mounted = useMountedRef();
  const stageRef = React.useRef<HTMLDivElement>(null);
  const gesture = React.useRef<Gesture | null>(null);
  // The neighbor shown beside the dragged panel, and panels whose drag hold lifts once they hide.
  const [peek, setPeek] = React.useState<V | null>(null);
  const peekRef = React.useRef<V | null>(null);
  const parked = React.useRef(new Set<HTMLElement>());

  const order = (v: V) => tabs.findIndex((tab) => tab.value === v);
  const [slide, setSlide] = React.useState<'next' | 'back'>('next');
  const [shown, setShown] = React.useState(value);
  if (shown !== value) {
    setSlide(order(value) > order(shown) ? 'next' : 'back');
    setShown(value);
  }

  const panel = (v: V | null) => (v === null ? null : stageRef.current?.querySelector<HTMLElement>(`[data-panel="${v}"]`) ?? null);
  const neighbor = (dx: number) => tabs[order(value) + (dx < 0 ? 1 : -1)]?.value ?? null;
  const width = () => stageRef.current?.clientWidth ?? 0;
  // Where a neighbor sits beside a panel dragged by `dx`.
  const besideAt = (dx: number) => dx + (dx < 0 ? width() : -width());

  const showPeek = (next: V | null) => {
    if (next === peekRef.current) return;
    const old = panel(peekRef.current);
    if (old) { old.style.transform = ''; parked.current.add(old); }
    // A force-mounted inactive panel would run its exit slide; the inline hold keeps it under the finger.
    const el = panel(next);
    if (el) { el.style.animation = 'none'; parked.current.delete(el); }
    peekRef.current = next;
    setPeek(next);
  };

  const place = (dx: number) => {
    const next = peekRef.current;
    const active = panel(value);
    if (active) active.style.transform = `translateX(${next ? dx : dx * EDGE_GIVE}px)`;
    const el = panel(next);
    if (el) el.style.transform = `translateX(${besideAt(dx)}px)`;
  };

  // A neighbor mounts a render after the drag asks for it, so it takes its place here.
  React.useLayoutEffect(() => {
    if (gesture.current?.axis === 'x') place(gesture.current.dx);
    // Presence has unmounted the parked panels by now, so their hold can lift.
    for (const el of parked.current) {
      if (el !== panel(peek)) { el.style.animation = ''; parked.current.delete(el); }
    }
  });

  // A sideways drag keeps the page's scrollers from taking the touch, which would cancel the pointer.
  // React's touch listeners are passive, so this one is native.
  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const hold = (e: TouchEvent) => { if (gesture.current?.axis === 'x' && e.cancelable) e.preventDefault(); };
    stage.addEventListener('touchmove', hold, { passive: false });
    return () => stage.removeEventListener('touchmove', hold);
  }, []);

  const onPointerDown =(e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' || !e.isPrimary || gesture.current || peekRef.current) return;
    const target = e.target as Element;
    // A portaled dialog's touches reach here through the React tree.
    if (!e.currentTarget.contains(target)) return;
    if (target.closest(OWN_DRAG) || scrollsSideways(target, e.currentTarget)) return;
    // A panel still sliding in would jump to the finger.
    const sliding = e.currentTarget.getAnimations?.({ subtree: true })
      .some((a) => (a.effect as KeyframeEffect | null)?.target?.classList.contains('mobile-panel'));
    if (sliding) return;
    gesture.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null, dx: 0, lastX: e.clientX, lastT: performance.now(), speed: 0 };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x0;
    if (g.axis === null) {
      const dy = e.clientY - g.y0;
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      if (Math.abs(dy) >= Math.abs(dx)) { gesture.current = null; return; }
      g.axis = 'x';
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    const now = performance.now();
    const dt = now - g.lastT;
    if (dt > 0) g.speed = (e.clientX - g.lastX) / dt;
    g.lastX = e.clientX;
    g.lastT = now;
    g.dx = dx;
    showPeek(neighbor(dx));
    place(dx);
  };

  const release = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    if (g.axis !== 'x') return;
    const next = peekRef.current;
    const active = panel(value);
    const incoming = panel(next);
    const far = Math.abs(g.dx) > width() * COMMIT_SHARE;
    const flick = Math.abs(g.speed) > FLICK_SPEED && Math.sign(g.speed) === Math.sign(g.dx);
    if (next && incoming && e.type === 'pointerup' && (far || flick)) {
      // Both panels finish the tab change's slide from where the finger left them.
      if (active) { active.style.setProperty('--drag-from', `${g.dx}px`); active.style.transform = ''; }
      incoming.style.setProperty('--drag-from', `${besideAt(g.dx)}px`);
      incoming.style.transform = '';
      incoming.style.animation = '';
      parked.current.delete(incoming);
      peekRef.current = null;
      setPeek(null);
      onValueChange(next);
      return;
    }
    // jsdom has no Web Animations, so a test settles at once.
    const settle = (el: HTMLElement | null, to: number) => (el && typeof el.animate === 'function' && !reducedMotion
      ? el.animate([{ transform: el.style.transform }, { transform: `translateX(${to}px)` }], { duration: SETTLE_MS, easing: EASE, fill: 'forwards' })
      : null);
    const runs = [settle(active, 0), settle(incoming, besideAt(g.dx))];
    // Set before the panels reach home, so a new touch waits for them.
    peekRef.current = null;
    void Promise.all(runs.map((run) => run?.finished)).then(() => {
      if (active) active.style.transform = '';
      if (incoming) { incoming.style.transform = ''; parked.current.add(incoming); }
      runs.forEach((run) => run?.cancel());
      if (mounted.current) setPeek(null);
    }, () => {});
  };

  return (
    <div
      ref={stageRef}
      data-slide={slide}
      className="mobile-panel-stage relative flex-grow min-h-0 overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      onPointerCancel={release}
      onAnimationEnd={(e) => {
        const el = e.target as HTMLElement;
        if (el.dataset.panel) el.style.removeProperty('--drag-from');
      }}
    >
      {tabs.map(({ value: v }) => (
        // The exiting panel stays mounted through its slide out.
        <TabsContent
          key={v}
          value={v}
          data-panel={v}
          forceMount={v === peek || undefined}
          className="mobile-panel absolute inset-0 mt-0 flex-col [&:not([hidden])]:flex"
        >
          {renderPanel(v)}
        </TabsContent>
      ))}
    </div>
  );
}
