import type { ComponentProps, ReactNode } from 'react';
import { cardBox, readCamera, type CameraReading, type CameraUse } from './framing';
import { FPS, type Layout, type Rect, type SceneProps } from './layout';
import { readText, type TextReading, type TextTrack } from './onScreen';
import { copyReads, headlineTracks, measurePills, pillTracks, type PillSpec } from './parts/CopyBlock';
import type { CameraPath, CameraStop } from './parts/FrameCamera';
import { cardBob, cardLandFrames, fullFrame, type CardPose } from './parts/GlassCard';
import { readDenseHold, type DenseReading, type StackHoldReading } from './holds';
import { exitStart } from './motion';
import { BUILD_STACK, CAPTION_PLACE, ENTITY_STACK, STACK_CARDS, STACK_PLACE, TURN_STACK, type CardPair, type StackPoses } from './poses';
import { readLines, type CopyRead, type LineReading } from './reading';
import { FRAME_DOT, FrameScene, frameCards } from './scenes/FrameScene';
import { GrowingStack, growingHolds, growingReads, growingTexts, growingTiming, type GrowingPane } from './scenes/GrowingStack';
import { KineticText } from './scenes/KineticText';
import { StackScene, paneRise, stackReads, stackTexts, type StackPane } from './scenes/StackScene';
import { TitleCard, titleReads, titleTracks, type CallToAction } from './scenes/TitleCard';
import { WordmarkTitle } from './scenes/WordmarkTitle';
import { SHOTS, TURN_PROMPT, shotFor } from './shots';
import { joinFor, overlapFrames, type Join, type TransitionName } from './transitions';

type SceneEntry = {
  id: string;
  durationInFrames: number;
  /** The join into the next scene. Absent on a cut and on the last scene. */
  join: Join | null;
  render: (props: SceneProps) => ReactNode;
  /** Each line of copy and the scene frames it enters, is legible and leaves, for the reading check. */
  reads: CopyRead[];
  /** Each text element the scene draws in a layout and its boxes on every frame, for the on-screen check. Runs in the browser. */
  texts: (layout: Layout) => Promise<TextTrack[]>;
  /** Each camera the scene runs in a layout, for the camera check. */
  cameras: (layout: Layout) => CameraUse[];
  /** What the scene draws over its cards in a layout, for the subject check: caption pills and panel cards. */
  covers: (layout: Layout) => Cover[];
  /** The frame the scene's dense card starts to rise, for the dense hold check (ruling Q48), or null for a scene with none. */
  denseRise: number | null;
  /** The frame each card of a growing stack rises, for the stack's contact sheet. */
  stackRises?: number[];
  /** A growing stack's card holds, for the stack check. The dense check skips it (ruling Q62). */
  stackHolds?: (id: string, joinOut: number) => StackHoldReading[];
};

/** Something drawn over a shot card: a pill column, measured in the browser, or a card at its pose. `pane` limits it to one pane's camera. */
type Cover = ({ pills: PillSpec } | { card: CardPose; bob: number }) & { pane?: number };

const stop = (focusX: number, focusY: number, zoom = 1): CameraStop => ({ focusX, focusY, zoom });
/** Ruling Q32: every card holds one crop for its whole shot; the card's own float is the motion. */
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
  texts: SceneEntry['texts'] = async () => [],
  cameras: SceneEntry['cameras'] = () => [],
  covers: SceneEntry['covers'] = () => [],
): SceneEntry => ({ id, durationInFrames, join: joinFor(out), render, reads, texts, cameras, covers, denseRise: null });

/** Marks the scene's card that rises at frame `rise` as dense: the subject holds more than one thing the eye must find. */
const dense = (entry: SceneEntry, rise = 0): SceneEntry => ({ ...entry, denseRise: rise });

/** A scene's own props, without the ones every scene gets. */
type Own<Props> = Omit<Props, keyof SceneProps>;

const kinetic = (id: string, frames: number, out: TransitionName, props: Own<ComponentProps<typeof KineticText>>) =>
  shot(id, frames, out, (scene) => <KineticText {...scene} {...props} />, copyReads(props.lines, frames, props.delay), (layout) => headlineTracks({ lines: props.lines, layout, durationInFrames: frames, delay: props.delay }));

