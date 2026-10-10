import { TransitionSeries } from '@remotion/transitions';
import { Fragment } from 'react';
import type { CameraReading } from './framing';
import type { DenseReading } from './holds';
import type { Layout } from './layout';
import { Stage } from './parts/Stage';
import type { LineReading } from './reading';
import { TIMELINES } from './timeline';

/** `reading`, `dense` and `camera` are the cut's reports, carried in the props so the render check can read them from the composition. */
type TrailerProps = { layout: Layout; reading: LineReading[]; dense: DenseReading[]; camera: CameraReading[] };

/** Plays one cut's scene list in its layout over one continuous stage. Each scene's join overlaps it with the next. */
export const Trailer = ({ layout }: TrailerProps) => {
  const scenes = TIMELINES[layout];
  return (
    <>
      <Stage layout={layout} />
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
    </>
  );
};
