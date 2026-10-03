import { useMemo, type Dispatch, type SetStateAction } from 'react';
import type { RevealAnimationSource } from '@/components/RevealAnimationDemo';
import { helpRevealSpec, type HelpReveal } from '@/lib/formaquestion/helpReveal';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

/** The reveal dialog's settings source over help's reveal values. */
export function useHelpRevealSource(reveal: HelpReveal, onChange: (change: Partial<HelpReveal>) => void): RevealAnimationSource {
  const prefersReducedMotion = usePrefersReducedMotion();
  return useMemo(() => {
    const set = <K extends keyof HelpReveal>(key: K): Dispatch<SetStateAction<HelpReveal[K]>> => (action) => {
      const value = typeof action === 'function' ? (action as (prev: HelpReveal[K]) => HelpReveal[K])(reveal[key]) : action;
      onChange({ [key]: value } as Partial<HelpReveal>);
    };
    return {
      revealSpec: helpRevealSpec(reveal, prefersReducedMotion),
      prefersReducedMotion,
      revealFade: reveal.fade, setRevealFade: set('fade'),
      revealMove: reveal.move, setRevealMove: set('move'),
      revealMoveDirection: reveal.moveDirection, setRevealMoveDirection: set('moveDirection'),
      revealMoveDistance: reveal.moveDistance, setRevealMoveDistance: set('moveDistance'),
      revealScale: reveal.scale, setRevealScale: set('scale'),
      revealScaleMode: reveal.scaleMode, setRevealScaleMode: set('scaleMode'),
      revealScaleDirection: reveal.scaleDirection, setRevealScaleDirection: set('scaleDirection'),
      revealScaleAmount: reveal.scaleAmount, setRevealScaleAmount: set('scaleAmount'),
      revealBlur: reveal.blur, setRevealBlur: set('blur'),
      revealBlurAmount: reveal.blurAmount, setRevealBlurAmount: set('blurAmount'),
      revealEasing: reveal.easing, setRevealEasing: set('easing'),
      revealMinDuration: reveal.minDuration, setRevealMinDuration: set('minDuration'),
      revealMinStagger: reveal.minStagger, setRevealMinStagger: set('minStagger'),
    };
  }, [reveal, onChange, prefersReducedMotion]);
}
