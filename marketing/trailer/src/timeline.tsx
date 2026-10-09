import type { ReactNode } from 'react';
import type { Layout, SceneProps } from './layout';
import type { CameraPath, CameraStop } from './parts/FrameCamera';
import { FrameScene } from './scenes/FrameScene';
import { KineticText } from './scenes/KineticText';
import { PlateTitle } from './scenes/PlateTitle';
import { TitleCard } from './scenes/TitleCard';
import { TypedNarration } from './scenes/TypedNarration';
import { SHOTS } from './shots';
import { joinFor, sceneTransition, type Join, type TransitionName } from './transitions';

export const FPS = 60;

type SceneEntry = {
  id: string;
  durationInFrames: number;
  /** The join into the next scene. Absent on a cut and on the last scene. */
  join: Join | null;
  render: (props: SceneProps) => ReactNode;
};

const stop = (focusX: number, focusY: number, zoom = 1): CameraStop => ({ focusX, focusY, zoom });
const move = (from: CameraStop, to: CameraStop, via?: CameraStop[]): CameraPath => ({ from, to, via });
/** The same path in both layouts. */
const both = (path: CameraPath): Record<Layout, CameraPath> => ({ wide: path, tall: path });

/** One wide-cut shot from storyboard §2. `out` is the join into the next shot. */
const shot = (id: string, durationInFrames: number, out: TransitionName, render: SceneEntry['render']): SceneEntry => ({
  id,
  durationInFrames,
  join: joinFor(out),
  render,
});

/** Frames 0–359 (W01–W03) loop on their own: they cut inside, and begin and end on the bare library plate. */
const WIDE: SceneEntry[] = [
  shot('W01', 120, 'cut', (props) => <KineticText {...props} lines={['Type any action.']} plate={SHOTS.library} />),
  shot('W02', 180, 'cut', (props) => (
    <TypedNarration
      {...props}
      prompt=""
      narration="An AI narrator writes what happens."
      backdrop={{ before: SHOTS.turnBefore, after: SHOTS.game, camera: both(move(stop(0.5, 0.5), stop(0.5, 0.36, 1.35), [stop(0.5, 0.92, 1.5)])) }}
    />
  )),
  shot('W03', 60, 'cut', (props) => <PlateTitle {...props} plate={SHOTS.library} />),
  shot('W04', 300, 'wipe', (props) => (
    <FrameScene
      {...props}
      shot={SHOTS.library}
      fromPlate
      caption={['An AI text RPG.', 'Play any world you can imagine.']}
      camera={both(move(stop(0.5, 0.5), stop(0.7, 0.3, 1.5), [stop(0.3, 0.3, 1.5)]))}
    />
  )),
  shot('W05', 360, 'fade', (props) => (
    <TypedNarration
      {...props}
      prompt="Write any action."
      narration="The narrator continues the story."
      backdrop={{ before: SHOTS.turnBefore, after: SHOTS.game, camera: both(move(stop(0.5, 0.92, 1.6), stop(0.5, 0.36, 1.3))) }}
    />
  )),
  shot('W06', 210, 'fade', (props) => (
    <FrameScene
      {...props}
      shot={SHOTS.game}
      caption={['Every turn updates your stats.']}
      callout={{ region: { x: 0.745, y: 0.205, width: 0.24, height: 0.37 } }}
      camera={both(move(stop(0.5, 0.5), stop(0.84, 0.38, 1.8)))}
    />
  )),
  shot('W07', 210, 'fade', (props) => (
    <FrameScene {...props} shot={SHOTS.entity} caption={['Talk to anyone you meet.']} camera={both(move(stop(0.5, 0.5), stop(0.5, 0.4, 1.5)))} />
  )),
  shot('W08', 210, 'wipe', (props) => (
    <FrameScene {...props} shot={SHOTS.chat} caption={['Chat with anyone in your library.']} camera={both(move(stop(0.5, 0.5), stop(0.5, 0.58, 1.45)))} />
  )),
  shot('W09', 120, 'fade', (props) => <KineticText {...props} lines={['Build your own world.']} plate={SHOTS.canvas} />),
  shot('W10', 240, 'fade', (props) => (
    <FrameScene {...props} shot={SHOTS.canvas} caption={['Place locations on a map.']} camera={both(move(stop(0.32, 0.5, 1.4), stop(0.68, 0.5, 1.4)))} />
  )),
  shot('W11', 240, 'fade', (props) => (
    <FrameScene {...props} shot={SHOTS.profile} caption={['Write who lives there.']} camera={both(move(stop(0.5, 0.5), stop(0.72, 0.4, 1.6)))} />
  )),
  shot('W12', 240, 'fade', (props) => (
    <FrameScene
      {...props}
      shot={SHOTS.blueprints}
      caption={['Let players pick a race and a class.']}
      camera={both(move(stop(0.3, 0.22, 1.6), stop(0.3, 0.78, 1.6)))}
    />
  )),
  shot('W13', 210, 'wipe', (props) => (
    <FrameScene {...props} shot={SHOTS.help} caption={['Ask Morphie for help at any step.']} camera={both(move(stop(0.5, 0.5), stop(0.77, 0.62, 2.2)))} />
  )),
  shot('W14', 240, 'fade', (props) => (
    <FrameScene
      {...props}
      shot={SHOTS.community}
      caption={['Download hundreds of worlds from the community.']}
      camera={both(move(stop(0.5, 0.28, 1.3), stop(0.5, 0.72, 1.3)))}
    />
  )),
  shot('W15', 180, 'wipe', (props) => (
    <FrameScene
      {...props}
      shot={SHOTS.contest}
      caption={['Enter contests.', 'Share what you make.']}
      callout={{ region: { x: 0.135, y: 0.205, width: 0.85, height: 0.09 } }}
      camera={both(move(stop(0.5, 0.5), stop(0.56, 0.32, 1.7)))}
    />
  )),
  shot('W16', 120, 'fade', (props) => <KineticText {...props} lines={['Use any AI model.']} plate={SHOTS.endpoint} />),
  shot('W17', 240, 'fade', (props) => (
    <FrameScene
      {...props}
      shot={SHOTS.endpoint}
      caption={['Play in your browser or offline on your desktop.']}
      camera={both(move(stop(0.5, 0.34, 1.5), stop(0.5, 0.64, 1.5)))}
    />
  )),
  shot('W18', 180, 'fade', (props) => (
    <FrameScene {...props} shot={SHOTS.avatar} caption={['Pick a 3D avatar.']} camera={both(move(stop(0.45, 0.5), stop(0.33, 0.62, 1.6)))} />
  )),
  shot('W19', 360, 'cut', (props) => <TitleCard {...props} cta="formamorph.ai" />),
];