const frameShot = (id: string, frames: number, out: TransitionName, props: Own<ComponentProps<typeof FrameScene>>) =>
  shot(
    id,
    frames,
    out,
    (scene) => <FrameScene {...scene} {...props} />,
    props.caption ? copyReads(props.caption, frames) : [],
    async (layout) => (props.caption ? pillTracks({ lines: props.caption, layout, place: CAPTION_PLACE[layout], dot: props.dot ?? FRAME_DOT, durationInFrames: frames }) : []),
    (layout) => [{ shot: shotFor(props.shot, layout), path: props.camera[layout], card: frameCards(layout, props.cards).front, bob: cardBob('shot') }],
    (layout) => (props.caption ? [{ pills: { lines: props.caption, layout, place: CAPTION_PLACE[layout], dot: props.dot ?? FRAME_DOT } }] : []),
  );

const stack = (id: string, frames: number, out: TransitionName, panes: readonly [StackPane, StackPane]) =>
  shot(
    id,
    frames,
    out,
    (scene) => <StackScene {...scene} panes={panes} />,
    stackReads(panes, frames),
    (layout) => stackTexts(panes, layout, frames),
    (layout) => panes.map((pane, i) => ({ shot: shotFor(pane.shot, layout), path: pane.camera, card: STACK_CARDS[layout][i], bob: cardBob('shot'), pane: i + 1 })),
    (layout) => panes.map((pane, i) => ({ pills: { lines: pane.caption, layout, place: STACK_PLACE[layout][i], dot: pane.dot } })),
  );

/** What a growing stack's pane draws over its own card: its pill, or a turn card's panel. */
const paneCover = (pane: GrowingPane, i: number, poses: StackPoses, layout: Layout): Cover => {
  if (!('typed' in pane)) return { pills: { lines: pane.caption, layout, place: poses[layout].places[i], dot: pane.dot }, pane: i + 1 };
  const { panel } = poses[layout];
  if (!panel) throw new Error('A turn card needs a panel pose');
  return { card: panel.pose, bob: cardBob('panel'), pane: i + 1 };
};

/** A growing stack in one cut (ruling Q62): each camera runs its subject check as the newest card, against its own copy alone. */
const growing = (id: string, out: TransitionName, layout: Layout, panes: readonly GrowingPane[], poses: StackPoses): SceneEntry => {
  const { durationInFrames, rises } = growingTiming(panes, layout, overlapFrames(out, FPS));
  return {
    ...shot(
      id,
      durationInFrames,
      out,
      (scene) => <GrowingStack {...scene} panes={panes} poses={poses} />,
      growingReads(panes, layout),
      (cut) => growingTexts(panes, cut, poses, durationInFrames),
      (cut) => panes.map((pane, i) => ({ shot: shotFor(pane.shot, cut), path: pane.camera[cut], card: poses[cut].cards[i], bob: cardBob('shot'), pane: i + 1 })),
      (cut) => panes.map((pane, i) => paneCover(pane, i, poses, cut)),
    ),
    stackRises: rises,
    stackHolds: (shotId, joinOut) => growingHolds(shotId, panes, layout, joinOut),
  };
};

/** The wordmark is a logo, not copy, so it has no reads. */
const wordmark = (id: string, frames: number, out: TransitionName) => shot(id, frames, out, (scene) => <WordmarkTitle {...scene} />, []);

const title = (id: string, frames: number, cta: CallToAction) =>
  shot(id, frames, 'cut', (scene) => <TitleCard {...scene} cta={cta} />, titleReads(frames, cta), (layout) => titleTracks(layout, cta));

/** A wide shot that the tall cut plays in the same place with the same copy, renamed to its tall id. */
const reuse = (id: string, entry: SceneEntry): SceneEntry => ({ ...entry, id });

/** The game after the turn: the wide capture, and the native mobile-layout recapture the tall cut plays. */
const TURN_AFTER = { wide: SHOTS.game, tall: SHOTS.gameTall };

/** A squarer tall card, for a subject wider than the 3:4 window shows. */
const SQUARE_TALL: CardPair = {
  front: { width: 960, height: 900, x: 0, y: -160, tilt: [-8, -4], lean: 3 },
  depth: { width: 820, height: 769, x: -70, y: -420, tilt: [-14, -10], lean: 4 },
};

/** The shots the tall cut stacks in a pair, each on its own card. */
const COMMUNITY: StackPane = { shot: SHOTS.community, caption: ['Download hundreds of worlds from the community.'], camera: FULL, dot: 'sky' };
const CONTEST: StackPane = { shot: SHOTS.contest, caption: ['Share your ideas with the community.', 'Compete with other creators.'], camera: hold(1.75, 0.275, 0.48), dot: 'amber' };

