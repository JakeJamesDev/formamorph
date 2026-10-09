import { TransitionSeries } from '@remotion/transitions';
import { Fragment } from 'react';
import type { Layout } from './layout';
import type { LineReading } from './reading';
import { TIMELINES } from './timeline';

/** `reading` is the cut's reading report, carried in the props so the render check can read it from the composition. */
type TrailerProps = { layout: Layout; reading: LineReading[] };

/** Plays one cut's scene list in its layout. Each scene's join overlaps it with the next. */
export const Trailer = ({ layout }: TrailerProps) => {
  const scenes = TIMELINES[layout];
  return (
    <TransitionSeries>
      {scenes.map((scene, i) => {
        const join = scenes[i - 1]?.join;
        return (
          <Fragment key={scene.id}>
            {join?.element}
            <TransitionSeries.Sequence durationInFrames={scene.durationInFrames} name={scene.id}>
              {scene.render({ layout, durationInFrames: scene.durationInFrames })}
            </TransitionSeries.Sequence>
          </Fragment>
        );
      })}
    </TransitionSeries>
  );
};
