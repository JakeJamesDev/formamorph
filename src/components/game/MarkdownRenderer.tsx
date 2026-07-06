import { memo } from 'react';
import { Streamdown } from 'streamdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { getRevealTiming } from '@/lib/revealTimingStore';
import 'streamdown/styles.css';

/**
 * Renders text as GitHub-flavored Markdown via Streamdown, which formats incomplete markdown as it
 * streams in. Used for AI narration and for world descriptions. `controls={false}` hides the
 * table/code copy/download buttons we don't need.
 *
 * `animate` runs the per-word entrance animation on newly-streamed words (used for the live narration
 * reveal; off for committed/static text so it doesn't re-animate on pagination). `animation` is the
 * Streamdown keyframe name (e.g. `moveIn`) and `easing` its timing function; timing (duration/stagger)
 * comes from the model's smoothed rate. Move/Grow/Stretch also read `--rl-*` vars + transform-origin
 * from the narration container (set by the caller).
 */
export const MarkdownRenderer = memo(function MarkdownRenderer(
  { text, animate = false, animation = 'fadeIn', easing }: { text: string; animate?: boolean; animation?: string; easing?: string },
) {
  // Read the current fade timing at render (a new sentence's release re-renders us via the text prop),
  // so the words just added animate at the model's current smoothed rate.
  return (
    <div className="[overflow-wrap:anywhere]">
      <Streamdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        controls={false}
        animated={animate ? { animation, sep: 'word', easing, ...getRevealTiming() } : false}
        isAnimating={animate}
      >
        {text}
      </Streamdown>
    </div>
  );
});
