import type { ComponentProps, ReactNode } from 'react';
import type { Layout, SceneProps } from './layout';
import { copyReads } from './parts/CopyBlock';
import type { CameraPath, CameraStop } from './parts/FrameCamera';
import { readLines, type CopyRead, type LineReading } from './reading';
import { FrameScene } from './scenes/FrameScene';
import { KineticText } from './scenes/KineticText';
import { PlateTitle } from './scenes/PlateTitle';
import { StackScene, stackReads, type StackPane } from './scenes/StackScene';
import { TitleCard, titleReads } from './scenes/TitleCard';
import { TypedNarration, typedReads } from './scenes/TypedNarration';
import { SHOTS, type LayoutShot } from './shots';
import { joinFor, type Join, type TransitionName } from './transitions';

export const FPS = 60;

type SceneEntry = {
  id: string;
  durationInFrames: number;
  /** The join into the next scene. Absent on a cut and on the last scene. */
  join: Join | null;
  render: (props: SceneProps) => ReactNode;
  /** Each line of copy and the scene frames it is legible, for the reading check. */
  reads: CopyRead[];
};

const stop = (focusX: number, focusY: number, zoom = 1): CameraStop => ({ focusX, focusY, zoom });
const move = (from: CameraStop, to: CameraStop, via?: CameraStop[]): CameraPath => ({ from, to, via });
/** The same path in both layouts. */
const both = (path: CameraPath): Record<Layout, CameraPath> => ({ wide: path, tall: path });
/** One path per layout: the tall cut crops a window out of the wide capture. */
const layouts = (wide: CameraPath, tall: CameraPath): Record<Layout, CameraPath> => ({ wide, tall });

/** One shot from storyboard §2 or §4. `out` is the join into the next shot. */
const shot = (id: string, durationInFrames: number, out: TransitionName, render: SceneEntry['render'], reads: CopyRead[]): SceneEntry => ({
  id,
  durationInFrames,
  join: joinFor(out),
  render,
  reads,
});

/** A scene's own props, without the ones every scene gets. */
type Own<Props> = Omit<Props, keyof SceneProps>;

const kinetic = (id: string, frames: number, out: TransitionName, props: Own<ComponentProps<typeof KineticText>>) =>
  shot(id, frames, out, (scene) => <KineticText {...scene} {...props} />, copyReads(props.lines, frames, FPS));

const frameShot = (id: string, frames: number, out: TransitionName, props: Own<ComponentProps<typeof FrameScene>>) =>
  shot(id, frames, out, (scene) => <FrameScene {...scene} {...props} />, props.caption ? copyReads(props.caption, frames, FPS) : []);

const typed = (id: string, frames: number, out: TransitionName, props: Own<ComponentProps<typeof TypedNarration>>) =>
  shot(id, frames, out, (scene) => <TypedNarration {...scene} {...props} />, typedReads(props.prompt, props.narration, frames, FPS));

const stack = (id: string, frames: number, out: TransitionName, panes: readonly [StackPane, StackPane]) =>
  shot(id, frames, out, (scene) => <StackScene {...scene} panes={panes} />, stackReads(panes, frames, FPS));

/** The wordmark is a logo, not copy, so it has no reads. */
const plateTitle = (id: string, frames: number, out: TransitionName, plate: LayoutShot) =>
  shot(id, frames, out, (scene) => <PlateTitle {...scene} plate={plate} />, []);

const title = (id: string, frames: number, cta: string) =>
  shot(id, frames, 'cut', (scene) => <TitleCard {...scene} cta={cta} />, titleReads(frames, FPS, cta));

/** A wide shot that the tall cut plays in the same place with the same copy, renamed to its tall id. */
const reuse = (id: string, entry: SceneEntry): SceneEntry => ({ ...entry, id });

/** The gameplay captures: the wide ones, and the native mobile-layout recaptures the tall cut plays. */
const TURN_BEFORE = { wide: SHOTS.turnBefore, tall: SHOTS.turnBeforeTall };
const TURN_AFTER = { wide: SHOTS.game, tall: SHOTS.gameTall };

