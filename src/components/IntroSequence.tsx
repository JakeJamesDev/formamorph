import { useEffect, useRef } from 'react';
import { INTRO_FONT_BASE64, INTRO_FONT_FAMILY } from '@/lib/introFont';
import { useBackStop } from '@/hooks/useBackStop';

/**
 * First-run welcome animation: a field of gooey blobs popcorns in, magnetizes into place, and merges into
 * chunky liquid letters that spell "Formamorph", then scatters as it hands off to the menu underneath.
 *
 * Two SVG-filtered canvas layers — a themed background and a blob layer behind a metaball goo filter
 * (blur + alpha threshold) — plus the real letterforms drawn onto the goo layer so they read crisply while
 * still liquefying at the edges. Colors are pulled live from the app theme, so it adapts to the active skin.
 *
 * Cinematic on first run (with the "Welcome To…" kicker); snappy + kicker-less on easter-egg replay. Honors
 * reduced-motion (static final frame). Not skippable — both passes are short enough not to warrant it.
 */
export function IntroSequence({
  pace = 'cine',
  onComplete,
}: {
  pace?: 'cine' | 'snap';
  onComplete: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLCanvasElement>(null);
  const gooRef = useRef<HTMLCanvasElement>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);
  const kickerRef = useRef<HTMLDivElement>(null);
  const kickerTextRef = useRef<HTMLSpanElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const doneRef = useRef(onComplete);
  doneRef.current = onComplete;

  // The intro covers the menu without being a modal, so the Android back button would otherwise offer to
  // close the app over it. It is not skippable, so it takes the press and does nothing with it.
  useBackStop(() => {});

  useEffect(() => {
    const root = rootRef.current;
    const canvas = stageRef.current;
    const gooCanvas = gooRef.current;
    const kicker = kickerRef.current;
    const kickerText = kickerTextRef.current;
    const caret = caretRef.current;
    if (!root || !canvas || !gooCanvas || !kicker || !kickerText || !caret) return;
    const ctx = canvas.getContext('2d');
    const gooCtx = gooCanvas.getContext('2d');
    if (!ctx || !gooCtx) return;

    const WORD = 'Formamorph';
    const PACE = pace;
    let cancelled = false;

    // ---------- theme colors (read live from CSS tokens; HSL triplets → hsl()) ----------
    const COL = { stage0: '#0b0a09', stage1: '#141210', accent: '#e6b25a' };
    const token = (name: string, fallback: string) => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      if (!raw) return fallback;
      const parts = raw.split(/\s+/);
      return parts.length === 3 ? `hsl(${parts[0]}, ${parts[1]}, ${parts[2]})` : raw;
    };
    const readColors = () => {
      COL.stage0 = token('--background', COL.stage0);
      COL.stage1 = token('--card', COL.stage1);
      COL.accent = token('--primary', COL.accent);
    };
    readColors();

    // ---------- timeline ----------
    const CINE = { kickerDone: 1400, genesis: 1750, popcorn: 3400, magnet: 4400, disperse: 7900, end: 8700 };
    const SNAP = { kickerDone: 80, genesis: 80, popcorn: 800, magnet: 1600, disperse: 3500, end: 4300 };
    const T = () => (PACE === 'cine' ? CINE : SNAP);

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
    // Springy pop: grow with an overshoot bulge, then a damped jelly wobble that settles to 1.
    const springScale = (age: number, dur: number) => {
      if (age <= 0) return 0;
      const s = age / dur;
      if (s < 1) return easeOut(s) * (1 + Math.sin(s * Math.PI) * 0.5);
      return 1 + Math.exp(-(s - 1) * 3.2) * Math.sin((s - 1) * 13) * 0.17;
    };

    // ---------- geometry ----------
    let W = 0, H = 0, DPR = 1;
    type Blob = { x: number; y: number; px: number; py: number; r: number; seed: number; jig: number; rank: number };
    let blobs: Blob[] = [];
    let titleBox = { y: 0, font: '', glyphs: [] as { ch: string; x: number }[] };
    const fontOf = (px: number) =>
      `700 ${px}px '${INTRO_FONT_FAMILY}','Cascadia Code',ui-monospace,Consolas,monospace`;

    const buildTargets = () => {
      const off = document.createElement('canvas');
      off.width = W; off.height = H;
      const o = off.getContext('2d');
      if (!o) return;
      o.textBaseline = 'middle'; o.textAlign = 'left';
      // Fit the title to width (proportional face is wide); tight tracking buys size without welding letters.
      const chars = WORD.split('');
      let tracking = 0, widths: number[] = [], textW = 0, fs = Math.min(H * 0.46, 220);
      for (let fit = 0; fit < 16; fit++) {
        o.font = fontOf(fs);
        tracking = fs * 0.05;
        widths = chars.map((ch) => o.measureText(ch).width);
        textW = widths.reduce((a, w) => a + w, 0) + tracking * (chars.length - 1);
        if (textW <= W * 0.94 || fs <= 28) break;
        fs *= (W * 0.94) / textW;
      }
      const font = fontOf(fs);
      const startX = (W - textW) / 2, midY = H * 0.55;
      titleBox = { y: midY, font, glyphs: [] };
      o.fillStyle = '#fff';
      let adv = startX;
      chars.forEach((ch, i) => {
        o.fillText(ch, adv, midY);
        titleBox.glyphs.push({ ch, x: adv });
        adv += widths[i] + tracking;
      });

      const img = o.getImageData(0, 0, W, H).data;
      const step = Math.max(6, Math.round(fs * 0.085));
      if (blurRef.current) blurRef.current.setAttribute('stdDeviation', (step * 0.3).toFixed(2));
      const cx = W / 2, cy = midY;
      const pts: { x: number; y: number; d: number }[] = [];
      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          if (img[(y * W + x) * 4 + 3] > 128) {
            const px = x + (Math.random() - 0.5) * step * 0.22;
            const py = y + (Math.random() - 0.5) * step * 0.22;
            pts.push({ x: px, y: py, d: ((px - cx) * (px - cx) + (py - cy) * (py - cy)) * (0.6 + Math.random() * 0.8) });
          }
        }
      }
      pts.sort((a, b) => a.d - b.d);
      const n = Math.max(1, pts.length);
      blobs = pts.map((p, i) => {
        const a = Math.random() * Math.PI * 2;
        let dd = fs * (0.12 + Math.random() * 0.45);
        if (Math.random() < 0.22) dd *= 1.9;
        // Tight, lean size range so the field reads as goo (no dust, no boulders) and doesn't flood counters.
        let rr = step * (0.5 + Math.random() * Math.random() * 0.55);
        if (Math.random() < 0.08) rr *= 1.4;
        return {
          x: p.x, y: p.y,
          px: p.x + Math.cos(a) * dd, py: p.y + Math.sin(a) * dd,
          r: rr, seed: Math.random() * 100, jig: step * (0.14 + Math.random() * 0.18), rank: i / n,
        };
      });
      // First kernel grows from dead center; medium radius so it survives the goo threshold solo (won't vanish).
      if (blobs.length) { blobs[0].px = cx; blobs[0].py = midY; blobs[0].r = step * 0.9; }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      for (const c of [canvas, gooCanvas]) {
        c.width = Math.round(W * DPR);
        c.height = Math.round(H * DPR);
      }
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      gooCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
      buildTargets();
    };

    const background = () => {
      const g = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.1, W / 2, H * 0.5, H * 0.95);
      g.addColorStop(0, COL.stage1);
      g.addColorStop(1, COL.stage0);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    };
    const drawGoo = (x: number, y: number, r: number) => {
      if (r < 0.5) return;
      gooCtx.beginPath(); gooCtx.arc(x, y, r, 0, Math.PI * 2); gooCtx.fill();
    };
    // Real letterforms on the goo layer — the filter liquefies their edges; alpha ramps through the
    // threshold so the word swells in from the blob core, reading as the goo setting rather than text fading.
    const drawWord = (alpha: number, t: number) => {
      if (alpha <= 0 || !titleBox.glyphs.length) return;
      gooCtx.save();
      gooCtx.globalAlpha = alpha;
      gooCtx.font = titleBox.font;
      gooCtx.textBaseline = 'middle'; gooCtx.textAlign = 'left';
      const wx = Math.sin(t / 430) * 1.2, wy = Math.cos(t / 310) * 1.4;
      titleBox.glyphs.forEach((g, i) => {
        gooCtx.fillText(g.ch, g.x + wx + Math.sin(t / 350 + i) * 0.8, titleBox.y + wy + Math.cos(t / 280 + i * 1.7) * 1.0);
      });
      gooCtx.restore();
    };

    let start = 0, rafId = 0, finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(rafId);
      doneRef.current();
    };

    const frame = (now: number) => {
      if (cancelled) return;
      // Re-read each frame so the canvas tracks the live theme: the theme class is applied by a parent
      // effect that runs *after* this component's, so a one-time read at mount catches the pre-class
      // (light) defaults and mismatches the kicker's live `text-foreground`. By the first rAF the class
      // is set, and reading here keeps canvas + CSS in lockstep even if the OS theme flips mid-intro.
      readColors();
      const t = now - start, e = T();
      ctx.clearRect(0, 0, W, H);
      gooCtx.clearRect(0, 0, W, H);
      gooCtx.fillStyle = COL.accent;
      background();

      if (PACE === 'cine') {
        kickerText.textContent = 'Welcome To…'.slice(0, Math.round(clamp01(t / 1000) * 11));
        caret.style.opacity = t < 1000 ? '1' : '0';
        const up = clamp01((t - 1000) / 400);
        kicker.style.transform = `translateY(${up * -H * 0.16}px)`;
        kicker.style.opacity = String(0.4 + 0.6 * clamp01(t / 350) - up * 0.15);
      } else {
        kicker.style.opacity = '0';
      }

      const firstBornAt = PACE === 'cine' ? e.kickerDone : 0;
      const restStart = PACE === 'cine' ? e.genesis : 0;
      const restWin = e.popcorn - restStart;
      const magRaw = clamp01((t - e.popcorn) / (e.magnet - e.popcorn));
      const hz = clamp01((t - e.disperse) / (e.end - e.disperse));

      // Fade the whole overlay (opaque backdrop + scattering goo) out on hand-off, so it dissolves smoothly
      // into the real menu underneath instead of popping away when the component unmounts at the end.
      root.style.opacity = String(1 - easeOut(hz));
      if (hz > 0 && PACE === 'cine') kicker.style.opacity = String((1 - easeOut(hz)) * 0.7);

      const popMs = PACE === 'cine' ? 300 : 140;
      const dp = t >= e.disperse ? easeOut(hz) : 0;
      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        const bt = i === 0 ? firstBornAt : restStart + restWin * (0.03 + 0.9 * b.rank);
        const bMs = i === 0 ? popMs * 1.6 : popMs;
        const age = t - bt;
        if (age <= 0) continue;

        const m = easeInOut(clamp01((magRaw - b.rank * 0.35) / 0.65));
        let x = b.px + (b.x - b.px) * m;
        let y = b.py + (b.y - b.py) * m;
        const jig = b.jig * (1 - 0.82 * m);
        x += Math.sin(t / 280 + b.seed) * jig;
        y += Math.cos(t / 320 + b.seed * 1.3) * jig;
        let pr = b.r * springScale(age, bMs) * (1 - 0.18 * m);

        if (dp > 0) {
          const ox = b.x - W / 2, oy = b.y - titleBox.y, ol = Math.hypot(ox, oy) || 1;
          x += (ox / ol) * dp * H * 0.45 + (Math.random() - 0.5) * dp * 5;
          y += (oy / ol) * dp * H * 0.3;
          pr *= 1 - dp;
        }
        drawGoo(x, y, pr);
      }

      // Word materializes across the whole magnetize+hold (imperceptibly slow), then cuts instantly on hand-off.
      const solid = easeInOut(clamp01((t - e.popcorn) / (e.disperse - e.popcorn)));
      if (t < e.disperse) drawWord(solid, t);

      if (t >= e.end) { finish(); return; }
      rafId = requestAnimationFrame(frame);
    };

    const renderStatic = () => {
      readColors();
      ctx.clearRect(0, 0, W, H);
      gooCtx.clearRect(0, 0, W, H);
      background();
      kicker.style.transform = `translateY(${-H * 0.16}px)`;
      kicker.style.opacity = '0.7';
      kickerText.textContent = 'Welcome To…';
      caret.style.opacity = '0';
      gooCtx.fillStyle = COL.accent;
      for (const b of blobs) drawGoo(b.x, b.y, b.r * 0.8);
      drawWord(1, 0);
    };

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let staticTimer = 0;

    // Load the puffy face, then start (canvas sampling needs it ready or it silently falls back to mono).
    const startAfterFont = () => {
      if (cancelled) return;
      resize();
      if (reduce) {
        // Defer one frame so the parent theme effect has applied the .dark/.light class before we
        // sample the tokens (same ordering issue the animated path handles by reading inside rAF).
        rafId = requestAnimationFrame(renderStatic);
        staticTimer = window.setTimeout(finish, PACE === 'cine' ? 1600 : 900);
        return;
      }
      start = performance.now();
      rafId = requestAnimationFrame(frame);
    };
    new FontFace(INTRO_FONT_FAMILY, `url(data:font/woff2;base64,${INTRO_FONT_BASE64})`, { weight: '700' })
      .load()
      .then((f) => { document.fonts.add(f); })
      .catch(() => {})
      .then(startAfterFont);

    const ro = new ResizeObserver(() => { if (!reduce && !finished) resize(); });
    ro.observe(canvas);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(staticTimer);
      ro.disconnect();
    };
  }, [pace]);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[120] overflow-hidden bg-background"
      aria-hidden="true"
    >
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <filter id="fm-intro-goo">
            <feGaussianBlur ref={blurRef} in="SourceGraphic" stdDeviation="6" result="b" />
            <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11" />
          </filter>
        </defs>
      </svg>
      <canvas ref={stageRef} className="absolute inset-0 h-full w-full" />
      <canvas ref={gooRef} className="absolute inset-0 h-full w-full" style={{ filter: 'url(#fm-intro-goo)' }} />
      <div
        ref={kickerRef}
        className="pointer-events-none absolute inset-x-0 top-[42%] text-center font-semibold text-foreground opacity-0"
        style={{ fontSize: 'clamp(15px, 2.6vw, 26px)', letterSpacing: '0.04em', willChange: 'transform, opacity' }}
      >
        <span ref={kickerTextRef} />
        <span ref={caretRef} className="ml-0.5 inline-block animate-pulse text-primary">
          ▌
        </span>
      </div>
    </div>
  );
}