/** W03 is the whole loop (frames 0–359): the title card begins and ends on the bare stage (rulings Q28, Q40, Q51). */
const W03 = wordmark('W03', 360, 'cut');
const W04 = frameShot('W04', 300, 'section', {
  shot: SHOTS.library,
  depth: TURN_AFTER,
  caption: ['An AI text RPG.', 'Play any world you can imagine.'],
  dot: 'purple',
  camera: both(FULL),
});
/** The two play stacks: the turn, then what it updates; the entity, then the chat with it (ruling Q67). */
const TURN_PANES: readonly GrowingPane[] = [
  {
    shot: { wide: SHOTS.narrationClip, tall: SHOTS.narrationClipTall },
    camera: layouts(hold(1.5, 0.5, 0.32), hold(1, 0.5, 0)),
    typed: { prompt: TURN_PROMPT, caption: 'The narrator continues the story.' },
  },
  {
    shot: SHOTS.statsClip,
    caption: ['Every turn updates your stats.'],
    dot: 'mint',
    callout: { region: { x: 0.745, y: 0.205, width: 0.24, height: 0.37 }, from: 36 },
    camera: layouts(hold(1.8, 0.72, 0.38), hold(1.8, 0.8, 0.38)),
  },
];
const ENTITY_PANES: readonly GrowingPane[] = [
  { shot: SHOTS.entity, caption: ['Talk to anyone you meet.'], dot: 'pink', camera: both(hold(1.45, 0.5, 0.44)) },
  { shot: SHOTS.chat, caption: ['Chat with anyone in your library.'], dot: 'sky', camera: both(FULL) },
];
const W05 = growing('W05', 'section', 'wide', TURN_PANES, TURN_STACK);
const W07 = growing('W07', 'section', 'wide', ENTITY_PANES, ENTITY_STACK);
const W09 = kinetic('W09', 175, 'overlap', { lines: ['Build your own world.'] });
/** The authoring section: one stack of map, profile, travel, traits and inventory (rulings Q61, Q68). */
const BUILD_PANES: readonly GrowingPane[] = [
  { shot: SHOTS.canvas, caption: ['Place locations on a map.'], camera: both(FULL), dot: 'mint' },
  { shot: SHOTS.profile, caption: ['Write who lives there.'], camera: both(hold(1.5, 0.68, 0.42)), dot: 'rose' },
  { shot: SHOTS.travel, caption: ['Then travel there and meet them.'], camera: both(hold(1.6, 0.5, 0.3)), dot: 'sky' },
  { shot: SHOTS.blueprints, caption: ['Define your world and everyone in it, your way.'], camera: layouts(FULL, hold(1.3, 0.34, 0.52)), dot: 'amber' },
  { shot: SHOTS.inventory, caption: ['Give them items to carry, wear and use.'], camera: both(hold(2.09, 0.8675, 0.3925)), dot: 'amber' },
];
const W10 = growing('W10', 'overlap', 'wide', BUILD_PANES, BUILD_STACK);
const W13a = kinetic('W13a', 176, 'overlap', { lines: ['Need help? Just ask.'] });
const W13 = frameShot('W13', 380, 'section', {
  shot: SHOTS.helpClip,
  depth: SHOTS.canvas,
  caption: ['Ask your AI guide Morphie for help at any time.'],
  dot: 'pink',
  camera: both(hold(2, 0.75, 0.75)),
});
/** The title card before the world grid (ruling Q69). */
const W14a = kinetic('W14a', 175, 'overlap', { lines: ['Join the community.'] });
const W14 = frameShot('W14', 305, 'overlap', { shot: COMMUNITY.shot, depth: SHOTS.contest, caption: COMMUNITY.caption, dot: COMMUNITY.dot, camera: both(FULL) });
const W15 = dense(frameShot('W15', 383, 'section', {
  shot: CONTEST.shot,
  depth: SHOTS.community,
  caption: CONTEST.caption,
  dot: CONTEST.dot,
  callout: { region: { x: 0.135, y: 0.205, width: 0.85, height: 0.09 } },
  // Zoomed only as far as keeps the whole podium callout in frame.
  camera: both(hold(1.12, 0.55, 0.46)),
}));
const W16 = kinetic('W16', 350, 'overlap', { lines: ['Use any AI model.', 'Run it fully local, with no extra software to install.'] });
/** The tall cut keeps the one line: the second does not hold on mobile (ruling Q58). */
const T12 = kinetic('T12', 160, 'overlap', { lines: ['Use any AI model.'] });
const W17 = frameShot('W17', 310, 'overlap', {
  shot: SHOTS.engine,
  depth: TURN_AFTER,
  caption: ['Play in your browser or offline on your desktop.'],
  dot: 'purple',
  camera: layouts(hold(1.5, 0.5, 0.47), hold(1.1, 0.5, 0.47)),
  cards: { tall: SQUARE_TALL },
});
const W19 = title('W19', 376, { text: 'Play free at formamorph.ai', link: 'formamorph.ai' });

