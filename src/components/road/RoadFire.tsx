import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import type { SupporterTier } from '@/types';

/** The fire's one light color, whatever the app's accent. */
export const FIRE_LIGHT = '#f4b24d';
const FIRE_DEEP = '#e4572e';
const FIRE_CORE = '#fff3cf';

// Three outlines with matching commands, so the shape can morph between them.
const FLAME_SHAPES = [
  'M50 4 C60 28 86 46 86 76 C86 102 68 118 50 118 C32 118 14 102 14 76 C14 60 26 50 32 34 C36 46 42 50 45 46 C49 34 44 18 50 4Z',
  'M57 2 C62 30 88 50 84 78 C82 102 66 118 50 118 C34 118 16 102 16 76 C16 58 30 52 30 38 C36 48 44 52 47 44 C52 32 51 16 57 2Z',
  'M43 8 C58 26 82 44 88 74 C90 100 70 118 50 118 C30 118 12 102 12 78 C12 62 22 48 36 30 C36 44 40 48 42 44 C44 32 37 20 43 8Z',
];
const FLAME_MORPH = [...FLAME_SHAPES, FLAME_SHAPES[0]].join(';');

type Ember = readonly [x: number, y: number, r: number];

const SPARK_EMBERS: readonly Ember[] = [[12, 24, 3.4], [88, 14, 3], [20, 86, 2.6], [92, 70, 3.2], [54, -6, 2.6]];
const FLAME_EMBERS: readonly Ember[] = [[18, 20, 2.8], [80, 8, 2.4], [90, 44, 2], [6, 52, 2.2], [60, -12, 2.2]];
const BEACON_EMBERS: readonly Ember[] = [[10, 16, 2.8], [90, 6, 2.6], [96, 50, 2.2], [2, 62, 2.2], [62, -14, 2.4], [34, -18, 2]];

function Embers({ embers, moving }: { embers: readonly Ember[]; moving: boolean }) {
  return embers.map(([x, y, r], index) => (
    <circle
      key={`${x}-${y}`}
      className={moving ? 'road-ember' : undefined}
      style={moving ? { animationDelay: `${index * 0.27}s`, animationDuration: `${1.4 + (index % 3) * 0.4}s` } : undefined}
      cx={x}
      cy={y}
      r={r}
      fill={FIRE_LIGHT}
    />
  ));
}

function Tongue({ scale, fill, dur, moving }: { scale: number; fill: string; dur: string; moving: boolean }) {
  return (
    <g transform={`translate(50 118) scale(${scale}) translate(-50 -118)`}>
      <path d={FLAME_SHAPES[0]} fill={fill}>
        {moving && (
          <animate attributeName="d" values={FLAME_MORPH} dur={dur} repeatCount="indefinite" calcMode="spline" keyTimes="0;.33;.66;1" keySplines=".4 0 .6 1;.4 0 .6 1;.4 0 .6 1" />
        )}
      </path>
    </g>
  );
}

function Tongues({ moving }: { moving: boolean }) {
  return (
    <>
      <Tongue scale={1} fill={FIRE_DEEP} dur="1.1s" moving={moving} />
      <Tongue scale={0.72} fill={FIRE_LIGHT} dur=".85s" moving={moving} />
      <Tongue scale={0.4} fill={FIRE_CORE} dur=".65s" moving={moving} />
    </>
  );
}

/** Each level's own fire, filling its box's width: a twinkling spark, layered tongues with embers, or a tall flame in a brazier with rays. */
export function RoadFire({ tier }: { tier: SupporterTier }) {
  const moving = !usePrefersReducedMotion();
  if (tier === 'supporter') {
    const twinkle = moving ? 'road-twinkle' : undefined;
    return (
      <svg data-fire={tier} viewBox="0 0 100 100" className="block w-full overflow-visible" aria-hidden="true">
        <Embers embers={SPARK_EMBERS} moving={moving} />
        <path className={twinkle} d="M50 8 L58 42 L92 50 L58 58 L50 92 L42 58 L8 50 L42 42Z" fill={FIRE_LIGHT} />
        <path className={twinkle} d="M50 28 L54 46 L72 50 L54 54 L50 72 L46 54 L28 50 L46 46Z" fill={FIRE_CORE} />
      </svg>
    );
  }
  if (tier === 'supporter_plus') {
    return (
      <svg data-fire={tier} viewBox="0 0 100 120" className="block w-full overflow-visible" aria-hidden="true">
        <Embers embers={FLAME_EMBERS} moving={moving} />
        <Tongues moving={moving} />
        <path d="M12 124 L88 110 M12 110 L88 124" stroke="#4a3a30" strokeWidth="9" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg data-fire={tier} viewBox="0 0 100 172" className="block w-full overflow-visible" aria-hidden="true">
      <g className={moving ? 'road-rays' : undefined} opacity=".3">
        {Array.from({ length: 10 }, (_, index) => (
          <path key={index} d="M45 62 L50 -70 L55 62Z" fill={FIRE_LIGHT} transform={`rotate(${index * 36 + 18} 50 62)`} />
        ))}
      </g>
      <Embers embers={BEACON_EMBERS} moving={moving} />
      <Tongues moving={moving} />
      <path d="M14 108 H86 L74 134 H26 Z" fill="#2b2733" stroke={FIRE_LIGHT} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M30 108 L36 134 M50 108 V134 M70 108 L64 134" stroke={FIRE_LIGHT} strokeWidth="2" opacity=".55" />
      <path d="M50 134 V168 M30 170 H70" stroke="#4a4552" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}
