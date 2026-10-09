import type { Size } from './layout';
import { cameraAt, type CameraPath } from './parts/FrameCamera';
import type { Shot } from './shots';

/** One camera in a scene: the shot it films, its path and the area it fills. `pane` names a stack pane. */
export type CameraUse = { shot: Shot; path: CameraPath; size: Size; pane?: number };

/**
 * One camera's move in a cut. Zoom is relative to the zoom that just covers the area. `travelPercent` is how far
 * the shot moves on screen, as a share of the area. `linear` is true when the shot point at the center and the
 * zoom both move at a constant rate, which a clamp at the shot's edge would break.
 */
export type CameraReading = { shot: string; pane: number | null; zoomFrom: number; zoomTo: number; travelPercent: number; linear: boolean };

const SAMPLES = [0.25, 0.5, 0.75];
const EPSILON = 1e-6;

/** Measures a camera on the frames the scene plays, through the same function the scene uses. */
export const readCamera = (shotId: string, { shot, path, size, pane }: CameraUse, durationInFrames: number): CameraReading => {
  const last = durationInFrames - 1;
  const at = (t: number) => {
    const { x, y, scale } = cameraAt(t * last, durationInFrames, shot, path, size);
    return { x, y, scale, cx: (size.width / 2 - x) / scale / shot.width, cy: (size.height / 2 - y) / scale / shot.height };
  };
  const [start, end] = [at(0), at(1)];
  const linear = SAMPLES.every((t) => {
    const mid = at(t);
    const lerp = (a: number, b: number) => a + (b - a) * t;
    return (['cx', 'cy', 'scale'] as const).every((key) => Math.abs(mid[key] - lerp(start[key], end[key])) < EPSILON);
  });
  const base = Math.max(size.width / shot.width, size.height / shot.height);
  const travel = Math.max(Math.abs(end.x - start.x) / size.width, Math.abs(end.y - start.y) / size.height);
  return { shot: shotId, pane: pane ?? null, zoomFrom: start.scale / base, zoomTo: end.scale / base, travelPercent: travel * 100, linear };
};
