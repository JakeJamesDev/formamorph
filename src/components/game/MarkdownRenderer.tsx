import { memo, type ComponentProps } from 'react';
import { Streamdown } from 'streamdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { remarkSubSuper } from '@/lib/remarkSubSuper';
import { getRevealTiming } from '@/lib/revealTimingStore';
import { cn } from '@/lib/utils';
import 'streamdown/styles.css';

// `singleTilde: false` hands `~x~` to remarkSubSuper (subscript); GFM keeps `~~strike~~`.
const REMARK_PLUGINS: ComponentProps<typeof Streamdown>['remarkPlugins'] =
  [[remarkGfm, { singleTilde: false }], remarkBreaks, remarkSubSuper];

// Streamdown boxes every table in a bordered card inside a second bordered scroller. Our markdown
// surfaces are already panels, so that reads as a box in a box. Keep the scroller and the solid fill
// that sets rows off against a translucent panel; drop the borders.
const COMPONENTS: ComponentProps<typeof Streamdown>['components'] = {
  table: ({ node: _node, className, children, ...props }) => (
    <div
      className="my-4 overflow-x-auto rounded-md bg-background [&_tr]:divide-x [&_tr]:divide-border"
      data-streamdown="table-wrapper"
    >
      <table className={cn('w-full divide-y divide-border', className)} data-streamdown="table" {...props}>
        {children}
      </table>
    </div>
  ),
};

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
    <div className="[overflow-wrap:anywhere] [&_ul]:list-outside [&_ul]:pl-6 [&_ol]:list-outside [&_ol]:pl-6">
      <Streamdown
        remarkPlugins={REMARK_PLUGINS}
        components={COMPONENTS}
        controls={false}
        // Committed text renders straight from the parsed blocks. Streamdown's `streaming` mode routes
        // them through state committed in a transition, which leaves finished text a render behind —
        // visible when paging history, where nothing follows to flush it.
        mode={animate ? 'streaming' : 'static'}
        animated={animate ? { animation, sep: 'word', easing, ...getRevealTiming() } : false}
        isAnimating={animate}
      >
        {text}
      </Streamdown>
    </div>
  );
});
