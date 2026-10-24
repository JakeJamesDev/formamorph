import { motion, type Variants } from 'motion/react';
import { getVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../animate-ui/icon';

type QuillProps = IconProps<keyof typeof animations>;

// Lucide `feather`. The quill steps right while an ink line draws under it, then the ink fades.
const animations = {
  default: {
    quill: {
      initial: { x: 0, y: 0, rotate: 0 },
      animate: {
        x: [0, 1.5, 3, 4.5, 6, 0],
        y: [0, -1, 0, -1, 0, 0],
        rotate: [0, -5, 0, -5, 0, 0],
        transition: { duration: 1.6, times: [0, 0.15, 0.3, 0.45, 0.6, 1], ease: 'easeInOut' },
      },
    },
    ink: {
      initial: { pathLength: 0, opacity: 0 },
      animate: {
        pathLength: [0, 1, 1, 0],
        opacity: [1, 1, 0, 0],
        transition: { duration: 1.6, times: [0, 0.6, 0.85, 1], ease: ['linear', 'easeInOut', 'linear'] },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: QuillProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      overflow="visible"
      {...props}
    >
      <motion.path d="M2 22c1-1.2 2 1.2 3 0s2 1.2 3 0" variants={variants.ink} initial="initial" animate={controls} />
      <motion.g variants={variants.quill} initial="initial" animate={controls}>
        <path d="M14.086 18.412A2 2 0 0 1 12.67 19H5v-7.672a2 2 0 0 1 .586-1.414L11.75 3.75a6 6 0 1 1 8.49 8.49z" />
        <path d="M16 8 2 22" />
        <path d="M17.488 15H9" />
      </motion.g>
    </motion.svg>
  );
}

/** Narration's glyph: a quill that writes. */
export function Quill(props: QuillProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}
