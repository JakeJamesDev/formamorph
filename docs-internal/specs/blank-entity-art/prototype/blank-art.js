// Mock blank-entity art. Injected into the page; replaces placeholder <img>s with inline SVG.
window.__blankArt = (style, allBlank) => {
  const dark = document.documentElement.classList.contains('dark');
  const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  // Murmur3's finalizer: near-identical names give near-identical hashes, and the stream's first draws inherit that.
  const mix = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return (h ^ h >>> 16) >>> 0; };
  const rng = (raw) => { let seed = mix(raw); return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const initials = (n, k) => n.trim().split(/\s+/).slice(0, k).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
  const L = (d, l) => (dark ? d : l);
  let uid = 0;

  // Eight fixed hues, ordered around the wheel; a card pairs its hue with the next one along.
  // teal, sky, blue, violet, pink, coral, amber, green
  const HUES = [172, 198, 222, 262, 322, 8, 38, 138];
  const font = getComputedStyle(document.documentElement).getPropertyValue('--app-font').trim() || 'sans-serif';
  // Letter pixels on the outer silhouette: they touch the outside, and face a clear line to the edge, so a
  // drop there never fills a counter or the mouth of a G or C.
  const silhouetteEdge = (letter, slant) => {
    const W = 200, H = 300;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.translate(100, 195); x.rotate(slant * Math.PI / 180); x.translate(-100, -195);
    x.font = `800 118px ${font}`; x.textAlign = 'center'; x.lineJoin = 'round'; x.lineWidth = 2;
    x.fillText(letter, 100, 236); x.strokeText(letter, 100, 236);
    const px = x.getImageData(0, 0, W, H).data;
    const ink = (i, j) => i >= 0 && j >= 0 && i < W && j < H && px[(j * W + i) * 4 + 3] > 128;
    const edge = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      if (!ink(i, j)) continue;
      for (const [dx, dy] of dirs) {
        if (ink(i + dx, j + dy)) continue;
        let a = i + dx, b = j + dy, clear = true;
        while (a >= 0 && b >= 0 && a < W && b < H) { if (ink(a, b)) { clear = false; break; } a += dx; b += dy; }
        if (clear) { edge.push([i, j]); break; }
      }
    }
    return { edge, ink };
  };
  const morph = (name, listingId) => {
    const r = rng(hash(name)); const id = `goo${uid++}`;
    // The hue follows the listing, not the name, so two entities that share a name still differ.
    const hue = HUES[mix(hash(listingId) ^ 0x9e3779b9) % HUES.length], hue2 = (hue + 22) % 360;
    const bgA = `hsl(${hue} 32% ${L(19, 90)}%)`, bgB = `hsl(${hue2} 26% ${L(10, 81)}%)`;
    const body = `hsl(${hue} 50% ${L(58, 60)}%)`, edge = `hsl(${hue2} 48% ${L(50, 54)}%)`;
    const letter = initials(name, 1);
    // Small drops sit on the outer silhouette, spaced apart, so the filter swells the stroke there.
    // A small tilt either way, so the letter sits loose rather than upright.
    const slant = (r() < 0.5 ? -1 : 1) * (4 + r() * 5);
    const { edge: rim, ink } = silhouetteEdge(letter, slant);
    // Each blob is drawn white into a goo-filtered mask, then filled with one gradient, so it shades as a
    // single body rather than as the circles that built it.
    const blob = (key, shapes, box, angle) => {
      const [x0, y0, x1, y1] = box;
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, h = Math.max(x1 - x0, y1 - y0) / 2;
      const gx = Math.cos(angle) * h, gy = Math.sin(angle) * h;
      return `<linearGradient id="${id}${key}g" gradientUnits="userSpaceOnUse" x1="${(mx - gx).toFixed(1)}" y1="${(my - gy).toFixed(1)}" x2="${(mx + gx).toFixed(1)}" y2="${(my + gy).toFixed(1)}"><stop offset="0" stop-color="${body}"/><stop offset="1" stop-color="${edge}"/></linearGradient>
        <mask id="${id}${key}m"><g filter="url(#${id})" fill="white" stroke="white">${shapes}</g></mask>
        <rect width="200" height="300" fill="url(#${id}${key}g)" mask="url(#${id}${key}m)"/>`;
    };
    // Drops sit only on the letter's outermost points, spaced apart, so a swell never bridges its curves.
    const xs = rim.map(([x]) => x), ys = rim.map(([, y]) => y);
    const [bx0, bx1, by0, by1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    // The letter's convex hull: empty pixels inside it are its counters and mouths, which a drop must not reach.
    const hull = (() => {
      const pts = [...rim].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lo = [], hi = [];
      for (const p of pts) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
      for (const p of pts.reverse()) { while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
      return lo.slice(0, -1).concat(hi.slice(0, -1));
    })();
    const inHull = (x, y) => hull.every((p, k) => {
      const q = hull[(k + 1) % hull.length];
      return (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]) >= 0;
    });
    // A few hits are rounding along the hull's own edge; more means the drop reaches into a gap.
    const fillsGap = (x, y, R) => {
      let hits = 0;
      for (let a = -R; a <= R; a += 2) for (let b = -R; b <= R; b += 2) {
        const i = Math.round(x + a), j = Math.round(y + b);
        if (a * a + b * b <= R * R && !ink(i, j) && inHull(i, j)) hits++;
      }
      return hits > 4;
    };
    const tips = rim.filter(([x, y]) => x - bx0 < 6 || bx1 - x < 6 || y - by0 < 6 || by1 - y < 6);
    let letterShapes = `<text x="100" y="236" text-anchor="middle" font-family="var(--app-font), sans-serif" font-weight="800" font-size="118" stroke-width="2" stroke-linejoin="round" transform="rotate(${slant.toFixed(1)} 100 195)">${letter}</text>`;
    const placed = [];
    const n = 3 + Math.floor(r() * 2);
    for (let tries = 0; placed.length < n && tries < 200 && tips.length; tries++) {
      const [x, y] = tips[Math.floor(r() * tips.length)];
      const R = 10 + r() * 5;
      // The goo blur spreads a drop about 4 px past its radius, so the gap check covers that too.
      if (placed.some(([a, b]) => Math.hypot(a - x, b - y) < 40) || fillsGap(x, y, R + 4)) continue;
      placed.push([x, y]);
      letterShapes += `<circle cx="${x}" cy="${y}" r="${R.toFixed(1)}" stroke="none"/>`;
    }
    let art = blob('L', letterShapes, [50, 140, 150, 245], Math.PI / 2 + (r() - 0.5) * 0.6);
    // Clusters in the open space: clear of the letter, the name scrim at the top, and the frame edge.
    const inkNear = (x, y, d) => {
      for (let a = -d; a <= d; a += 4) for (let b = -d; b <= d; b += 4) {
        if (a * a + b * b <= d * d && ink(Math.round(x + a), Math.round(y + b))) return true;
      }
      return false;
    };
    // An irregular round body: a radius wobbled by a few low harmonics, stretched and turned.
    const lump = (x, y, R) => {
      const h = [0.08 + r() * 0.1, 0.05 + r() * 0.08, 0.02 + r() * 0.05], p = [r() * 6.3, r() * 6.3, r() * 6.3];
      const stretch = 0.7 + r() * 0.6, spin = r() * Math.PI;
      let d = '';
      for (let k = 0; k < 40; k++) {
        const t = (k / 40) * Math.PI * 2;
        const rad = R * (1 + h[0] * Math.sin(2 * t + p[0]) + h[1] * Math.sin(3 * t + p[1]) + h[2] * Math.sin(5 * t + p[2]));
        const lx = Math.cos(t) * rad * stretch, ly = Math.sin(t) * rad;
        d += `${k ? 'L' : 'M'}${(x + lx * Math.cos(spin) - ly * Math.sin(spin)).toFixed(1)} ${(y + lx * Math.sin(spin) + ly * Math.cos(spin)).toFixed(1)}`;
      }
      return `<path d="${d}Z"/>`;
    };
    // A cluster as circles first (a lump counts as its bounding circle), so placement checks every part.
    const geometry = (kind, cx, cy, size, turn) => {
      if (kind === 'puddle') return [{ x: cx, y: cy, r: 17 * size, lump: true }];
      if (kind === 'split') {
        const gap = 19 * size;
        return [
          { x: cx - Math.cos(turn) * gap * 0.4, y: cy - Math.sin(turn) * gap * 0.4, r: 13 * size, lump: true },
          { x: cx + Math.cos(turn) * gap * 0.6, y: cy + Math.sin(turn) * gap * 0.6, r: 8 * size, lump: true },
        ];
      }
      // A drip: a tapering trail along a gentle curve.
      const steps = 9 + Math.floor(r() * 3), bend = (r() - 0.5) * 0.3, step = 6.5 * size;
      const parts = [];
      let a = turn, x = cx - Math.cos(turn) * step * (steps - 1) / 2, y = cy - Math.sin(turn) * step * (steps - 1) / 2;
      for (let k = 0; k < steps; k++) {
        parts.push({ x, y, r: (12 - k * (8 / steps)) * size });
        x += Math.cos(a) * step; y += Math.sin(a) * step; a += bend;
      }
      return parts;
    };
    // Each card deals its kinds from a shuffled deck, so a card mixes kinds rather than rolling three puddles.
    const deck = ['puddle', 'split'].sort(() => r() - 0.5);
    deck.push(deck[Math.floor(r() * 2)]);
    const clusterCount = 2 + Math.floor(r() * 2);
    const taken = [], kinds = [];
    for (let slot = 0; kinds.length < clusterCount && slot < 3; slot++) {
      const kind = deck[slot];
      for (let tries = 0; tries < 250; tries++) {
        const size = 0.75 + r() * 0.5, turn = r() * Math.PI * 2;
        const cx = 30 + r() * 140, cy = 100 + r() * 175;
        const parts = geometry(kind, cx, cy, size, turn);
        // A wide letter leaves less room, so the gaps relax once the roomy spots run out.
        const gapInk = tries < 150 ? 24 : 16, gapBlob = tries < 150 ? 22 : 14;
        const fits = parts.every((c) =>
          c.x - c.r > 8 && c.x + c.r < 192 && c.y - c.r > 96 && c.y + c.r < 292
          && !inkNear(c.x, c.y, c.r + gapInk)
          && taken.every((o) => Math.hypot(o.x - c.x, o.y - c.y) > o.r + c.r + gapBlob));
        if (!fits) continue;
        taken.push(...parts); kinds.push(kind);
        const shapes = parts.map((c) => (c.lump ? lump(c.x, c.y, c.r) : `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${c.r.toFixed(1)}"/>`)).join('');
        const xs = parts.map((c) => c.x), ys = parts.map((c) => c.y), pad = Math.max(...parts.map((c) => c.r));
        art += blob(`C${kinds.length}`, shapes, [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad], Math.PI / 4 + (r() - 0.5));
        break;
      }
    }
    const clusters = kinds;
    window.__clusterCounts = { ...(window.__clusterCounts || {}), [`${name} #${listingId.slice(-4)}`]: `hue ${hue} ${clusters.length}/${clusterCount} ${kinds.join(',')}` };
    return `<svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bgA}"/><stop offset="1" stop-color="${bgB}"/></linearGradient>
      <filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -9"/></filter></defs>
      <rect width="200" height="300" fill="url(#${id}bg)"/>
      ${art}
    </svg>`;
  };

  const SHAPES = [
    'M100 110a32 32 0 1 1 0.1 0ZM40 300q0-120 60-120t60 120Z',
    'M100 118a28 28 0 1 1 0.1 0ZM20 300q5-115 80-115t80 115Z',
    'M100 108a26 26 0 1 1 0.1 0ZM100 150l-55 150h110Z',
    'M30 300q-10-110 70-130q80 20 70 130Z M70 225a8 8 0 1 1 0.1 0Z M130 225a8 8 0 1 1 0.1 0Z',
    'M100 170a24 24 0 1 1 0.1 0ZM62 300q0-80 38-80t38 80Z',
  ];
  const silhouette = (name) => {
    const r = rng(hash(name)); const id = `sil${uid++}`;
    const hue = Math.floor(r() * 360);
    const shape = SHAPES[Math.floor(r() * SHAPES.length)];
    return `<svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 28% ${L(24, 88)}%)"/><stop offset="1" stop-color="hsl(${hue} 30% ${L(11, 74)}%)"/></linearGradient></defs>
      <rect width="200" height="300" fill="url(#${id})"/>
      <path d="${shape}" fill="hsl(${hue} 30% ${L(42, 60)}%)" fill-rule="evenodd" transform="translate(0 20)"/>
    </svg>`;
  };

  const monogram = (name) => {
    const r = rng(hash(name)); const id = `mono${uid++}`;
    const hue = Math.floor(r() * 360), hue2 = (hue + 40 + r() * 60) % 360;
    let rings = '';
    for (let i = 1; i <= 5; i++) rings += `<circle cx="100" cy="195" r="${i * 26}" fill="none" stroke="white" stroke-opacity="${0.08 - i * 0.012}" stroke-width="2"/>`;
    return `<svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 42% ${L(34, 66)}%)"/><stop offset="1" stop-color="hsl(${hue2} 42% ${L(20, 54)}%)"/></linearGradient></defs>
      <rect width="200" height="300" fill="url(#${id})"/>${rings}
      <text x="100" y="218" text-anchor="middle" font-family="var(--app-font), sans-serif" font-weight="700" font-size="64" letter-spacing="2" fill="rgba(255,255,255,0.9)">${initials(name, 2)}</text>
    </svg>`;
  };

  const draw = { morph, silhouette, monogram }[style];
  // The server stand-in is a 400x400 PNG: a light head on a dark field.
  const isPlaceholder = (img) => {
    if (img.naturalWidth !== 400 || img.naturalHeight !== 400) return false;
    const c = document.createElement('canvas'); c.width = c.height = 400;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const [hr, hg, hb] = x.getImageData(200, 130, 1, 1).data, [br, bg, bb] = x.getImageData(10, 10, 1, 1).data;
    return hr + hg + hb > 300 && br + bg + bb < 200 && hb > hr;
  };
  const grid = [...document.querySelectorAll('div.grid')].find((g) => g.className.includes('xl:grid-cols-3'));
  const replaced = [];
  for (const card of grid.children) {
    const art = card.querySelector(':scope > .group');
    const img = art && art.querySelector(':scope > img');
    const name = card.querySelector('h3')?.textContent ?? '';
    if (!img || !(allBlank || isPlaceholder(img))) continue;
    // The listing id, read off the card's React props: the DOM carries no id of its own.
    const fiberKey = Object.keys(card).find((k) => k.startsWith('__reactFiber$'));
    let fiber = card[fiberKey], listingId = '';
    while (fiber && !listingId) { const w = fiber.memoizedProps?.world; listingId = w ? String(w._id ?? w.id ?? '') : ''; fiber = fiber.return; }
    const holder = document.createElement('div');
    holder.className = 'w-full h-full';
    holder.innerHTML = draw(name, listingId || name);
    img.replaceWith(holder);
    replaced.push(name);
  }
  return replaced;
};
