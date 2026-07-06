import { memo } from 'react';
import { Streamdown } from 'streamdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { REVEAL_ANIMATION } from '@/lib/narrationRevealConfig';
import 'streamdown/styles.css';

/**
 * Renders text as GitHub-flavored Markdown via Streamdown, which formats incomplete markdown as it
 * streams in. Used for AI narration and for world descriptions. `controls={false}` hides the
 * table/code copy/download buttons we don't need.
 *
 * `animate` fades each newly-streamed word in (Streamdown's native per-token fadeIn) — used for the
 * live narration reveal; off for committed/static text so it doesn't re-fade on pagination.
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({ text, animate = false }: { text: string; animate?: boolean }) {
  return (
    <div className="[overflow-wrap:anywhere]">
      <Streamdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        controls={false}
        animated={animate ? REVEAL_ANIMATION : false}
        isAnimating={animate}
      >
        {text}
      </Streamdown>
    </div>
  );
});
