import type { ComponentProps, ReactNode } from 'react';
import { readCamera, type CameraReading, type CameraUse } from './framing';
import { CANVAS, type Layout, type SceneProps } from './layout';
import { copyReads } from './parts/CopyBlock';
import type { CameraPath, CameraStop } from './parts/FrameCamera';
import { readLines, type CopyRead, type LineReading } from './reading';
import { FrameScene } from './scenes/FrameScene';
import { KineticText } from './scenes/KineticText';
import { PlateTitle } from './scenes/PlateTitle';
import { StackScene, paneSize, stackReads, type StackPane } from './scenes/StackScene';
import { TitleCard, titleReads } from './scenes/TitleCard';
import { TypedNarration, typedReads } from './scenes/TypedNarration';
import { SHOTS, shotFor, type LayoutShot } from './shots';
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
/** Ruling Q23: every other frame shot holds one zoom and drifts in a straight line, a few percent of the frame. */
const drift = (scale: number, [fromX, fromY]: [number, number], [toX, toY]: [number, number]): CameraPath => ({
  from: stop(fromX, fromY, scale),
  to: stop(toX, toY, scale),
});
/** The same path in both layouts. */
const both = (path: CameraPath): Record<Layout, CameraPath> => ({ wide: path, tall: path });
/** One path per layout: the tall cut crops a window out of the wide capture. */
const layouts = (wide: CameraPath, tall: CameraPath): Record<Layout, CameraPath> => ({ wide, tall });
/** A full frame zooms in this far, so its drift has room inside the shot. */
const FULL_FRAME_ZOOM = 1.05;

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
    { shot: shotFor(props.shot, layout), path: props.camera[layout], size: CANVAS[layout] },
  ]);

/** The backdrop's two shots share one path and one size, so one camera stands for both. */
const typed = (id: string, frames: number, out: TransitionName, props: Own<ComponentProps<typeof TypedNarration>>) =>
  shot(id, frames, out, (scene) => <TypedNarration {...scene} {...props} />, typedReads(props.prompt, props.narration, frames), (layout) =>
    props.backdrop ? [{ shot: shotFor(props.backdrop.after, layout), path: props.backdrop.camera[layout], size: CANVAS[layout] }] : [],
  );

const stack = (id: string, frames: number, out: TransitionName, panes: readonly [StackPane, StackPane]) =>
  shot(id, frames, out, (scene) => <StackScene {...scene} panes={panes} />, stackReads(panes, frames), (layout) =>
    panes.map((pane, i) => ({ shot: shotFor(pane.shot, layout), path: pane.camera, size: paneSize(layout), pane: i + 1 })),
  );

/** The wordmark is a logo, not copy, so it has no reads. */
const plateTitle = (id: string, frames: number, out: TransitionName, plate: LayoutShot, plateAt?: Record<Layout, CameraStop>) =>
  shot(id, frames, out, (scene) => <PlateTitle {...scene} plate={plate} plateAt={plateAt} />, []);

const title = (id: string, frames: number, cta: string) =>
  shot(id, frames, 'cut', (scene) => <TitleCard {...scene} cta={cta} />, titleReads(frames, cta));

/** A wide shot that the tall cut plays in the same place with the same copy, renamed to its tall id. */
const reuse = (id: string, entry: SceneEntry): SceneEntry => ({ ...entry, id });

/** The gameplay captures: the wide ones, and the native mobile-layout recaptures the tall cut plays. */
const TURN_BEFORE = { wide: SHOTS.turnBefore, tall: SHOTS.turnBeforeTall };
const TURN_AFTER = { wide: SHOTS.game, tall: SHOTS.gameTall };

/** The typed backdrops are full frames in both cuts and rise toward the narration. */
const TYPED_RISE = both(drift(FULL_FRAME_ZOOM, [0.5, 0.515], [0.5, 0.485]));

/** The six shots the tall cut stacks in pairs. Each pane crops its wide capture to half the tall canvas. */
const STATS: StackPane = { shot: SHOTS.statsClip, caption: ['Every turn updates your stats.'], camera: zoom(stop(0.5, 0.5), stop(0.8, 0.38, 1.8)) };
const ENTITY: StackPane = { shot: SHOTS.entity, caption: ['Talk to anyone you meet.'], camera: drift(1.5, [0.494, 0.4], [0.506, 0.4]) };
const PROFILE: StackPane = { shot: SHOTS.profile, caption: ['Write who lives there.'], camera: drift(1.6, [0.714, 0.4], [0.726, 0.4]) };
const BLUEPRINTS: StackPane = { shot: SHOTS.blueprints, caption: ['Let players pick a race and a class.'], camera: drift(1, [0.33, 0.5], [0.35, 0.5]) };
const COMMUNITY: StackPane = {
  shot: SHOTS.community,
  caption: ['Download hundreds of worlds from the community.'],
  camera: drift(FULL_FRAME_ZOOM, [0.5, 0.485], [0.5, 0.515]),
};
const CONTEST: StackPane = { shot: SHOTS.contest, caption: ['Enter contests.', 'Share what you make.'], camera: drift(1.7, [0.269, 0.32], [0.281, 0.32]) };

/** W04's opening camera. The loop's library plate holds there, so the cut into W04 has no jump. */
const LIBRARY_OPEN: Record<Layout, CameraStop> = { wide: stop(0.485, 0.5, FULL_FRAME_ZOOM), tall: stop(0.495, 0.5) };