const T05 = growing('T05', 'section', 'tall', TURN_PANES, TURN_STACK);
const T06 = growing('T06', 'section', 'tall', ENTITY_PANES, ENTITY_STACK);
const T09 = growing('T09', 'section', 'tall', BUILD_PANES, BUILD_STACK);
/** The contest pane is the dense one. */
const T11 = dense(stack('T11', 403, 'section', [COMMUNITY, CONTEST]), paneRise(1));

/** The wide cut: storyboard §2. */
const WIDE: SceneEntry[] = [W03, W04, W05, W07, W09, W10, W13a, W13, W14a, W14, W15, W16, W17, W19];

/** The tall cut: storyboard §4. It drops Morphie with its title card (W13a, W13). */
const TALL: SceneEntry[] = [
  reuse('T03', W03),
  reuse('T04', W04),
  T05,
  T06,
  reuse('T08', W09),
  T09,
  reuse('T11a', W14a),
  T11,
  T12,
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
    stackRises: scene.stackRises,
    from: scenes.slice(0, i).reduce((sum, before, j) => sum + before.durationInFrames - joinFrames(scenes, j), 0),
  }));
};

/** A cut's length: the scenes end to end, less the frames each join overlaps. */
export const totalFrames = (layout: Layout) => {
  const scenes = TIMELINES[layout];
  return scenes.reduce((sum, scene, i) => sum + scene.durationInFrames - joinFrames(scenes, i), 0);
};

/** Where a cover sits on the canvas. A card grows by its bob, since it floats on its own. */
const coverBoxes = async (layout: Layout, cover: Cover): Promise<Rect[]> => {
  if ('pills' in cover) return measurePills(cover.pills);
  const box = cardBox(layout, cover.card);
  return [{ ...box, y: box.y - cover.bob, height: box.height + 2 * cover.bob }];
};

/** Every camera in a cut, measured on the frames each scene plays against what its scene draws over it. Runs in the browser, which lays out the copy. */
export const cameraReport = async (layout: Layout): Promise<CameraReading[]> => {
  const readings: CameraReading[] = [];
  for (const scene of TIMELINES[layout]) {
    const covers = await Promise.all(scene.covers(layout).map(async (cover) => ({ pane: cover.pane, boxes: await coverBoxes(layout, cover) })));
    for (const use of scene.cameras(layout)) {
      const over = covers.filter(({ pane }) => pane === undefined || pane === use.pane).flatMap(({ boxes }) => boxes);
      readings.push(readCamera(layout, scene.id, use, scene.durationInFrames, over));
    }
  }
  return readings;
};

/** Every text element in a cut, measured against the frame's margin on every frame its scene plays (ruling Q70). Runs in the browser, which lays out the copy. */
export const onScreenReport = async (layout: Layout): Promise<TextReading[]> => {
  const starts = sceneStarts(layout);
  const readings = await Promise.all(
    TIMELINES[layout].map(async (scene, i) => (await scene.texts(layout)).map((track) => readText(layout, scene.id, track, scene.durationInFrames, starts[i].from))),
  );
  return readings.flat();
};

/** Every line of copy in a cut, measured against the reading bar on the frames no join covers. */
export const readingReport = (layout: Layout): LineReading[] => {
  const scenes = TIMELINES[layout];
  return scenes.flatMap((scene, i) => readLines(scene.id, scene.reads, scene.durationInFrames, joinFrames(scenes, i - 1), joinFrames(scenes, i), FPS));
};

/** Every dense card in a cut, its hold measured from the frame it lands on the frames no join covers. */
export const denseReport = (layout: Layout): DenseReading[] => {
  const scenes = TIMELINES[layout];
  return scenes.flatMap((scene, i) =>
    scene.denseRise === null || scene.stackHolds
      ? []
      : [readDenseHold(scene.id, scene.denseRise + cardLandFrames(FPS), exitStart(scene.durationInFrames), scene.durationInFrames, joinFrames(scenes, i), FPS)],
  );
};

/** Every growing stack's card holds in a cut. */
export const stackReport = (layout: Layout): StackHoldReading[] => {
  const scenes = TIMELINES[layout];
  return scenes.flatMap((scene, i) => scene.stackHolds?.(scene.id, joinFrames(scenes, i)) ?? []);
};
