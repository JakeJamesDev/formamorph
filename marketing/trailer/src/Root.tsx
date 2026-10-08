import { Composition } from 'remotion';
import { CANVAS, type Layout } from './layout';
import { FPS, TOTAL_FRAMES } from './timeline';
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
        defaultProps={{ layout }}
        fps={FPS}
        durationInFrames={TOTAL_FRAMES}
        {...CANVAS[layout]}
      />
    ))}
  </>
);
