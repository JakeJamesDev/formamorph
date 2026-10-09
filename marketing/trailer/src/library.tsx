import { TransitionSeries } from '@remotion/transitions';
import { Fragment, type ReactNode } from 'react';
import { Composition, Folder } from 'remotion';
import { CANVAS, type Layout } from './layout';
import type { CameraPath, CameraStop } from './parts/FrameCamera';
import { Stage } from './parts/Stage';
import { FrameScene } from './scenes/FrameScene';
import { KineticText } from './scenes/KineticText';
import { StackScene } from './scenes/StackScene';
import { TypedTurn } from './scenes/TypedTurn';
import { WordmarkTitle } from './scenes/WordmarkTitle';
import { SHOTS, TURN_PROMPT } from './shots';
import { FPS } from './timeline';
import { joinElement, overlapFrames, type TransitionName } from './transitions';

type LibraryEntry = {
  id: string;
  durationInFrames: number;
  render: (layout: Layout, durationInFrames: number) => ReactNode;
};

const stop = (focusX: number, focusY: number, zoom = 1): CameraStop => ({ focusX, focusY, zoom });
const hold = (at: CameraStop): CameraPath => ({ from: at, to: at });
/** The same path in both layouts. */
const both = (path: CameraPath) => ({ wide: path, tall: path });

const JOIN_SCENE_FRAMES = 90;

/** Two kinetic cards joined by one transition, to review the join. */
const joinEntry = (name: TransitionName): LibraryEntry => ({
  id: `Transition-${name}`,
  durationInFrames: JOIN_SCENE_FRAMES * 2 - overlapFrames(name, FPS),
  render: (layout) => {
    const cards = [
      { id: 'a', lines: ['Type any action.'] as const },
      { id: 'b', lines: ['Play any world.'] as const },
    ];
    return (
      <TransitionSeries>
        {cards.map((card, i) => (
          <Fragment key={card.id}>
            {i > 0 && joinElement(name)}
            <TransitionSeries.Sequence durationInFrames={JOIN_SCENE_FRAMES}>
              <KineticText layout={layout} durationInFrames={JOIN_SCENE_FRAMES} lines={card.lines} />
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
      <KineticText layout={layout} durationInFrames={durationInFrames} lines={['Build your own world.']} />
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
      />
    ),
  },
  {
    id: 'FrameScene-Hold',
    durationInFrames: 240,
    render: (layout, durationInFrames) => (
      <FrameScene
        layout={layout}
        durationInFrames={durationInFrames}
        shot={SHOTS.library}
        depth={SHOTS.game}
        caption={['An AI text RPG.', 'Play any world you can imagine.']}
        camera={both(hold(stop(0.5, 0.5)))}
      />
    ),
  },
  {
    id: 'FrameScene-CropCallout',
    durationInFrames: 240,
    render: (layout, durationInFrames) => (
      <FrameScene
        layout={layout}
        durationInFrames={durationInFrames}
        shot={SHOTS.game}
        depth={SHOTS.entity}
        caption={['Every turn updates your stats.']}
        callout={{ region: { x: 0.745, y: 0.205, width: 0.24, height: 0.37 } }}
        camera={{ wide: hold(stop(0.72, 0.38, 1.8)), tall: hold(stop(0.85, 0.4, 1.2)) }}
      />
    ),
  },
  {
    id: 'FrameScene-Clip',
    durationInFrames: 180,
    render: (layout, durationInFrames) => (
      <FrameScene
        layout={layout}
        durationInFrames={durationInFrames}
        shot={SHOTS.avatarClip}
        depth={SHOTS.entity}
        caption={['Pick a 3D avatar.']}
        dot="rose"
        camera={both(hold(stop(0.5, 0.5)))}
      />
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
          { shot: SHOTS.game, camera: hold(stop(0.8, 0.45, 1.3)), caption: ['Every turn updates your stats.'], dot: 'mint' },
          { shot: SHOTS.library, camera: hold(stop(0.5, 0.5)), caption: ['Play any world you can imagine.'], dot: 'purple' },
        ]}
      />
    ),
  },
  {
    id: 'TypedTurn',
    durationInFrames: 360,
    render: (layout, durationInFrames) => (
      <TypedTurn
        layout={layout}
        durationInFrames={durationInFrames}
        clip={{ wide: SHOTS.narrationClip, tall: SHOTS.narrationClipTall }}
        camera={{ wide: hold(stop(0.5, 0.32, 1.5)), tall: hold(stop(0.5, 0)) }}
        prompt={TURN_PROMPT}
        caption="The narrator continues the story."
      />
    ),
  },
  {
    id: 'WordmarkTitle',
    durationInFrames: 90,
    render: (layout, durationInFrames) => <WordmarkTitle layout={layout} durationInFrames={durationInFrames} />,
  },
  joinEntry('cut'),
  joinEntry('overlap'),
  joinEntry('section'),
];

const LAYOUTS: Layout[] = ['wide', 'tall'];

type LibraryPreviewProps = { entryId: string; layout: Layout };

const LibraryPreview = ({ entryId, layout }: LibraryPreviewProps) => {
  const entry = ENTRIES.find((item) => item.id === entryId);
  if (!entry) throw new Error(`No library entry "${entryId}"`);
  return (
    <>
      <Stage layout={layout} />
      {entry.render(layout, entry.durationInFrames)}
    </>
  );
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
