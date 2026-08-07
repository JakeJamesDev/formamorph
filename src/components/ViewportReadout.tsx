import { useEffect, useState } from 'react';
import { APP_HEIGHT_VAR, APP_TOP_VAR } from '@/lib/viewportHeight';

/**
 * DEV-only overlay listing every number the keyboard-aware sizing reads, for diagnosing on a real
 * phone where no tooling reaches. Turn it on with `#dev?probe=viewport` or `window.__fmDev.probe('viewport')`.
 *
 * It is deliberately `position: fixed` against the *visual* viewport top-left and re-anchored on every
 * visual-viewport scroll, so it stays on screen on an engine that moves the visual viewport out from
 * under fixed elements — the exact case being diagnosed.
 */

/** One labelled number, plus whether it should be called out as the suspicious one. */
interface Row {
  label: string;
  value: string;
  flag?: boolean;
}

function readRows(): Row[] {
  const root = document.documentElement;
  const vv = window.visualViewport;
  const appEl = document.querySelector('.app-viewport') as HTMLElement | null;
  const appRect = appEl?.getBoundingClientRect();
  const layout = root.clientHeight;
  const visual = vv ? Math.round(vv.height) : null;

  // The gap the black bar would live in: everything below the app that nothing of ours is painting.
  const gap = appRect ? Math.round((visual ?? layout) - appRect.bottom) : null;

  return [
    { label: 'window.innerHeight', value: `${window.innerHeight}` },
    { label: 'layout (root.clientHeight)', value: `${layout}` },
    { label: 'visualViewport.height', value: visual === null ? 'n/a' : `${visual}` },
    // Non-zero means the browser panned the visual viewport instead of relaying the page out — the app
    // is being slid under the keyboard rather than resized to fit above it.
    { label: 'vv.offsetTop (pan)', value: vv ? `${Math.round(vv.offsetTop)}` : 'n/a', flag: !!vv && Math.round(vv.offsetTop) !== 0 },
    { label: 'vv.pageTop', value: vv ? `${Math.round(vv.pageTop)}` : 'n/a' },
    { label: 'vv.scale', value: vv ? vv.scale.toFixed(2) : 'n/a' },
    { label: 'screen.height', value: `${window.screen.height}` },
    { label: `${APP_HEIGHT_VAR} / ${APP_TOP_VAR}`, value:
      `${root.style.getPropertyValue(APP_HEIGHT_VAR) || '(unset)'} / ${root.style.getPropertyValue(APP_TOP_VAR) || '(unset)'}` },
    { label: 'app top / height / bottom', value: appRect
      ? `${Math.round(appRect.top)} / ${Math.round(appRect.height)} / ${Math.round(appRect.bottom)}`
      : '(no full-height element)' },
    { label: 'unpainted below app', value: gap === null ? 'n/a' : `${gap}`, flag: !!gap && Math.abs(gap) > 2 },
    { label: 'body background', value: getComputedStyle(document.body).backgroundColor },
    { label: 'scrollY', value: `${Math.round(window.scrollY)}` },
  ];
}

export function ViewportReadout() {
  const [rows, setRows] = useState<Row[]>(readRows);
  const [anchor, setAnchor] = useState({ left: 0, top: 0 });

  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => {
      setRows(readRows());
      // Re-pin to the visual viewport's own corner; `fixed` alone follows the layout viewport.
      setAnchor(vv ? { left: Math.round(vv.offsetLeft), top: Math.round(vv.offsetTop) } : { left: 0, top: 0 });
    };
    update();

    // Focus changes are what open and close the keyboard, and the resize can land a frame later.
    const events: Array<[EventTarget | undefined, string]> = [
      [vv ?? undefined, 'resize'], [vv ?? undefined, 'scroll'],
      [window, 'resize'], [window, 'orientationchange'],
      [document, 'focusin'], [document, 'focusout'], [document, 'scroll'],
    ];
    for (const [target, type] of events) target?.addEventListener(type, update);
    // Nothing fires while the keyboard animates open, so sample through it as well.
    const timer = window.setInterval(update, 250);
    return () => {
      for (const [target, type] of events) target?.removeEventListener(type, update);
      window.clearInterval(timer);
    };
  }, []);

  // Outline the app's frame. A stray band inside the outline is the layout not filling its box; one
  // outside it is the frame not covering what's visible. The two have nothing to do with each other,
  // and no number distinguishes them as fast as looking.
  useEffect(() => {
    const el = document.querySelector('.app-viewport') as HTMLElement | null;
    if (!el) return;
    const previous = el.style.outline;
    el.style.outline = '2px dashed magenta';
    el.style.outlineOffset = '-2px';
    return () => { el.style.outline = previous; el.style.outlineOffset = ''; };
  });

  if (!import.meta.env.DEV) return null;

  return (
    <div
      style={{ left: anchor.left, top: anchor.top }}
      className="pointer-events-none fixed z-[9999] m-1 rounded bg-black/80 p-1.5 font-mono text-[10px] leading-tight text-lime-300 ring-1 ring-lime-400/40"
    >
      {rows.map((r) => (
        <div key={r.label} className="flex gap-2">
          <span className="text-lime-500/70">{r.label}</span>
          <span className={r.flag ? 'ml-auto font-bold text-red-400' : 'ml-auto'}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export default ViewportReadout;
