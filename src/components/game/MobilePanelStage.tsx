import * as React from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import type { SwipeProgress } from '@/lib/swipeProgress';
import { PanelShownProvider } from '@/lib/panelShown';

const SLOP = 10; // px a touch moves before it picks an axis
const FLICK_SPEED = 0.4; // px per ms
const CARRY_MS = 200; // how far a release's speed carries the strip when it picks a panel
const HELD_MS = 50; // a pause this long before lifting drops the release speed
const EDGE_GIVE = 0.3; // the most the strip follows past the first or last panel, in panels
const SLIDE_MS = 300;
const STANDARD = 'cubic-bezier(0.2, 0, 0, 1)';
// Targets that keep a sideways drag for themselves.
const OWN_DRAG = 'input, textarea, select, canvas, [contenteditable="true"], [role="slider"], [data-no-swipe]';

type Gesture = {
  id: number; x0: number; y0: number; axis: 'x' | 'y' | null;
  /** The strip's offset when the drag took hold. */
  from: number;
  offset: number; lastX: number; lastT: number; speed: number;
};

const scrollsSideways = (from: Element, stop: Element) => {
  for (let el: Element | null = from; el && el !== stop; el = el.parentElement) {
    const { overflowX } = getComputedStyle(el);
    if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) return true;
  }
  return false;
};

// A panel out of view skips the view's renders until it shows again, then catches up in one.
const Frozen = React.memo(
  function Frozen({ children }: { live: boolean; children: React.ReactNode }) { return children; },
  (prev, next) => !prev.live && !next.live,
);

const px = (offset: number) => `translateX(${offset}px)`;
const restAt = (index: number) => `translateX(${-index * 100}%)`;

/**
 * The mobile game view's panels side by side in one strip, one per tab of the enclosing `Tabs`. A touch drag
 * moves the strip under the finger: drag left for the tab to the right, right for the tab to the left. A tab
 * change glides it, and a new drag catches it mid-glide. Panels out of view are inert.
 */