/** The 20-second proof scenes, until the tall cut gets its own shot order (ticket 06). */
const PROOF: SceneEntry[] = [
  { id: 'title', durationInFrames: 400, join: sceneTransition, render: (props) => <TitleCard {...props} /> },
  {
    id: 'library',
    durationInFrames: 430,
    join: sceneTransition,
    render: (props) => (
      <FrameScene
        {...props}
        shot={SHOTS.library}
        camera={{
          wide: move(stop(0.5, 0.5), stop(0.35, 0.4, 1.3)),
          tall: move(stop(0.2, 0.5), stop(0.75, 0.5)),
        }}
      />
    ),
  },
  {
    id: 'game',
    durationInFrames: 430,
    join: null,
    render: (props) => (
      <FrameScene
        {...props}
        shot={SHOTS.game}
        camera={{
          wide: move(stop(0.6, 0.35, 1.35), stop(0.5, 0.5)),
          tall: move(stop(0.6, 0.5, 1.15), stop(0.4, 0.5)),
        }}
      />
    ),
  },
];

/** The scene list each cut plays. */
export const TIMELINES: Record<Layout, SceneEntry[]> = { wide: WIDE, tall: PROOF };

/** A cut's length: the scenes end to end, less the frames each join overlaps. */
export const totalFrames = (layout: Layout) => {
  const scenes = TIMELINES[layout];
  return scenes.reduce(
    (sum, scene, i) => sum + scene.durationInFrames - (i < scenes.length - 1 ? (scene.join?.timing.getDurationInFrames({ fps: FPS }) ?? 0) : 0),
    0,
  );
};
