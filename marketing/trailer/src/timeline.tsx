import type { ReactNode } from 'react';
import type { SceneProps } from './layout';
import { FrameScene } from './scenes/FrameScene';
import { TitleCard } from './scenes/TitleCard';
import { SHOTS } from './shots';
import { sceneTransition } from './transitions';

export const FPS = 60;

type SceneEntry = {
  id: string;
  durationInFrames: number;
  render: (props: SceneProps) => ReactNode;
};

/** The one scene list both compositions play. */
export const SCENES: SceneEntry[] = [
  { id: 'title', durationInFrames: 400, render: (props) => <TitleCard {...props} /> },
  {
    id: 'library',
    durationInFrames: 430,
    render: (props) => (
      <FrameScene
        {...props}
        shot={SHOTS.library}
        camera={{
          wide: { from: { focusX: 0.5, focusY: 0.5, zoom: 1 }, to: { focusX: 0.35, focusY: 0.4, zoom: 1.3 } },
          tall: { from: { focusX: 0.2, focusY: 0.5, zoom: 1 }, to: { focusX: 0.75, focusY: 0.5, zoom: 1 } },
        }}
      />
    ),
  },
  {
    id: 'game',
    durationInFrames: 430,
    render: (props) => (
      <FrameScene
        {...props}
        shot={SHOTS.game}
        camera={{
          wide: { from: { focusX: 0.6, focusY: 0.35, zoom: 1.35 }, to: { focusX: 0.5, focusY: 0.5, zoom: 1 } },
          tall: { from: { focusX: 0.6, focusY: 0.5, zoom: 1.15 }, to: { focusX: 0.4, focusY: 0.5, zoom: 1 } },
        }}
      />
    ),
  },
];

/** Each transition overlaps the scenes it joins, so it shortens the total by its own length. */
export const TOTAL_FRAMES =
  SCENES.reduce((sum, scene) => sum + scene.durationInFrames, 0) -
  (SCENES.length - 1) * sceneTransition.timing.getDurationInFrames({ fps: FPS });