/** The tall cut barely pushes in on a recapture: the shot already fills the canvas. */
const TALL_PUSH = move(stop(0.5, 0.5), stop(0.5, 0.5, 1.05));

/** The six shots the wide cut plays one by one and the tall cut stacks in pairs: one shot, caption and camera each. */
const STATS: StackPane = { shot: SHOTS.statsClip, caption: ['Every turn updates your stats.'], camera: move(stop(0.5, 0.5), stop(0.84, 0.38, 1.8)) };
const ENTITY: StackPane = { shot: SHOTS.entity, caption: ['Talk to anyone you meet.'], camera: move(stop(0.5, 0.5), stop(0.5, 0.4, 1.5)) };
const PROFILE: StackPane = { shot: SHOTS.profile, caption: ['Write who lives there.'], camera: move(stop(0.5, 0.5), stop(0.72, 0.4, 1.6)) };
const BLUEPRINTS: StackPane = {
  shot: SHOTS.blueprints,
  caption: ['Let players pick a race and a class.'],
  camera: move(stop(0.3, 0.22, 1.6), stop(0.3, 0.78, 1.6)),
};
const COMMUNITY: StackPane = {
  shot: SHOTS.community,
  caption: ['Download hundreds of worlds from the community.'],
  camera: move(stop(0.5, 0.28, 1.3), stop(0.5, 0.72, 1.3)),
};
const CONTEST: StackPane = { shot: SHOTS.contest, caption: ['Enter contests.', 'Share what you make.'], camera: move(stop(0.5, 0.5), stop(0.56, 0.32, 1.7)) };

/** W01–W03 (frames 0–359) loop on their own: they cut inside, and begin and end on the bare library plate. */
const W01 = kinetic('W01', 147, 'cut', { lines: ['Type any action.'], plate: SHOTS.library });
const W02 = typed('W02', 153, 'cut', {
  prompt: '',
  narration: 'The narrator answers.',
  backdrop: {
    before: TURN_BEFORE,
    after: TURN_AFTER,
    camera: layouts(move(stop(0.5, 0.5), stop(0.5, 0.36, 1.35), [stop(0.5, 0.92, 1.5)]), TALL_PUSH),
  },
});
const W03 = plateTitle('W03', 60, 'cut', SHOTS.library);
const W04 = frameShot('W04', 300, 'wipe', {
  shot: SHOTS.library,
  fromPlate: true,
  caption: ['An AI text RPG.', 'Play any world you can imagine.'],
  camera: layouts(move(stop(0.5, 0.5), stop(0.7, 0.3, 1.5), [stop(0.3, 0.3, 1.5)]), move(stop(0.5, 0.5), stop(0.5, 0.27, 1.5))),
});
const W05 = typed('W05', 360, 'fade', {
  prompt: 'Type any action.',
  narration: 'The narrator continues the story.',
  backdrop: {
    before: TURN_BEFORE,
    after: TURN_AFTER,
    camera: layouts(move(stop(0.5, 0.92, 1.6), stop(0.5, 0.36, 1.3)), TALL_PUSH),
  },
});
const W06 = frameShot('W06', 220, 'fade', {
  shot: STATS.shot,
  caption: STATS.caption,
  callout: { region: { x: 0.745, y: 0.205, width: 0.24, height: 0.37 } },
  camera: both(STATS.camera),
});
const W07 = frameShot('W07', 210, 'fade', { shot: ENTITY.shot, caption: ENTITY.caption, camera: both(ENTITY.camera) });
const W08 = frameShot('W08', 240, 'wipe', {
  shot: SHOTS.chat,
  caption: ['Chat with anyone in your library.'],
  camera: layouts(move(stop(0.5, 0.5), stop(0.5, 0.58, 1.45)), move(stop(0.42, 0.5), stop(0.58, 0.5))),
});
const W09 = kinetic('W09', 175, 'fade', { lines: ['Build your own world.'], plate: SHOTS.canvas });
const W10 = frameShot('W10', 240, 'fade', {
  shot: SHOTS.canvas,
  caption: ['Place locations on a map.'],
  camera: layouts(move(stop(0.32, 0.5, 1.4), stop(0.68, 0.5, 1.4)), move(stop(0.28, 0.5, 1.4), stop(0.72, 0.5, 1.4))),
});
const W11 = frameShot('W11', 240, 'fade', { shot: PROFILE.shot, caption: PROFILE.caption, camera: both(PROFILE.camera) });
const W12 = frameShot('W12', 250, 'fade', { shot: BLUEPRINTS.shot, caption: BLUEPRINTS.caption, camera: both(BLUEPRINTS.camera) });
const W13 = frameShot('W13', 240, 'wipe', {
  shot: SHOTS.help,
  caption: ['Ask Morphie for help at any step.'],
  camera: both(move(stop(0.5, 0.5), stop(0.77, 0.62, 2.2))),
});
const W14 = frameShot('W14', 305, 'fade', { shot: COMMUNITY.shot, caption: COMMUNITY.caption, camera: both(COMMUNITY.camera) });
const W15 = frameShot('W15', 185, 'wipe', {
  shot: CONTEST.shot,
  caption: CONTEST.caption,
  callout: { region: { x: 0.135, y: 0.205, width: 0.85, height: 0.09 } },
  camera: both(CONTEST.camera),
});
const W16 = kinetic('W16', 160, 'fade', { lines: ['Use any AI model.'], plate: SHOTS.endpoint });
const W17 = frameShot('W17', 310, 'fade', {
  shot: SHOTS.endpoint,
  caption: ['Play in your browser or offline on your desktop.'],
  camera: layouts(move(stop(0.5, 0.34, 1.5), stop(0.5, 0.64, 1.5)), move(stop(0.46, 0.5), stop(0.6, 0.5))),
});
const W18 = frameShot('W18', 180, 'fade', {
  shot: SHOTS.avatar,
  caption: ['Pick a 3D avatar.'],
  camera: both(move(stop(0.45, 0.5), stop(0.33, 0.62, 1.6))),
});
const W19 = title('W19', 360, 'formamorph.ai');

