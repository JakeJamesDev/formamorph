import { TransitionSeries } from '@remotion/transitions';
import { Fragment } from 'react';
import type { Layout } from './layout';
import { SCENES } from './timeline';
import { sceneTransition } from './transitions';

/** Plays the shared scene list in one layout. */
export const Trailer = ({ layout }: { layout: Layout }) => (
  <TransitionSeries>
    {SCENES.map((scene, i) => (
      <Fragment key={scene.id}>
        {i > 0 && <TransitionSeries.Transition presentation={sceneTransition.presentation} timing={sceneTransition.timing} />}
        <TransitionSeries.Sequence durationInFrames={scene.durationInFrames} name={scene.id}>
          {scene.render({ layout, durationInFrames: scene.durationInFrames })}
        </TransitionSeries.Sequence>
      </Fragment>
    ))}
  </TransitionSeries>
);
