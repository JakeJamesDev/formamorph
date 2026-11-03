import { useId, type RefObject } from 'react';
import { mascotAssetUrl } from '@/lib/formaquestion/mascotAssets';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import type { SupporterTier } from '@/types';
import { FIRE_LIGHT, RoadFire } from './RoadFire';
import { ROAD_LEVELS, roadLevel } from './roadLevels';

const STAGE = { width: 920, height: 400 };
// Where the fire stands.
const FIRE_FOOT = { x: 420, y: 372 };
// How far above the fire's foot the light centers, as a share of the fire's width.
const LIGHT_LIFT = 0.6;
// The stage's bottom edge on Morphie's box, which runs past it: she stands there.
const MORPHIE_ORIGIN_Y = '78.25%';
// The story moments, newest first, running left from the fire.
const ROAD = [[320, 300], [292, 262], [262, 244], [232, 256], [202, 288], [172, 306], [142, 296], [112, 262], [84, 232], [58, 234], [34, 262], [12, 292]];
const ROAD_POINTS = [[FIRE_FOOT.x - 40, FIRE_FOOT.y - 14], ...ROAD].map((point) => point.join(',')).join(' ');
const UNLIT = '#5d6070';

const percentOf = (value: number, whole: number) => `${(value / whole) * 100}%`;

/** Morphie, whatever the player's active Mascot: every level's look stays mounted, so a swap draws at once. */
function MorphieLooks({ tier }: { tier: SupporterTier }) {
  return (
    <div className="relative" role="img" aria-label="Morphie">
      <img src={mascotAssetUrl('base')} alt="" draggable={false} className="block h-auto w-full select-none" />
      {ROAD_LEVELS.map((level) => (
        <div key={level.tier} data-look={level.tier} hidden={level.tier !== tier} className="absolute inset-0">
          {level.look.map((name) => (
            <img key={name} data-layer={name} src={mascotAssetUrl(name)} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** The road, the fire at its newest moment and Morphie watching it, for one level. `morphieRef` takes the Jelly. */
export function RoadStage({ tier, morphieRef }: { tier: SupporterTier; morphieRef: RefObject<HTMLDivElement | null> }) {
  const level = roadLevel(tier);
  const lightId = useId();
  const reduced = usePrefersReducedMotion();
  return (
    <div data-road-stage className="relative w-full overflow-hidden rounded-xl bg-[#0a0b16]" style={{ aspectRatio: `${STAGE.width} / ${STAGE.height}` }}>
      <svg
        viewBox={`0 0 ${STAGE.width} ${STAGE.height}`}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="A fire lighting a road"
      >
        <defs>
          <radialGradient id={lightId}>
            <stop offset="0%" stopColor={FIRE_LIGHT} stopOpacity=".5" />
            <stop offset="65%" stopColor={FIRE_LIGHT} stopOpacity=".14" />
            <stop offset="100%" stopColor={FIRE_LIGHT} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle
          data-light
          cx={FIRE_FOOT.x}
          cy={FIRE_FOOT.y - level.fireWidth * LIGHT_LIFT}
          r={level.lightRadius}
          fill={`url(#${lightId})`}
          style={reduced ? undefined : { transition: 'r .6s ease, cy .6s ease' }}
        />
        <polyline points={ROAD_POINTS} fill="none" stroke="#8a8d9c" strokeWidth="3" strokeDasharray="2 11" strokeLinecap="round" opacity=".6" />
        {ROAD.map(([x, y], index) => {
          const lit = index < level.lit;
          return (
            <circle
              key={x}
              data-moment
              data-lit={lit}
              cx={x}
              cy={y}
              r={lit ? 9 : 6}
              fill={lit ? FIRE_LIGHT : UNLIT}
              opacity={lit ? 1 : 0.45}
              style={reduced ? undefined : { transition: 'r .4s, fill .4s, opacity .5s', transitionDelay: `${index * 40}ms` }}
            />
          );
        })}
      </svg>
      <div className="absolute right-0 top-[3.5%] w-[40.2%]">
        <div ref={morphieRef} data-morphie style={{ transformOrigin: `50% ${MORPHIE_ORIGIN_Y}` }}>
          <MorphieLooks tier={tier} />
        </div>
      </div>
      <div
        className="absolute"
        style={{
          left: percentOf(FIRE_FOOT.x - level.fireWidth / 2, STAGE.width),
          bottom: percentOf(STAGE.height - FIRE_FOOT.y, STAGE.height),
          width: percentOf(level.fireWidth, STAGE.width),
        }}
      >
        <RoadFire tier={tier} />
      </div>
    </div>
  );
}
