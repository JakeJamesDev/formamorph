import { motion, type Variants } from 'motion/react';
import { getVariants, useAnimateIconContext, IconWrapper, type IconProps } from '../animate-ui/icon';

type MasksProps = IconProps<keyof typeof animations>;

// Lucide `drama`. The front and back masks rock out of phase.
const animations = {
  default: {
    front: {
      initial: { rotate: 0, y: 0 },
      animate: {
        rotate: [0, -12, 8, 0],
        y: [0, -1, 0, 0],
        transition: { duration: 1.2, ease: 'easeInOut' },
      },
    },
    back: {
      initial: { rotate: 0, y: 0 },
      animate: {
        rotate: [0, 10, -6, 0],
        y: [0, 0, -1, 0],
        transition: { duration: 1.2, delay: 0.15, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: MasksProps) {
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
      <motion.g variants={variants.back} initial="initial" animate={controls}>
        <path d="M10.1 7.1C9 7.2 7.7 7.7 6 8.6c-3.5 2-4.7 3.9-3.7 5.6 4.5 7.8 9.5 8.4 11.2 7.4.9-.5 1.9-2.1 1.9-4.7" />
        <path d="M10 11h.01" />
        <path d="M6.5 13.1h.01" />
        <path d="M9.1 16.5c.3-1.1 1.4-1.7 2.4-1.4" />
      </motion.g>
      <motion.g variants={variants.front} initial="initial" animate={controls}>
        <path d="M22 5c0 9-4 12-6 12s-6-3-6-12c0-2 2-3 6-3s6 1 6 3" />
        <path d="M14 6h.01" />
        <path d="M18 6h.01" />
        <path d="M17.4 9.9c-.8.8-2 .8-2.8 0" />
      </motion.g>
    </motion.svg>
  );
}

/** The character requests' glyph: two theater masks that rock. */
export function Masks(props: MasksProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}