/** W01–W03 (frames 0–359) loop on their own: they cut inside, and begin and end on the bare library plate. */
const W01 = kinetic('W01', 150, 'cut', { lines: ['Type any action.'], plate: SHOTS.library, plateAt: LIBRARY_OPEN, delay: 0 });
const W02 = typed('W02', 150, 'cut', {
  prompt: '',
  narration: 'The AI narrates.',
  backdrop: { before: TURN_BEFORE, after: TURN_AFTER, camera: TYPED_RISE },
});
const W03 = plateTitle('W03', 60, 'cut', SHOTS.library, LIBRARY_OPEN);
const W04 = frameShot('W04', 300, 'wipe', {
  shot: SHOTS.library,
  fromPlate: true,
  caption: ['An AI text RPG.', 'Play any world you can imagine.'],
  camera: layouts(
    { from: LIBRARY_OPEN.wide, to: stop(0.515, 0.5, FULL_FRAME_ZOOM) },
    { from: LIBRARY_OPEN.tall, to: stop(0.505, 0.5) },
  ),
});
const W05 = typed('W05', 360, 'fade', {
  prompt: 'Type any action.',
  narration: 'The narrator continues the story.',
  backdrop: { before: TURN_BEFORE, after: TURN_AFTER, camera: TYPED_RISE },
});
const W06 = frameShot('W06', 220, 'fade', {
  shot: STATS.shot,
  caption: STATS.caption,
  callout: { region: { x: 0.745, y: 0.205, width: 0.24, height: 0.37 } },
  camera: both(zoom(stop(0.5, 0.5), stop(0.72, 0.38, 1.8))),
});
const W07 = frameShot('W07', 210, 'fade', { shot: ENTITY.shot, caption: ENTITY.caption, camera: both(drift(1.5, [0.49, 0.4], [0.51, 0.4])) });
const W08 = frameShot('W08', 242, 'wipe', {
  shot: SHOTS.chat,
  caption: ['Chat with anyone in your library.'],
  camera: layouts(drift(FULL_FRAME_ZOOM, [0.5, 0.485], [0.5, 0.515]), drift(1, [0.495, 0.5], [0.505, 0.5])),
});
const W09 = kinetic('W09', 175, 'fade', { lines: ['Build your own world.'], plate: SHOTS.canvas });
const W10 = frameShot('W10', 240, 'fade', {
  shot: SHOTS.canvas,
  caption: ['Place locations on a map.'],
  camera: layouts(drift(FULL_FRAME_ZOOM, [0.485, 0.5], [0.515, 0.5]), drift(1, [0.495, 0.5], [0.505, 0.5])),
});
const W11 = frameShot('W11', 240, 'fade', { shot: PROFILE.shot, caption: PROFILE.caption, camera: both(drift(1.6, [0.66, 0.4], [0.68, 0.4])) });
const W12 = frameShot('W12', 250, 'fade', { shot: BLUEPRINTS.shot, caption: BLUEPRINTS.caption, camera: both(drift(FULL_FRAME_ZOOM, [0.5, 0.485], [0.5, 0.515])) });
const W13 = frameShot('W13', 242, 'wipe', {
  shot: SHOTS.help,
  caption: ['Ask Morphie for help at any step.'],
  camera: both(zoom(stop(0.5, 0.5), stop(0.77, 0.62, 2.2))),
});
const W14 = frameShot('W14', 305, 'fade', { shot: COMMUNITY.shot, caption: COMMUNITY.caption, camera: both(drift(FULL_FRAME_ZOOM, [0.5, 0.485], [0.5, 0.515])) });
const W15 = frameShot('W15', 187, 'wipe', {
  shot: CONTEST.shot,
  caption: CONTEST.caption,
  callout: { region: { x: 0.135, y: 0.205, width: 0.85, height: 0.09 } },
  // Zoomed only as far as keeps the whole podium callout in frame.
  camera: both(drift(1.12, [0.55, 0.45], [0.55, 0.477])),
});
const W16 = kinetic('W16', 160, 'fade', { lines: ['Use any AI model.'], plate: SHOTS.endpoint });
const W17 = frameShot('W17', 310, 'fade', {
  shot: SHOTS.endpoint,
  caption: ['Play in your browser or offline on your desktop.'],
  camera: layouts(drift(1.8, [0.55, 0.632], [0.55, 0.648]), drift(1.2, [0.426, 0.58], [0.434, 0.58])),
});
const W18 = frameShot('W18', 180, 'fade', {
  shot: SHOTS.avatarClip,
  caption: ['Pick a 3D avatar.'],
  camera: both(drift(FULL_FRAME_ZOOM, [0.515, 0.5], [0.485, 0.5])),
});
const W19 = title('W19', 360, 'formamorph.ai');

/** The tall cut's stacks: two wide captures, each cropped to half the canvas, one above the other (storyboard §4). */
const T06 = stack('T06', 240, 'fade', [STATS, ENTITY]);
const T10 = stack('T10', 277, 'wipe', [PROFILE, BLUEPRINTS]);
const T11 = stack('T11', 312, 'wipe', [COMMUNITY, CONTEST]);

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

/** Every camera in a cut, measured on the frames each scene plays. */
export const cameraReport = (layout: Layout): CameraReading[] =>
  TIMELINES[layout].flatMap((scene) => scene.cameras(layout).map((use) => readCamera(scene.id, use, scene.durationInFrames)));

/** Every line of copy in a cut, measured against the reading bar on the frames no join covers. */
export const readingReport = (layout: Layout): LineReading[] => {
  const scenes = TIMELINES[layout];
  return scenes.flatMap((scene, i) => readLines(scene.id, scene.reads, scene.durationInFrames, joinFrames(scenes, i - 1), joinFrames(scenes, i), FPS));
};
