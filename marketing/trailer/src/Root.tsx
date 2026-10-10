import { Composition } from 'remotion';
import { CANVAS, FPS, type Layout } from './layout';
import { SceneLibrary } from './library';
import { SheetCompositions } from './sheet';
import { cameraReport, denseReport, readingReport, totalFrames } from './timeline';
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
        defaultProps={{ layout, reading: readingReport(layout), dense: denseReport(layout), camera: [] }}
        // The subject check measures laid-out copy, so the camera report fills in once the browser has the fonts.
        calculateMetadata={async ({ props }) => ({ props: { ...props, camera: await cameraReport(layout) } })}
        fps={FPS}
        durationInFrames={totalFrames(layout)}
        {...CANVAS[layout]}
      />
    ))}
    <SceneLibrary />
    <SheetCompositions />
  </>
);
