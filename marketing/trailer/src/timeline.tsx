import type { ComponentProps, ReactNode } from 'react';
import { readCamera, type CameraReading, type CameraUse } from './framing';
import type { Layout, SceneProps } from './layout';
import { copyReads } from './parts/CopyBlock';
import type { CameraPath, CameraStop } from './parts/FrameCamera';
import { cardSize, fullFrame } from './parts/GlassCard';
import { readLines, type CopyRead, type LineReading } from './reading';
import { FrameScene, frameCards } from './scenes/FrameScene';
import { KineticText } from './scenes/KineticText';
import { StackScene, paneSize, stackReads, type StackPane } from './scenes/StackScene';
import { TitleCard, titleReads } from './scenes/TitleCard';
import { TypedNarration, typedCameraSize, typedReads } from './scenes/TypedNarration';
import { WordmarkTitle } from './scenes/WordmarkTitle';
import { SHOTS, shotFor } from './shots';
import { joinFor, type Join, type TransitionName } from './transitions';

export const FPS = 60;

type SceneEntry = {
  id: string;
  durationInFrames: number;
  /** The join into the next scene. Absent on a cut and on the last scene. */
  join: Join | null;
  render: (props: SceneProps) => ReactNode;
  /** Each line of copy and the scene frames it enters, is legible and leaves, for the reading check. */
  reads: CopyRead[];
  /** Each camera the scene runs in a layout, for the camera check. */
  cameras: (layout: Layout) => CameraUse[];
};

const stop = (focusX: number, focusY: number, zoom = 1): CameraStop => ({ focusX, focusY, zoom });
/** Ruling Q23: only the stats and the Morphie answer zoom during the shot. */
const zoom = (from: CameraStop, to: CameraStop): CameraPath => ({ from, to });
/** Ruling Q28: every other card holds its crop; the card's own float is the motion. */
const hold = (scale: number, focusX = 0.5, focusY = 0.5): CameraPath => ({ from: stop(focusX, focusY, scale), to: stop(focusX, focusY, scale) });
/** The same path in both layouts. */
const both = (path: CameraPath): Record<Layout, CameraPath> => ({ wide: path, tall: path });
/** One path per layout: the tall card crops its own window out of the wide capture. */
const layouts = (wide: CameraPath, tall: CameraPath): Record<Layout, CameraPath> => ({ wide, tall });
const FULL = fullFrame;

/** One shot from storyboard §2 or §4. `out` is the join into the next shot. */
const shot = (
  id: string,
  durationInFrames: number,
  out: TransitionName,
  render: SceneEntry['render'],
  reads: CopyRead[],
  cameras: SceneEntry['cameras'] = () => [],
): SceneEntry => ({ id, durationInFrames, join: joinFor(out), render, reads, cameras });

/** A scene's own props, without the ones every scene gets. */
type Own<Props> = Omit<Props, keyof SceneProps>;

const kinetic = (id: string, frames: number, out: TransitionName, props: Own<ComponentProps<typeof KineticText>>) =>
  shot(id, frames, out, (scene) => <KineticText {...scene} {...props} />, copyReads(props.lines, frames, props.delay));

const frameShot = (id: string, frames: number, out: TransitionName, props: Own<ComponentProps<typeof FrameScene>>) =>
  shot(id, frames, out, (scene) => <FrameScene {...scene} {...props} />, props.caption ? copyReads(props.caption, frames) : [], (layout) => [
    { shot: shotFor(props.shot, layout), path: props.camera[layout], size: cardSize(frameCards(layout, props.cards).front) },
  ]);

/** The back card's two shots share one path and one size, so one camera stands for both. */
const typed = (id: string, frames: number, out: TransitionName, props: Own<ComponentProps<typeof TypedNarration>>) =>
  shot(id, frames, out, (scene) => <TypedNarration {...scene} {...props} />, typedReads(props.prompt, props.narration, frames), (layout) =>
    props.backdrop ? [{ shot: shotFor(props.backdrop.after, layout), path: props.backdrop.camera[layout], size: typedCameraSize(layout) }] : [],
  );

