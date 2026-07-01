import { memo } from 'react';
import { Streamdown } from 'streamdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import 'streamdown/styles.css';

/**
 * Renders text as GitHub-flavored Markdown via Streamdown, which formats incomplete markdown as it
 * streams in. Used for AI narration and for world descriptions. `controls={false}` hides the
 * table/code copy/download buttons we don't need.
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({ text }: { text: string }) {
  return (
    <div className="[overflow-wrap:anywhere]">
      <Streamdown remarkPlugins={[remarkGfm, remarkBreaks]} controls={false}>
        {text}
      </Streamdown>
    </div>
  );
});
