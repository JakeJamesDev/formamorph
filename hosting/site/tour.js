// The landing feature tour: steps scroll past one pinned screenshot with hotspots and a theme wipe.
(() => {
  const tour = document.querySelector('[data-tour]');
  if (!tour) return;

  const PALETTES = [
    { id: 'purple', name: 'Purple', swatch: '#a78bfa' },
    { id: 'graphite', name: 'Graphite', swatch: '#6b7280' },
    { id: 'forest', name: 'Forest', swatch: '#4f9a57' },
    { id: 'rose', name: 'Rose', swatch: '#e86a8a' },
    { id: 'monochrome', name: 'Monochrome', swatch: '#d4d4d4' },
  ];
  // Hotspots are [x %, y %, note] on the 1600x900 capture. A step with `frame` has one palette.
  const STEPS = [
    { id: '02-game', kick: 'Play', title: 'A Narrator That Follows Your Lead',
      body: 'Type what you do, or pick a suggested action. The narrator answers in full prose, and your stats change with the story.',
      hots: [[49, 24, 'The story appears as the AI writes it'], [49, 68, 'Pick a suggested action or type your own'],
        [86, 36, 'Stats rise and fall with your choices'], [13, 72, 'See who is in the scene']] },
    { id: 'inventory', kick: 'Inventory', title: 'Pick It Up, Use It, Give It Away',
      body: 'Items land in your inventory when the story hands them to you. Equip gear, use a potion, drop what you don’t need, or give it to someone in the scene.',
      frame: (mode) => `/site/shots/hero/${mode}/inv-full.webp`,
      hots: [[84, 74.5, 'New items arrive as the story gives them'], [79, 40, 'Equip gear on your character'],
        [85, 59, 'The money you carry'], [96, 74.5, 'Use, drop or give an item']] },
    { id: '01-library', kick: 'Library', title: 'Hundreds of Worlds to Explore',
      body: 'Start with the worlds that come with the game, then download more from the community. A built-in guide answers your questions as you play.',
      hots: [[40, 4.5, 'Browse and download community worlds'], [62, 4.5, 'Import a world someone shared with you'],
        [70, 55, 'Ask the built-in guide anything']] },
    { id: '03-world-details', kick: 'Create', title: 'Build Your Own World',
      body: 'Write characters, locations, items, stats and scripts in the world editor. Share your world as one file, or publish it to the community.',
      hots: [[32, 61, 'Open any world in the editor'], [32, 71, 'Share it as one file'],
        [67, 26, 'Your description, tags and art']] },
    { id: '04-settings', kick: 'Your Setup', title: 'Any AI Model, Any Look',
      body: 'Connect any OpenAI-compatible AI service, or run a model on your own computer. Pick a color theme, a font and how the story appears.',
      hots: [[57, 15, 'Connect your own AI service'], [43, 35, 'Color themes in light and dark'],
        [40, 73, 'Make an image of each scene']] },
    { id: '05-avatar', kick: 'Avatars', title: 'A 3D Character of Your Own',
      body: 'Load any VRM model and shape its body, face and colors to fit your character.',
      hots: [[34, 60, 'Load any VRM model'], [78, 52, 'Shape the body and colors']] },
  ];
  const SWEEP_EVERY_MS = 4200;
  const SWEEP_MS = 1400;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mode = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  const make = (tag, cls, parent) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.append(n);
    return n;
  };

  const stepsHost = tour.querySelector('[data-steps]');
  const frame = tour.querySelector('[data-frame]');
  const base = frame.querySelector('[data-base]');
  const over = frame.querySelector('[data-over]');
  const bar = frame.querySelector('[data-bar]');
  const swatches = tour.querySelector('[data-swatches]');
  const palName = tour.querySelector('[data-palname]');

  let step = 0;
  let pal = 0;
  let near = false; // the tour is close enough to load its frames
  let dragging = false;
  let sweeping = false;
  const fixed = () => !!STEPS[step].frame;
  const src = (p, s) => (s.frame ? s.frame(mode()) : `/site/shots/${PALETTES[p].id}/${mode()}/${s.id}.webp`);

  const stepNodes = STEPS.map((s, i) => {
    const n = make('div', 'step', stepsHost);
    n.dataset.step = s.id;
    make('span', 'kick grad-text', n).textContent = s.kick;
    make('h3', '', n).textContent = s.title;
    make('p', '', n).textContent = s.body;
    n.dataset.i = String(i);
    return n;
  });

  const next = () => (pal + 1) % PALETTES.length;
  // Each manual pick bumps this, so a running sweep yields; every palette change rests a full period.
  let picked = 0;
  let restSince = 0;
  const pick = (i) => { picked++; setPal(i); };

  const swatchButtons = PALETTES.map((p, i) => {
    const b = make('button', '');
    b.type = 'button';
    b.style.background = p.swatch;
    b.setAttribute('aria-label', `${p.name} theme`);
    b.addEventListener('click', () => pick(i));
    swatches.insertBefore(b, palName);
    return b;
  });

  const setCut = (pct) => frame.style.setProperty('--cut', `${pct}%`);
  const hideWipe = () => { setCut(100); bar.classList.add('hide'); };

  function render() {
    const s = STEPS[step];
    stepNodes.forEach((n, i) => n.classList.toggle('cur', i === step));
    frame.dataset.step = s.id;
    swatches.classList.toggle('off', fixed());
    swatchButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === pal)));
    palName.textContent = PALETTES[pal].name;
    // Frames stay unrequested until the tour nears the viewport.
    if (!near) return;
    base.src = src(pal, s);
    if (fixed()) over.removeAttribute('src');
    else over.src = src(next(), s);
  }

  function setPal(i) {
    pal = i;
    restSince = performance.now();
    hideWipe();
    render();
  }

  function renderHots() {
    const hadFocus = document.activeElement?.classList.contains('hot');
    frame.querySelectorAll('.hot, .tip').forEach((n) => n.remove());
    const tips = [];
    STEPS[step].hots.forEach(([x, y, note]) => {
      const b = make('button', 'hot', frame);
      b.type = 'button';
      b.setAttribute('aria-label', note);
      Object.assign(b.style, { left: `${x}%`, top: `${y}%` });
      const tip = make('div', 'tip', frame);
      tips.push(tip);
      tip.textContent = note;
      tip.setAttribute('aria-hidden', 'true');
      Object.assign(tip.style, { left: `${Math.min(85, Math.max(15, x))}%`, top: `${y}%` });
      if (y < 18) tip.classList.add('below');
      const show = () => { for (const t of tips) t.classList.toggle('show', t === tip); };
      const hide = () => tip.classList.remove('show');
      b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') show(); });
      b.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
      // A tap shows the note too; a browser that skips focus on tap still gets the click.
      b.addEventListener('click', show);
      b.addEventListener('focus', show);
      b.addEventListener('blur', hide);
      // A hotspot press is not a drag on the wipe.
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
    });
    // Keyboard scrolling past a step keeps focus in the frame.
    if (hadFocus) frame.querySelector('.hot')?.focus({ preventScroll: true });
  }

  // Dragging previews the next palette from the right; releasing past the middle keeps it.
  const cutAt = (x) => {
    const r = frame.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100));
  };
  frame.addEventListener('pointerdown', (e) => {
    if (fixed()) return;
    picked++;
    dragging = true;
    frame.setPointerCapture(e.pointerId);
    bar.classList.remove('hide');
    setCut(cutAt(e.clientX));
  });
  frame.addEventListener('pointermove', (e) => { if (dragging) setCut(cutAt(e.clientX)); });
  frame.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    if (cutAt(e.clientX) < 50) pick(next());
    else hideWipe();
  });
  // Capture lost without a pointerup (a cancel, a window switch) restores the current palette.
  frame.addEventListener('lostpointercapture', () => {
    if (!dragging) return;
    dragging = false;
    hideWipe();
  });

  // The automatic sweep paints the next palette across, eased in and out; a hover or a pick stops it.
  function sweep() {
    if (sweeping || dragging || fixed() || reduce.matches) return;
    sweeping = true;
    bar.classList.remove('hide');
    const from = step;
    const run = picked;
    const t0 = performance.now();
    const tick = (t) => {
      if (dragging || step !== from || run !== picked || frame.matches(':hover')) {
        sweeping = false;
        if (!dragging && run === picked) hideWipe();
        return;
      }
      const progress = Math.min(1, (t - t0) / SWEEP_MS);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
      setCut(100 - eased * 100);
      if (progress < 1) { requestAnimationFrame(tick); return; }
      sweeping = false;
      setPal(next());
    };
    requestAnimationFrame(tick);
  }
  let inView = false;
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; }, { threshold: 0.5 }).observe(frame);
  setInterval(() => {
    const rested = performance.now() - restSince >= SWEEP_EVERY_MS;
    if (inView && rested && !document.hidden && !frame.matches(':hover')) sweep();
  }, SWEEP_EVERY_MS / 4);

  // The step nearest the middle of the viewport is the current one.
  const stepIo = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const i = Number(e.target.dataset.i);
      if (i === step) continue;
      step = i;
      setPal(pal);
      renderHots();
    }
  }, { rootMargin: '-45% 0px -45% 0px' });
  stepNodes.forEach((n) => stepIo.observe(n));

  const nearIo = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    near = true;
    nearIo.disconnect();
    render();
  }, { rootMargin: '0px 0px 200px 0px' });
  nearIo.observe(frame);

  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  hideWipe();
  render();
  renderHots();
})();
