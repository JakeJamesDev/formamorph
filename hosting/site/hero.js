// The landing hero's live turn: overlay text, stat bars and the Inventory switch over the captured game screen.
(() => {
  const TURN = window.FM_HERO_TURN;
  const layout = window.FM_HERO_LAYOUT;
  const live = document.querySelector('[data-live]');
  if (!TURN || !layout || !live) return;

  const FRAMES = '/site/shots/hero';
  const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mode = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const make = (tag, cls, parent) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.append(n);
    return n;
  };
  const place = (n, { x, y, w, h }) => {
    Object.assign(n.style, { left: `${x}px`, top: `${y}px`, width: `${w}px` });
    if (h !== undefined) n.style.height = `${h}px`;
  };
  const font = (n, f) => Object.assign(n.style, {
    fontFamily: f.family, fontSize: `${f.size}px`, lineHeight: `${f.line}px`, fontWeight: f.weight,
  });

  // Crop to the story column's left edge and the side panel's right edge, padded as the app pads them.
  const left = Math.min(layout.narration.box.x, ...layout.choices.map((c) => c.row.x)) - 16;
  const crop = { x: left, y: 0, w: layout.panel.x + layout.panel.w + 8 - left, h: layout.size.h };
  live.style.aspectRatio = `${crop.w} / ${crop.h}`;

  const stage = make('div', 'stage', live);
  Object.assign(stage.style, { width: `${layout.size.w}px`, height: `${layout.size.h}px` });
  const scale = () => {
    stage.style.transform = `scale(${live.clientWidth / crop.w}) translate(${-crop.x}px, ${-crop.y}px)`;
  };
  new ResizeObserver(scale).observe(live);
  scale();

  const base = make('img', '', stage);
  base.alt = '';
  base.fetchPriority = 'high';

  // Stat rows: the capture hid every value, fill and descriptor, so all of them are drawn here.
  const statLayer = make('div', '', stage);
  const stats = layout.stats.map((s) => {
    const change = TURN.stats.find((c) => c.name === s.name)?.change ?? 0;
    const track = make('div', 'track', statLayer);
    place(track, s.bar);
    const fill = make('div', 'fill', track);
    const band = make('div', 'band', track);
    const valW = 200;
    const val = make('div', 'overlay val', statLayer);
    place(val, { x: s.value.x + s.value.w - valW, y: s.value.y, w: valW });
    font(val, s.valueFont);
    const chip = make('span', 'chip', val);
    const num = make('span', '', val);
    const desc = make('div', 'overlay desc', statLayer);
    place(desc, { ...s.descriptorBox, h: undefined });
    font(desc, s.descriptorFont);
    return { ...s, change, fill, band, chip, num, desc };
  });

  const action = make('div', 'overlay', stage);
  place(action, { ...layout.action.box, h: undefined });
  font(action, layout.action.font);

  // Dialogue is every quoted span of a paragraph; each word keeps its trailing space.
  const narr = make('div', 'overlay narr', stage);
  place(narr, { ...layout.narration.box, h: undefined });
  font(narr, layout.narration.font);
  const paras = layout.narration.paragraphs;
  const words = [];
  TURN.narration.split(/\n\n+/).forEach((para, i) => {
    const p = make('p', '', narr);
    p.style.marginTop = i ? `${paras[i].y - paras[i - 1].y - paras[i - 1].h}px` : '0';
    for (const part of para.split(/("[^"]*")/)) {
      if (!part) continue;
      const quote = part.startsWith('"');
      for (const word of part.split(/(?<= )/)) {
        const w = make('span', quote ? 'w q' : 'w', p);
        w.textContent = word;
        words.push(w);
      }
    }
  });

  const choices = layout.choices.map((c, i) => {
    const n = make('div', 'overlay choice', stage);
    place(n, { x: c.box.x, y: c.box.y, w: c.row.x + c.row.w - c.box.x });
    font(n, c.font);
    n.textContent = TURN.choices[i];
    return n;
  });

  // The Inventory frames replace only the side panel.
  const panel = layout.panel;
  const inventoryLayer = () => {
    const n = make('div', 'layer', stage);
    n.style.clipPath = `inset(${panel.y}px ${layout.size.w - panel.x - panel.w}px ${layout.size.h - panel.y - panel.h}px ${panel.x}px round 8px)`;
    const img = make('img', '', n);
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    return n;
  };
  const invBefore = inventoryLayer();
  const invAfter = inventoryLayer();
  const ring = make('div', 'ring', invAfter);
  const item = layout.newItem;
  place(ring, { x: item.x - 4, y: item.y - 2, w: item.w + 8, h: item.h + 4 });

  let colors;
  function paint() {
    const m = mode();
    colors = layout.colors[m];
    base.src = `${FRAMES}/${m}/stats.webp`;
    invBefore.firstElementChild.src = `${FRAMES}/${m}/inv-before.webp`;
    invAfter.firstElementChild.src = `${FRAMES}/${m}/inv-after.webp`;
    action.style.color = colors.action;
    narr.style.color = colors.text;
    for (const w of words) if (w.classList.contains('q')) w.style.color = colors.dialogue;
    for (const n of choices) n.style.color = colors.choice;
    live.style.setProperty('--ring', colors.fill);
    for (const s of stats) {
      s.fill.style.background = colors.fill;
      s.num.style.color = colors.value;
      s.desc.style.color = colors.descriptor;
      const tone = s.change > 0 ? colors.success : colors.destructive;
      s.band.style.background = tone;
      s.chip.style.color = tone;
    }
  }

  // The app's stat bar: the fill slides old to new, and a band over that span grows from the old value.
  const pct = (s, v) => ((v - s.min) / (s.max - s.min)) * 100;
  const off = (...nodes) => { for (const n of nodes) n.style.transition = 'none'; };
  function showStart(s) {
    off(s.fill, s.band, s.chip);
    s.num.textContent = `${s.start} / ${s.max}`;
    s.desc.textContent = s.startDescriptor;
    s.fill.style.width = `${pct(s, s.start)}%`;
    s.band.style.width = '0';
    s.chip.textContent = '';
    s.chip.style.opacity = '0';
  }
  function showChange(s, animate) {
    if (!s.change) return showStart(s);
    const from = s.start;
    const to = s.start + s.change;
    const gain = s.change > 0;
    off(s.fill, s.band, s.chip);
    s.num.textContent = `${to} / ${s.max}`;
    s.desc.textContent = s.endDescriptor ?? s.startDescriptor;
    Object.assign(s.band.style, {
      left: `${pct(s, Math.min(from, to))}%`,
      width: `${Math.abs(pct(s, to) - pct(s, from))}%`,
      transformOrigin: gain ? 'left' : 'right',
      transform: animate ? 'scaleX(0)' : 'none',
    });
    s.chip.textContent = gain ? `+${s.change}` : `−${-s.change}`;
    s.chip.style.opacity = animate ? '0' : '1';
    s.chip.style.transform = animate ? 'translateY(3px)' : 'none';
    s.fill.style.width = `${pct(s, animate ? from : to)}%`;
    if (!animate) return;
    s.fill.getBoundingClientRect();
    s.fill.style.transition = `width 500ms ${EASE}`;
    s.band.style.transition = `transform 500ms ${EASE}`;
    s.chip.style.transition = 'opacity 300ms ease-out, transform 300ms ease-out';
    s.fill.style.width = `${pct(s, to)}%`;
    s.band.style.transform = 'none';
    s.chip.style.opacity = '1';
    s.chip.style.transform = 'none';
  }

  const toggle = (nodes, on) => { for (const n of nodes) n.classList.toggle('on', on); };

  function showFinished() {
    live.classList.add('still');
    action.textContent = TURN.action;
    toggle(words, true);
    toggle(choices, true);
    for (const s of stats) showChange(s, false);
    toggle([invBefore, invAfter, ring], true);
  }

  function reset() {
    live.classList.remove('still');
    action.textContent = '';
    toggle(words, false);
    toggle(choices, false);
    toggle([invBefore, invAfter, ring], false);
    for (const s of stats) showStart(s);
  }

  // A switch to reduced motion ends the loop at the next step.
  const STOP = Symbol('stop');
  const wait = async (ms) => { await sleep(ms); if (reduce.matches) throw STOP; };
  async function play() {
    try {
      for (;;) {
        reset();
        await wait(900);
        for (const ch of TURN.action) { action.textContent += ch; await wait(24); }
        await wait(700);
        for (const w of words) { w.classList.add('on'); await wait(35 + Math.random() * 55); }
        await wait(300);
        toggle(choices, true);
        await wait(500);
        for (const s of stats) if (s.change) showChange(s, true);
        await wait(2600);
        invBefore.classList.add('on');
        await wait(900);
        toggle([invAfter, ring], true);
        await wait(6500);
      }
    } catch (e) {
      if (e !== STOP) throw e;
      showFinished();
    }
  }

  paint();
  for (const s of stats) showStart(s);
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  if (reduce.matches) { showFinished(); return; }
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    play();
  }, { threshold: 0.4 });
  io.observe(live);
})();
