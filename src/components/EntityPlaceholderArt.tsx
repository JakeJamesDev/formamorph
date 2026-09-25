import { useEffect, useId, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { fontReady, letterMask, whenFontReady } from '@/lib/letterMask';
import {
  MORPH_FRAME, MORPH_GOO, MORPH_LETTER, generateMorphArt, morphHue, morphLetter, morphPalette,
  type MorphArt, type MorphGradient,
} from '@/lib/placeholderArt';

/** What the art reads off the page: the app font and the applied theme. */
interface Surroundings {
  font: string;
  dark: boolean;
}

let surroundings: Surroundings | null = null;
const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;

function readSurroundings(): Surroundings {
  const html = document.documentElement;
  const font = getComputedStyle(html).getPropertyValue('--app-font').trim() || 'sans-serif';
  const dark = html.classList.contains('dark');
  if (!surroundings || surroundings.font !== font || surroundings.dark !== dark) surroundings = { font, dark };
  return surroundings;
}

// One observer for every card: the Font setting writes `--app-font` to <html>, and the theme writes its class.
function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (!observer) {
    observer = new MutationObserver(() => {
      const before = surroundings;
      if (readSurroundings() !== before) listeners.forEach((listener) => listener());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    readSurroundings();
  }
  return () => {
    listeners.delete(onChange);
    if (!listeners.size) {
      observer?.disconnect();
      observer = null;
    }
  };
}

// With no observer running, the held value may be stale.
const getSurroundings = () => (observer && surroundings) || readSurroundings();

// A grid, its folder faces and the drag ghost draw the same entity many times over.
const ART_CACHE_LIMIT = 256;
const artCache = new Map<string, MorphArt>();

function artFor(idSeed: string, name: string, letter: string, font: string): MorphArt {
  const key = `${idSeed}\u0000${name}\u0000${font}`;
  const known = artCache.get(key);
  if (known) {
    artCache.delete(key);
    artCache.set(key, known);
    return known;
  }
  const art = generateMorphArt({
    idSeed, nameSeed: name, letter, readMask: (char, tilt) => letterMask(char, font, tilt),
  });
  // Art measured in a fallback face is right for now but wrong once the real font arrives.
  if (!fontReady(letter, font)) return art;
  artCache.set(key, art);
  if (artCache.size > ART_CACHE_LIMIT) artCache.delete(artCache.keys().next().value as string);
  return art;
}

const { width: W, height: H } = MORPH_FRAME;
const GOO_MATRIX = `1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${MORPH_GOO.alphaScale} ${MORPH_GOO.alphaOffset}`;

const pathOf = (points: Array<[number, number]>) =>
  `${points.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')}Z`;

/** One shape: drawn in white inside a goo-filtered mask, and filled by one gradient sized to it. */
function Shape({ id, goo, gradient, body, edge, children }: {
  id: string;
  goo: string;
  gradient: MorphGradient;
  body: string;
  edge: string;
  children: ReactNode;
}) {
  return (
    <>
      <linearGradient id={`${id}g`} gradientUnits="userSpaceOnUse" {...gradient}>
        <stop offset="0" stopColor={body} />
        <stop offset="1" stopColor={edge} />
      </linearGradient>
      <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
        <g filter={`url(#${goo})`} fill="white" stroke="white">{children}</g>
      </mask>
      <rect width={W} height={H} fill={`url(#${id}g)`} mask={`url(#${id}m)`} />
    </>
  );
}

/**
 * Morph art for an entity with no picture. Fills its parent.
 *
 * @param sourceId - The listing the entity was downloaded from, which seeds the hue in place of `id`
 */
export function EntityPlaceholderArt({ id, sourceId, name, className }: {
  id: string;
  sourceId?: string;
  name: string;
  className?: string;
}) {
  const uid = `morph${useId().replace(/:/g, '')}`;
  const { font, dark } = useSyncExternalStore(subscribe, getSurroundings);
  const idSeed = sourceId || id;
  const letter = morphLetter(name);

  // The mask reads the letter's real pixels, so nothing is measured until the font can draw it.
  const fontKey = `${letter}\u0000${font}`;
  const [loaded, setLoaded] = useState<string | null>(null);
  const ready = loaded === fontKey || fontReady(letter, font);
  useEffect(() => {
    if (ready) return;
    let live = true;
    void whenFontReady(letter, font).then(() => { if (live) setLoaded(fontKey); });
    return () => { live = false; };
  }, [ready, letter, font, fontKey]);

  const art = useMemo(() => (ready ? artFor(idSeed, name, letter, font) : null), [ready, idSeed, name, letter, font]);
  const palette = morphPalette(morphHue(idSeed), dark);
  const { x, y, pivotX, pivotY, fontSize, fontWeight, strokeWidth } = MORPH_LETTER;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={cn('block h-full w-full select-none', className)}
      aria-hidden
      data-morph-art
    >
      <defs>
        <linearGradient id={`${uid}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={palette.background[0]} />
          <stop offset="1" stopColor={palette.background[1]} />
        </linearGradient>
        <filter id={`${uid}goo`} filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <feGaussianBlur stdDeviation={MORPH_GOO.blur} />
          <feColorMatrix values={GOO_MATRIX} />
        </filter>
      </defs>
      <rect width={W} height={H} fill={`url(#${uid}bg)`} />
      {art && (
        <>
          <Shape id={`${uid}L`} goo={`${uid}goo`} gradient={art.letter.gradient} body={palette.body} edge={palette.edge}>
            <text
              x={x}
              y={y}
              textAnchor="middle"
              style={{ fontFamily: font }}
              fontWeight={fontWeight}
              fontSize={fontSize}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              transform={`rotate(${art.letter.tilt} ${pivotX} ${pivotY})`}
            >
              {art.letter.char}
            </text>
            {art.letter.drops.map((drop, k) => (
              <circle key={k} cx={drop.x} cy={drop.y} r={drop.r} stroke="none" />
            ))}
          </Shape>
          {art.clusters.map((cluster, k) => (
            <Shape
              key={k}
              id={`${uid}C${k}`}
              goo={`${uid}goo`}
              gradient={cluster.gradient}
              body={palette.body}
              edge={palette.edge}
            >
              {cluster.lumps.map((lump, j) => <path key={j} d={pathOf(lump.points)} />)}
            </Shape>
          ))}
        </>
      )}
    </svg>
  );
}
