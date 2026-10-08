import { TransitionSeries } from '@remotion/transitions';
import { Fragment, type ReactNode } from 'react';
import { Composition, Folder } from 'remotion';
import { CANVAS, type Layout } from './layout';
import type { CameraPath, CameraStop } from './parts/FrameCamera';
import { FrameScene } from './scenes/FrameScene';
import { KineticText } from './scenes/KineticText';
import { StackScene } from './scenes/StackScene';
import { TypedNarration } from './scenes/TypedNarration';
import { SHOTS } from './shots';
import { FPS } from './timeline';
import { joinElement, overlapFrames, type TransitionName } from './transitions';

type LibraryEntry = {
  id: string;
  durationInFrames: number;
  render: (layout: Layout, durationInFrames: number) => ReactNode;
};

const stop = (focusX: number, focusY: number, zoom = 1): CameraStop => ({ focusX, focusY, zoom });
const move = (from: CameraStop, to: CameraStop, via?: CameraStop[]): CameraPath => ({ from, to, via });
const hold = (at: CameraStop): CameraPath => move(at, at);
/** The same path in both layouts. */
const both = (path: CameraPath) => ({ wide: path, tall: path });

const JOIN_SCENE_FRAMES = 90;

/** Two kinetic cards joined by one transition, to review the join. */
const joinEntry = (name: TransitionName): LibraryEntry => ({
  id: `Transition-${name}`,
  durationInFrames: JOIN_SCENE_FRAMES * 2 - overlapFrames(name, FPS),
  render: (layout) => {
    const cards = [
      { id: 'a', lines: ['Type any action.'] as const, plate: SHOTS.library },
      { id: 'b', lines: ['Play any world.'] as const, plate: SHOTS.game },
    ];
    return (
      <TransitionSeries>
        {cards.map((card, i) => (
          <Fragment key={card.id}>
            {i > 0 && joinElement(name)}
            <TransitionSeries.Sequence durationInFrames={JOIN_SCENE_FRAMES}>
              <KineticText layout={layout} durationInFrames={JOIN_SCENE_FRAMES} lines={card.lines} plate={card.plate} />
            </TransitionSeries.Sequence>
          </Fragment>
        ))}
      </TransitionSeries>
    );
  },
});

/** Every scene type and transition, with sample copy from the storyboard. The studio lists each in both layouts. */
const ENTRIES: LibraryEntry[] = [
  {
    id: 'KineticText',
    durationInFrames: 150,
    render: (layout, durationInFrames) => (
      <KineticText layout={layout} durationInFrames={durationInFrames} lines={['Build your own world.']} plate={SHOTS.library} />
    ),
  },
  {
    id: 'KineticText-TwoLines',
    durationInFrames: 180,
    render: (layout, durationInFrames) => (
      <KineticText
        layout={layout}
        durationInFrames={durationInFrames}
        lines={['An AI text RPG.', 'Play any world you can imagine.']}
        plate={SHOTS.game}
      />
    ),
  },
  {
    id: 'FrameScene-Pan',
    durationInFrames: 240,
    render: (layout, durationInFrames) => (
      <FrameScene
        layout={layout}
        durationInFrames={durationInFrames}
        shot={SHOTS.library}
        caption={['Play any world you can imagine.']}
        camera={{ wide: move(stop(0.3, 0.5, 1.2), stop(0.7, 0.5, 1.2)), tall: move(stop(0.2, 0.5), stop(0.8, 0.5)) }}
      />
    ),
  },
  {
    id: 'FrameScene-ZoomCallout',
    durationInFrames: 240,
    render: (layout, durationInFrames) => (
      <FrameScene
        layout={layout}
        durationInFrames={durationInFrames}
        shot={SHOTS.game}
        caption={['Every turn updates your stats.']}
        callout={{ region: { x: 0.745, y: 0.205, width: 0.24, height: 0.37 } }}
        camera={{ wide: move(stop(0.5, 0.5), stop(0.8, 0.4, 1.7)), tall: move(stop(0.5, 0.5), stop(0.85, 0.4, 1.2)) }}
      />
    ),
  },
  {
    id: 'FrameScene-TwoStage',
    durationInFrames: 300,
    render: (layout, durationInFrames) => (
      <FrameScene
        layout={layout}
        durationInFrames={durationInFrames}
        shot={SHOTS.game}
        camera={both(move(stop(0.5, 0.5), stop(0.5, 0.35, 1.5), [stop(0.5, 0.95, 1.5)]))}
      />
    ),
  },
  {
    id: 'FrameScene-Hold',
    durationInFrames: 150,
    render: (layout, durationInFrames) => (
      <FrameScene layout={layout} durationInFrames={durationInFrames} shot={SHOTS.game} camera={both(hold(stop(0.5, 0.5)))} />
    ),
  },
  {
    id: 'StackScene',
    durationInFrames: 240,
    render: (layout, durationInFrames) => (
      <StackScene
        layout={layout}
        durationInFrames={durationInFrames}
        panes={[
          { shot: SHOTS.game, camera: move(stop(0.8, 0.45), stop(0.8, 0.45, 1.3)), caption: 'Every turn updates your stats.' },
          { shot: SHOTS.library, camera: move(stop(0.3, 0.5), stop(0.7, 0.5)), caption: 'Play any world you can imagine.' },
        ]}
      />
    ),
  },
  {
    id: 'TypedNarration',
    durationInFrames: 240,
    render: (layout, durationInFrames) => (
      <TypedNarration
        layout={layout}
        durationInFrames={durationInFrames}
        prompt="Write any action."
        narration="The narrator continues the story."
      />
    ),
  },
  {
    id: 'TypedNarration-Backdrop',
    durationInFrames: 240,
    render: (layout, durationInFrames) => (
      <TypedNarration
        layout={layout}
        durationInFrames={durationInFrames}
        prompt="Write any action."
        narration="The narrator continues the story."
        backdrop={{
          before: SHOTS.library,
          after: SHOTS.game,
          camera: { wide: move(stop(0.5, 0.5, 1.25), stop(0.5, 0.5)), tall: move(stop(0.5, 0.5, 1.1), stop(0.5, 0.5)) },
        }}
      />
    ),
  },
  joinEntry('cut'),
  joinEntry('fade'),
  joinEntry('wipe'),
];

const LAYOUTS: Layout[] = ['wide', 'tall'];

type LibraryPreviewProps = { entryId: string; layout: Layout };

const LibraryPreview = ({ entryId, layout }: LibraryPreviewProps) => {
  const entry = ENTRIES.find((item) => item.id === entryId);
  if (!entry) throw new Error(`No library entry "${entryId}"`);
  return <>{entry.render(layout, entry.durationInFrames)}</>;
};

/** The studio's "Scene-library" folder: one composition per entry and layout. */
export const SceneLibrary = () => (
  <Folder name="Scene-library">
    {ENTRIES.flatMap((entry) =>
      LAYOUTS.map((layout) => (
        <Composition
          key={`${entry.id}-${layout}`}
          id={`${entry.id}-${layout}`}
          component={LibraryPreview}
          defaultProps={{ entryId: entry.id, layout }}
          fps={FPS}
          durationInFrames={entry.durationInFrames}
          {...CANVAS[layout]}
        />
      )),
    )}
  </Folder>
);
