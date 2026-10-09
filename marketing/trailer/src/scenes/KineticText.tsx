import type { SceneProps } from '../layout';
import { Headline, type CopyLines } from '../parts/CopyBlock';

type KineticTextProps = SceneProps & {
  lines: CopyLines;
  /** Frame the first line starts to enter. */
  delay?: number;
};

/** One or two lines of copy that rise word by word over the stage, hold and leave. */
export const KineticText = ({ layout, durationInFrames, lines, delay }: KineticTextProps) => (
  <Headline lines={lines} layout={layout} durationInFrames={durationInFrames} delay={delay} />
);