/** The tall cut's stacks: two wide captures, each cropped to half the canvas, one above the other (storyboard §4). */
const T06 = stack('T06', 240, 'fade', [STATS, ENTITY]);
const T10 = stack('T10', 275, 'wipe', [PROFILE, BLUEPRINTS]);
const T11 = stack('T11', 310, 'wipe', [COMMUNITY, CONTEST]);

/** The wide cut: storyboard §2. */
const WIDE: SceneEntry[] = [W01, W02, W03, W04, W05, W06, W07, W08, W09, W10, W11, W12, W13, W14, W15, W16, W17, W18, W19];

/** The tall cut: storyboard §4. It keeps the loop shots, drops Morphie (W13) and the avatar (W18), and stacks six wide shots into three. */
const TALL: SceneEntry[] = [
  reuse('T01', W01),
  reuse('T02', W02),
  reuse('T03', W03),
  reuse('T04', W04),
  reuse('T05', W05),
  T06,
  reuse('T07', W08),
  reuse('T08', W09),
  reuse('T09', W10),
  T10,
  T11,
  reuse('T12', W16),
  reuse('T13', W17),
  reuse('T14', W19),
];

/** The scene list each cut plays. */
export const TIMELINES: Record<Layout, SceneEntry[]> = { wide: WIDE, tall: TALL };

/** Frames a scene's outgoing join overlaps it and the next one. The last scene has none. */
const joinFrames = (scenes: SceneEntry[], i: number) =>
  i >= 0 && i < scenes.length - 1 ? (scenes[i].join?.timing.getDurationInFrames({ fps: FPS }) ?? 0) : 0;

/** A cut's length: the scenes end to end, less the frames each join overlaps. */
export const totalFrames = (layout: Layout) => {
  const scenes = TIMELINES[layout];
  return scenes.reduce((sum, scene, i) => sum + scene.durationInFrames - joinFrames(scenes, i), 0);
};

/** Every line of copy in a cut, measured against the reading bar on the frames no join covers. */
export const readingReport = (layout: Layout): LineReading[] => {
  const scenes = TIMELINES[layout];
  return scenes.flatMap((scene, i) => readLines(scene.id, scene.reads, scene.durationInFrames, joinFrames(scenes, i - 1), joinFrames(scenes, i), FPS));
};