export function MobilePanelStage<V extends string>({ tabs, value, onValueChange, renderPanel, progress }: {
  tabs: readonly { value: V }[];
  value: V;
  onValueChange: (value: V) => void;
  renderPanel: (value: V) => React.ReactNode;
  /** Where the strip sits while it moves, for the tab strip's pill. */
  progress?: SwipeProgress;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const stageRef = React.useRef<HTMLDivElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const gesture = React.useRef<Gesture | null>(null);
  const glideRef = React.useRef<{ run: Animation; to: number } | null>(null);
  const placed = React.useRef(false);
  const index = Math.max(0, tabs.findIndex((tab) => tab.value === value));
  // The panels the strip shows any part of while it moves, as "first:last"; at rest only the open one.
  const [inView, setInView] = React.useState(`${index}:${index}`);
  const [firstInView, lastInView] = inView.split(':').map(Number);
  const isShown = (i: number) => i === index || (i >= firstInView && i <= lastInView);

  const width = () => stageRef.current?.clientWidth ?? 0;
  const span = (a: number, b: number) => {
    const clamp = (n: number) => Math.max(0, Math.min(tabs.length - 1, n));
    setInView(`${clamp(Math.floor(Math.min(a, b)))}:${clamp(Math.ceil(Math.max(a, b)))}`);
  };

  // Where the strip is drawn now, mid-glide included.
  const offsetNow = () => {
    const track = trackRef.current;
    if (!track) return 0;
    if (typeof DOMMatrixReadOnly !== 'undefined') {
      const computed = getComputedStyle(track).transform;
      if (computed && computed !== 'none') return new DOMMatrixReadOnly(computed).m41;
    }
    const inline = /translateX\((-?[\d.]+)(px|%)\)/.exec(track.style.transform);
    if (!inline) return 0;
    return inline[2] === 'px' ? Number(inline[1]) : (Number(inline[1]) / 100) * width();
  };

  // Under the finger: report the strip's place in tabs, for the pill and for which panels show.
  const follow = (offset: number) => {
    const w = width();
    if (!w) return;
    progress?.set(-offset / w);
    span(-offset / w, -offset / w);
  };

  const stopGlide = () => {
    const glider = glideRef.current;
    glideRef.current = null;
    glider?.run.cancel();
  };

  /** Glide to panel `to`, leaving at `speed` (px per ms, signed) when a release hands one over. */
  const glide = (to: number, speed = 0) => {
    const track = trackRef.current;
    if (!track) return;
    const w = width();
    const from = offsetNow();
    const target = -to * w;
    stopGlide();
    const land = () => {
      track.style.transform = restAt(to);
      glideRef.current = null;
      progress?.set(null);
      span(to, to);
    };
    const distance = Math.abs(target - from);
    if (reducedMotion || typeof track.animate !== 'function' || distance < 1 || !w) { land(); return; }
    // A release toward the panel keeps its speed: the curve leaves at the finger's pace and eases in.
    const toward = speed !== 0 && Math.sign(speed) === Math.sign(target - from);
    const duration = toward ? Math.min(SLIDE_MS, Math.max(160, (2.5 * distance) / Math.abs(speed))) : SLIDE_MS;
    const lift = toward ? Math.min(1, (Math.abs(speed) * duration * 0.25) / distance) : 0;
    const easing = toward ? `cubic-bezier(0.25, ${lift.toFixed(3)}, 0.25, 1)` : STANDARD;
    const run = track.animate([{ transform: px(from) }, { transform: px(target) }], { duration, easing });
    const glider = { run, to };
    glideRef.current = glider;
    // The pill runs the same glide itself, so nothing here runs per frame.
    progress?.glide({ from: -from / w, to, duration, easing });
    span(-from / w, to);
    run.finished.then(() => { if (glideRef.current === glider) land(); }, () => {});
  };

  // A tab change glides the strip, unless a release already sent it there.
  React.useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (!placed.current) { placed.current = true; track.style.transform = restAt(index); return; }
    if (glideRef.current?.to === index || gesture.current?.axis === 'x') return;
    glide(index);
    // `glide` reads refs only; the strip moves when the tab does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // An unmount mid-glide stops it and leaves the pill at rest.
  React.useEffect(() => () => {
    const glider = glideRef.current;
    glideRef.current = null;
    glider?.run.cancel();
    progress?.set(null);
  }, [progress]);

  // A sideways drag keeps the page's scrollers from taking the touch, which would cancel the pointer.
  // React's touch listeners are passive, so this one is native.
  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const hold = (e: TouchEvent) => { if (gesture.current?.axis === 'x' && e.cancelable) e.preventDefault(); };
    stage.addEventListener('touchmove', hold, { passive: false });
    return () => stage.removeEventListener('touchmove', hold);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // A new touch replaces any gesture whose end never reached here, such as one a menu's overlay took.
    if (e.pointerType === 'mouse' || !e.isPrimary) return;
    const target = e.target as Element;
    // A portaled dialog's touches reach here through the React tree.
    if (!e.currentTarget.contains(target)) return;
    if (target.closest(OWN_DRAG) || scrollsSideways(target, e.currentTarget)) return;
    gesture.current = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null,
      from: 0, offset: 0, lastX: e.clientX, lastT: performance.now(), speed: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    const track = trackRef.current;
    if (!g || g.id !== e.pointerId || !track) return;
    if (g.axis === null) {
      const dx = e.clientX - g.x0;
      const dy = e.clientY - g.y0;
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      if (Math.abs(dy) >= Math.abs(dx)) { gesture.current = null; return; }
      // Take hold where the strip is, mid-glide included, and follow from this point so it doesn't jump.
      g.axis = 'x';
      g.from = offsetNow();
      stopGlide();
      track.style.transform = px(g.from);
      follow(g.from);
      g.x0 = e.clientX;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    const now = performance.now();
    const dt = now - g.lastT;
    if (dt > 0) g.speed = (e.clientX - g.lastX) / dt;
    g.lastX = e.clientX;
    g.lastT = now;

    const w = width();
    const last = -(tabs.length - 1) * w;
    // Past the first or last panel the strip resists, and never goes further than EDGE_GIVE of a panel.
    const cap = w * EDGE_GIVE;
    const give = (over: number) => (cap ? cap * (1 - Math.exp((-0.5 * over) / cap)) : 0);
    let offset = g.from + e.clientX - g.x0;
    if (offset > 0) offset = give(offset);
    if (offset < last) offset = last - give(last - offset);
    g.offset = offset;
    track.style.transform = px(offset);
    follow(offset);
  };

  const release = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    if (g.axis !== 'x') return;
    const w = width() || 1;
    // A finger that stopped before lifting has no speed left to hand over.
    const speed = e.type === 'pointerup' && performance.now() - g.lastT < HELD_MS ? g.speed : 0;
    const at = -g.offset / w;
    // A flick goes on to the next panel its way; otherwise the strip lands on the nearest after its carry.
    let to = Math.abs(speed) > FLICK_SPEED
      ? (speed < 0 ? Math.ceil(at) : Math.floor(at))
      : Math.round(-(g.offset + speed * CARRY_MS) / w);
    to = Math.max(0, Math.min(tabs.length - 1, to));
    glide(to, speed);
    if (to !== index) onValueChange(tabs[to].value);
  };

  return (
    <div
      ref={stageRef}
      className="relative flex-grow min-h-0 overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      onPointerCancel={release}
      // Taking capture from the touched element fires its loss there too; only the stage's own loss ends a drag.
      onLostPointerCapture={(e) => { if (e.target === e.currentTarget) release(e); }}
    >
      <div ref={trackRef} data-panel-track="" className="absolute inset-0 will-change-transform">
        {tabs.map(({ value: v }, i) => {
          // Panels out of view take no focus or taps, and screen readers skip them.
          const away = v !== value;
          return (
            <TabsContent
              key={v}
              value={v}
              data-panel={v}
              forceMount
              hidden={false}
              inert={away}
              aria-hidden={away || undefined}
              className="absolute inset-y-0 mt-0 flex w-full flex-col"
              style={{ left: `${i * 100}%` }}
            >
              <PanelShownProvider value={isShown(i)}>
                <Frozen live={isShown(i)}>{renderPanel(v)}</Frozen>
              </PanelShownProvider>
            </TabsContent>
          );
        })}
      </div>
    </div>
  );
}
