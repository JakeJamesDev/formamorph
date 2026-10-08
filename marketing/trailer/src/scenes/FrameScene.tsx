import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from 'remotion';
import { CANVAS, type Layout, type SceneProps, type Size } from '../layout';
import type { Shot } from '../shots';
import { colors } from '../theme';

/** A camera position: the shot point at the canvas center (0–1 per axis) and a zoom where 1 covers the canvas. */
type CameraStop = { focusX: number; focusY: number; zoom: number };

type FrameSceneProps = SceneProps & {
  shot: Shot;
  camera: Record<Layout, { from: CameraStop; to: CameraStop }>;
};

const ease = Easing.inOut(Easing.cubic);

/** Places the shot so the focus point sits at the canvas center, clamped so the shot always covers the canvas. */
const cameraTransform = (stop: CameraStop, shot: Shot, canvas: Size) => {
  const scale = Math.max(canvas.width / shot.width, canvas.height / shot.height) * stop.zoom;
  const shownWidth = shot.width * scale;
  const shownHeight = shot.height * scale;
  const clamp = (value: number, min: number) => Math.min(0, Math.max(min, value));
  const x = clamp(canvas.width / 2 - stop.focusX * shownWidth, canvas.width - shownWidth);
  const y = clamp(canvas.height / 2 - stop.focusY * shownHeight, canvas.height - shownHeight);
  return { x, y, scale };
};

/** A captured UI shot with the camera moving over it from one stop to the next across the scene. */
export const FrameScene = ({ layout, durationInFrames, shot, camera }: FrameSceneProps) => {
  const frame = useCurrentFrame();
  const path = camera[layout];
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const stop: CameraStop = {
    focusX: interpolate(t, [0, 1], [path.from.focusX, path.to.focusX]),
    focusY: interpolate(t, [0, 1], [path.from.focusY, path.to.focusY]),
    zoom: interpolate(t, [0, 1], [path.from.zoom, path.to.zoom]),
  };
  const { x, y, scale } = cameraTransform(stop, shot, CANVAS[layout]);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.stage, overflow: 'hidden' }}>
      <Img
        src={shot.src}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: shot.width,
          height: shot.height,
          transformOrigin: '0 0',
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
        }}
      />
    </AbsoluteFill>
  );
};
