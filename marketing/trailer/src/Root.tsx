import { Composition } from 'remotion';
import { CANVAS, type Layout } from './layout';
import { SceneLibrary } from './library';
import { FPS, readingReport, totalFrames } from './timeline';
import { Trailer } from './Trailer';

const CUTS: { id: string; layout: Layout }[] = [
  { id: 'TrailerWide', layout: 'wide' },
  { id: 'TrailerTall', layout: 'tall' },
];

export const Root = () => (
  <>
    {CUTS.map(({ id, layout }) => (
      <Composition
        key={id}
        id={id}
        component={Trailer}
        defaultProps={{ layout, reading: readingReport(layout) }}
        fps={FPS}
        durationInFrames={totalFrames(layout)}
        {...CANVAS[layout]}
      />
    ))}
    <SceneLibrary />
  </>
);
