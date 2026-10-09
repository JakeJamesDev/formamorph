import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { CANVAS, type Layout } from '../layout';
import { colors } from '../theme';

/** Ruling Q28: the blobs repeat every 359 frames, so frame 0 and frame 359 of the 6 s loop are the same image. */
export const STAGE_PERIOD = 359;

/** One glowing blob: its center and diameter as fractions of the canvas width, its orbit in pixels and its phase. */
type Blob = { color: string; x: number; y: number; size: number; orbit: [number, number]; phase: number };

const BLOBS: Record<Layout, Blob[]> = {
  wide: [
    { color: colors.blobs.purple, x: 0.2, y: 0.1, size: 0.68, orbit: [64, 48], phase: 0 },
    { color: colors.blobs.rose, x: 0.86, y: 0.55, size: 0.58, orbit: [56, 60], phase: 2.1 },
    { color: colors.blobs.sky, x: 0.5, y: 0.95, size: 0.48, orbit: [60, 44], phase: 4.2 },
  ],
  tall: [
    { color: colors.blobs.purple, x: 0.15, y: 0.18, size: 1.2, orbit: [48, 64], phase: 0 },
    { color: colors.blobs.rose, x: 0.95, y: 0.95, size: 1.05, orbit: [60, 56], phase: 2.1 },
    { color: colors.blobs.sky, x: 0.35, y: 1.65, size: 0.95, orbit: [44, 60], phase: 4.2 },
  ],
};

/** The dark stage with slow glowing blobs in the brand palette. It sits under a whole cut and never cuts. */
export const Stage = ({ layout }: { layout: Layout }) => {
  const frame = useCurrentFrame();
  const { width } = CANVAS[layout];
  // The modulo makes frame 359 land on exactly the angle of frame 0.
  const angle = ((frame % STAGE_PERIOD) / STAGE_PERIOD) * Math.PI * 2;
  return (
    <AbsoluteFill style={{ background: colors.stage, overflow: 'hidden' }}>
      {BLOBS[layout].map((blob) => {
        const size = blob.size * width;
        return (
          <div
            key={blob.color}
            style={{
              position: 'absolute',
              left: blob.x * width - size / 2 + Math.sin(angle + blob.phase) * blob.orbit[0],
              top: blob.y * width - size / 2 + Math.cos(angle + blob.phase) * blob.orbit[1],
              width: size,
              height: size,
              borderRadius: '50%',
              // Eased stops give the glow a soft edge without a blur filter, which would slow every frame.
              background: `radial-gradient(circle, ${blob.color} 0%, ${blob.color}b3 22%, ${blob.color}66 40%, ${blob.color}26 56%, ${blob.color}0a 66%, ${blob.color}00 72%)`,
              opacity: 0.55,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
