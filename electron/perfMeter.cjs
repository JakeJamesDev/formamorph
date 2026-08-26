// Opt-in responsiveness meter for the desktop app: `npm run desktop:perf`, or pass --perf-meter to any
// electron launch. Prints one line every couple of seconds naming what was slow in that window, so a
// "the app feels sluggish" report becomes a number instead of an impression.
//
// It measures the four things that can each make the app feel slow, and which are NOT interchangeable:
//   main loop     — the Electron main process's event loop, which is also the window message pump
//   frames        — how often the renderer missed a frame, and its worst gap
//   renderer JS   — the renderer's main thread blocking
//   input         — how long a real mouse/key event took to reach a JS handler (this is what "sluggish" is)
//
// Lives in the main process on purpose: the renderer half is injected only when the flag is on, so nothing
// here reaches the shipped renderer bundle.

const ENABLED = process.argv.includes('--perf-meter') || process.env.FORMAMORPH_PERF === '1';

// A window is called out when it breaches one of these; everything else prints quietly.
const LIMITS = { mainLoop: 100, frame: 50, rendererJs: 50, input: 50 };
const WINDOW_MS = 2000;

/**
 * Print a meter line, or drop it. Closing the terminal that launched the app breaks stdout, and the EPIPE
 * arrives as an async error on the stream rather than a throw from console.log — so it lands as an uncaught
 * exception and kills the app. A diagnostic must never be able to do that.
 */
function log(line) {
  try {
    if (!process.stdout.writable) return;
    console.log(line);
  } catch { /* stdout went away mid-write */ }
}

/** The renderer half. Installed once per page load; keeps only the current window's numbers. */
const RENDERER_PROBE = `(() => {
  if (window.__perfMeter) return true;
  const m = { frames: 0, dropped: 0, frameMax: 0, jsMax: 0, input: [] };
  let lastFrame = performance.now(), lastTick = performance.now();
  requestAnimationFrame(function step(t) {
    const d = t - lastFrame; lastFrame = t;
    m.frames++; if (d > 33) m.dropped++; if (d > m.frameMax) m.frameMax = d;
    requestAnimationFrame(step);
  });
  setInterval(() => { const n = performance.now(); const drift = n - lastTick - 20; lastTick = n; if (drift > m.jsMax) m.jsMax = drift; }, 20);
  // event.timeStamp shares performance.now()'s time origin, so this is real end-to-end input delay.
  const onInput = (e) => { const l = performance.now() - e.timeStamp; if (l >= 0 && l < 10000) m.input.push(l); };
  addEventListener('mousemove', onInput, true);
  addEventListener('keydown', onInput, true);
  addEventListener('wheel', onInput, true);
  window.__perfMeter = () => {
    const i = m.input.sort((a, b) => a - b);
    const out = { frames: m.frames, dropped: m.dropped, frameMax: m.frameMax, jsMax: m.jsMax,
      inN: i.length, inMed: i.length ? i[Math.floor(i.length / 2)] : 0, inP95: i.length ? i[Math.floor(i.length * 0.95)] : 0, inMax: i.length ? i[i.length - 1] : 0 };
    m.frames = 0; m.dropped = 0; m.frameMax = 0; m.jsMax = 0; m.input = [];
    return out;
  };
  return true;
})()`;

/**
 * Start the meter over a window, if it was asked for. `getEnginePid` is optional and only labels whether the
 * engine child was alive for a window. Returns a stop function; a no-op when the flag is off.
 */
function start({ getWindow, getEnginePid } = {}) {
  if (!ENABLED) return () => {};

  // The write itself can succeed and the pipe break afterwards, so the guard in log() is not enough on its
  // own: without a listener here that stream error is an uncaught exception in the main process.
  process.stdout.on('error', () => {});

  const gaps = [];
  let last = Date.now();
  const sampler = setInterval(() => {
    const now = Date.now();
    gaps.push(now - last - 20);
    last = now;
  }, 20);

  const worst = { mainLoop: 0, frame: 0, rendererJs: 0, input: 0 };
  let windows = 0;
  let injectedFor = null;

  const fmt = (n) => `${Math.round(n)}`.padStart(4);

  const tick = async () => {
    const mainGaps = gaps.splice(0);
    const mainMax = mainGaps.length ? Math.max(...mainGaps) : 0;
    const mainOver = mainGaps.filter((g) => g > LIMITS.mainLoop).length;

    const win = getWindow?.();
    let r = null;
    if (win && !win.isDestroyed()) {
      try {
        // Re-inject after a reload — the page's copy went with it.
        if (injectedFor !== win.webContents.id || !(await win.webContents.executeJavaScript('typeof window.__perfMeter === "function"'))) {
          await win.webContents.executeJavaScript(RENDERER_PROBE);
          injectedFor = win.webContents.id;
        }
        r = await win.webContents.executeJavaScript('window.__perfMeter()');
      } catch { /* window went away mid-window; skip this one */ }
    }
    if (!r) return;

    windows++;
    worst.mainLoop = Math.max(worst.mainLoop, mainMax);
    worst.frame = Math.max(worst.frame, r.frameMax);
    worst.rendererJs = Math.max(worst.rendererJs, r.jsMax);
    worst.input = Math.max(worst.input, r.inP95);

    const breach = mainMax > LIMITS.mainLoop || r.frameMax > LIMITS.frame || r.jsMax > LIMITS.rendererJs || r.inP95 > LIMITS.input;
    const pid = getEnginePid?.() ?? null;
    log(
      `[perf] main-loop ${fmt(mainMax)}ms${mainOver ? `(x${mainOver})` : '    '}  ` +
      `frames ${String(r.frames).padStart(3)} dropped ${String(r.dropped).padStart(3)} worst ${fmt(r.frameMax)}ms  ` +
      `renderJS ${fmt(r.jsMax)}ms  ` +
      `input med ${fmt(r.inMed)} p95 ${fmt(r.inP95)} max ${fmt(r.inMax)}ms (n=${String(r.inN).padStart(3)})  ` +
      `engine ${pid ? `pid ${pid}` : 'off'}` +
      (breach ? '   <-- SLOW' : ''),
    );
  };

  const timer = setInterval(() => { tick().catch(() => {}); }, WINDOW_MS);
  log(`[perf] meter on — one line per ${WINDOW_MS / 1000}s. Move the mouse while it feels slow; "input" is what sluggish means.`);

  return () => {
    clearInterval(timer);
    clearInterval(sampler);
    if (windows) {
      log(`[perf] worst over ${windows} windows: main-loop ${Math.round(worst.mainLoop)}ms · frame ${Math.round(worst.frame)}ms · renderJS ${Math.round(worst.rendererJs)}ms · input p95 ${Math.round(worst.input)}ms`);
    }
  };
}

module.exports = { start, ENABLED };
