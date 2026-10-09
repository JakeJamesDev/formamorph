import { AbsoluteFill, Freeze, Img, OffthreadVideo, interpolate, useCurrentFrame } from 'remotion';
import { CANVAS, type Layout, type Size } from '../layout';
import type { Shot } from '../shots';
import { colors, shade } from '../theme';

/** A camera position: the shot point at the canvas center (0–1 per axis) and a zoom where 1 covers the canvas. */
export type CameraStop = { focusX: number; focusY: number; zoom: number };

/** A camera move across a scene at a constant rate (ruling Q22). Equal stops hold. */
export type CameraPath = { from: CameraStop; to: CameraStop };

/** A highlighted region of the shot, in 0–1 fractions of the shot, with the frame it starts to show. */
export type Callout = { region: { x: number; y: number; width: number; height: number }; from?: number };

const CALLOUT_FADE_FRAMES = 18;
const CALLOUT_DEFAULT_FROM = 36;

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

/** Where the camera puts the shot on `frame`: it moves from `from` to `to` in a straight line at a constant rate. */
export const cameraAt = (frame: number, durationInFrames: number, shot: Shot, path: CameraPath, canvas: Size) => {
  const t = interpolate(frame, [0, durationInFrames - 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const at = (key: keyof CameraStop) => path.from[key] + (path.to[key] - path.from[key]) * t;
  return cameraTransform({ focusX: at('focusX'), focusY: at('focusY'), zoom: at('zoom') }, shot, canvas);
};

type FrameCameraProps = {
  layout: Layout;
  durationInFrames: number;
  shot: Shot;
  path: CameraPath;
  callout?: Callout;
  /** The area the camera fills. Defaults to the whole canvas. */
  size?: Size;
};

/** A captured UI shot or clip with the camera moving over it across the scene. */
export const FrameCamera = ({ layout, durationInFrames, shot, path, callout, size = CANVAS[layout] }: FrameCameraProps) => {
  const frame = useCurrentFrame();
  const { x, y, scale } = cameraAt(frame, durationInFrames, shot, path, size);
  const calloutFrom = callout?.from ?? CALLOUT_DEFAULT_FROM;
  const calloutOpacity = interpolate(frame, [calloutFrom, calloutFrom + CALLOUT_FADE_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: shot.width,
          height: shot.height,
          transformOrigin: '0 0',
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
        }}
      >
        {shot.clipFrames ? (
          // The clip holds its first frame until it starts, plays once, then holds its last frame.
          <Freeze frame={Math.min(shot.clipFrames - 1, Math.max(0, frame - (shot.clipFrom ?? 0)))}>
            <OffthreadVideo src={shot.src} muted style={{ width: shot.width, height: shot.height, display: 'block' }} />
          </Freeze>
        ) : (
          <Img src={shot.src} style={{ width: shot.width, height: shot.height, display: 'block' }} />
        )}
        {callout && (
          <div
            style={{
              position: 'absolute',
              left: callout.region.x * shot.width,
              top: callout.region.y * shot.height,
              width: callout.region.width * shot.width,
              height: callout.region.height * shot.height,
              boxSizing: 'border-box',
              // Screen-constant ring width and radius, whatever the zoom.
              border: `${5 / scale}px solid ${colors.accent}`,
              borderRadius: 22 / scale,
              // The spread dims everything outside the region; the shot's own bounds clip it.
              boxShadow: `0 0 0 3000px ${shade(0.55)}`,
              opacity: calloutOpacity,
            }}
          />
        )}
      </div>
    </AbsoluteFill>
  );
};