const stack = (id: string, frames: number, out: TransitionName, panes: readonly [StackPane, StackPane]) =>
  shot(id, frames, out, (scene) => <StackScene {...scene} panes={panes} />, stackReads(panes, frames), (layout) =>
    panes.map((pane, i) => ({ shot: shotFor(pane.shot, layout), path: pane.camera, size: paneSize(layout, i), pane: i + 1 })),
  );

/** The wordmark is a logo, not copy, so it has no reads. */
const wordmark = (id: string, frames: number, out: TransitionName) => shot(id, frames, out, (scene) => <WordmarkTitle {...scene} />, []);

const title = (id: string, frames: number, cta: string) =>
  shot(id, frames, 'cut', (scene) => <TitleCard {...scene} cta={cta} />, titleReads(frames, cta));

/** A wide shot that the tall cut plays in the same place with the same copy, renamed to its tall id. */
const reuse = (id: string, entry: SceneEntry): SceneEntry => ({ ...entry, id });

/** The gameplay captures: the wide ones, and the native mobile-layout recaptures the tall cut plays. */
const TURN_BEFORE = { wide: SHOTS.turnBefore, tall: SHOTS.turnBeforeTall };
const TURN_AFTER = { wide: SHOTS.game, tall: SHOTS.gameTall };
const TURN = { before: TURN_BEFORE, after: TURN_AFTER, camera: both(FULL) };

/** The six shots the tall cut stacks in pairs, each on its own card. */
const STATS: StackPane = { shot: SHOTS.statsClip, caption: ['Every turn updates your stats.'], camera: zoom(stop(0.5, 0.5), stop(0.8, 0.38, 1.8)), dot: 'mint' };
const ENTITY: StackPane = { shot: SHOTS.entity, caption: ['Talk to anyone you meet.'], camera: hold(1.5, 0.5, 0.4), dot: 'pink' };
const PROFILE: StackPane = { shot: SHOTS.profile, caption: ['Write who lives there.'], camera: hold(1.6, 0.72, 0.4), dot: 'rose' };
const BLUEPRINTS: StackPane = { shot: SHOTS.blueprints, caption: ['Let players pick a race and a class.'], camera: hold(1, 0.34), dot: 'amber' };
const COMMUNITY: StackPane = { shot: SHOTS.community, caption: ['Download hundreds of worlds from the community.'], camera: FULL, dot: 'sky' };
const CONTEST: StackPane = { shot: SHOTS.contest, caption: ['Enter contests.', 'Share what you make.'], camera: hold(1.7, 0.275, 0.32), dot: 'amber' };

/** W01–W03 (frames 0–359) loop on their own: they cut inside, and begin and end on the bare stage (ruling Q28). */
const W01 = kinetic('W01', 150, 'cut', { lines: ['Type any action.'], delay: 0 });
const W02 = typed('W02', 150, 'cut', { prompt: '', narration: 'The AI narrates.', backdrop: TURN });
const W03 = wordmark('W03', 60, 'cut');
const W04 = frameShot('W04', 300, 'section', {
  shot: SHOTS.library,
  depth: TURN_AFTER,
  caption: ['An AI text RPG.', 'Play any world you can imagine.'],
  dot: 'purple',
  camera: both(FULL),
});
const W05 = typed('W05', 360, 'overlap', { prompt: 'Type any action.', narration: 'The narrator continues the story.', backdrop: TURN });
const W06 = frameShot('W06', 220, 'overlap', {
  shot: STATS.shot,
  depth: SHOTS.entity,
  caption: STATS.caption,
  dot: STATS.dot,
  callout: { region: { x: 0.745, y: 0.205, width: 0.24, height: 0.37 } },
  camera: both(zoom(stop(0.5, 0.5), stop(0.72, 0.38, 1.8))),
});
const W07 = frameShot('W07', 210, 'overlap', { shot: ENTITY.shot, depth: SHOTS.chat, caption: ENTITY.caption, dot: ENTITY.dot, camera: both(hold(1.5, 0.5, 0.4)) });
const W08 = frameShot('W08', 242, 'section', { shot: SHOTS.chat, depth: SHOTS.library, caption: ['Chat with anyone in your library.'], dot: 'sky', camera: both(FULL) });
const W09 = kinetic('W09', 175, 'overlap', { lines: ['Build your own world.'] });
const W10 = frameShot('W10', 240, 'overlap', { shot: SHOTS.canvas, depth: SHOTS.profile, caption: ['Place locations on a map.'], dot: 'mint', camera: both(FULL) });
const W11 = frameShot('W11', 240, 'overlap', { shot: PROFILE.shot, depth: SHOTS.canvas, caption: PROFILE.caption, dot: PROFILE.dot, camera: both(hold(1.6, 0.67, 0.4)) });
const W12 = frameShot('W12', 250, 'overlap', { shot: BLUEPRINTS.shot, depth: SHOTS.profile, caption: BLUEPRINTS.caption, dot: BLUEPRINTS.dot, camera: both(FULL) });
const W13 = frameShot('W13', 242, 'section', {
  shot: SHOTS.help,
  depth: SHOTS.canvas,
  caption: ['Ask Morphie for help at any step.'],
  dot: 'pink',
  camera: both(zoom(stop(0.5, 0.5), stop(0.77, 0.62, 2.2))),
});
const W14 = frameShot('W14', 305, 'overlap', { shot: COMMUNITY.shot, depth: SHOTS.contest, caption: COMMUNITY.caption, dot: COMMUNITY.dot, camera: both(FULL) });
const W15 = frameShot('W15', 187, 'section', {
  shot: CONTEST.shot,
  depth: SHOTS.community,
  caption: CONTEST.caption,
  dot: CONTEST.dot,
  callout: { region: { x: 0.135, y: 0.205, width: 0.85, height: 0.09 } },
  // Zoomed only as far as keeps the whole podium callout in frame.
  camera: both(hold(1.12, 0.55, 0.46)),
});
const W16 = kinetic('W16', 160, 'overlap', { lines: ['Use any AI model.'] });
const W17 = frameShot('W17', 310, 'overlap', {
  shot: SHOTS.endpoint,
  depth: TURN_AFTER,
  caption: ['Play in your browser or offline on your desktop.'],
  dot: 'purple',
  camera: layouts(hold(1.8, 0.5, 0.64), hold(1.2, 0.39, 0.56)),
});
const W18 = frameShot('W18', 180, 'overlap', { shot: SHOTS.avatarClip, depth: SHOTS.entity, caption: ['Pick a 3D avatar.'], dot: 'rose', camera: both(FULL) });
const W19 = title('W19', 360, 'formamorph.ai');

/** The tall cut's stacks: two wide captures on two cards, one above the other (storyboard §4). */
const T06 = stack('T06', 240, 'overlap', [STATS, ENTITY]);
const T10 = stack('T10', 277, 'section', [PROFILE, BLUEPRINTS]);
const T11 = stack('T11', 312, 'section', [COMMUNITY, CONTEST]);

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

/** The frame each scene of a cut starts on, after the joins before it overlap. */
export const sceneStarts = (layout: Layout) => {
  const scenes = TIMELINES[layout];
  return scenes.map((scene, i) => ({
    id: scene.id,
    durationInFrames: scene.durationInFrames,
    from: scenes.slice(0, i).reduce((sum, before, j) => sum + before.durationInFrames - joinFrames(scenes, j), 0),
  }));
};

/** A cut's length: the scenes end to end, less the frames each join overlaps. */
export const totalFrames = (layout: Layout) => {
  const scenes = TIMELINES[layout];
  return scenes.reduce((sum, scene, i) => sum + scene.durationInFrames - joinFrames(scenes, i), 0);
};

/** Every camera in a cut, measured on the frames each scene plays. */
export const cameraReport = (layout: Layout): CameraReading[] =>
  TIMELINES[layout].flatMap((scene) => scene.cameras(layout).map((use) => readCamera(scene.id, use, scene.durationInFrames)));

/** Every line of copy in a cut, measured against the reading bar on the frames no join covers. */
export const readingReport = (layout: Layout): LineReading[] => {
  const scenes = TIMELINES[layout];
  return scenes.flatMap((scene, i) => readLines(scene.id, scene.reads, scene.durationInFrames, joinFrames(scenes, i - 1), joinFrames(scenes, i), FPS));
};
