import { memo } from 'react';
import { Streamdown } from 'streamdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import 'streamdown/styles.css';

/**
 * Renders AI narration as GitHub-flavored Markdown via Streamdown, which formats incomplete markdown
 * as it streams in. `controls={false}` hides the table/code copy/download buttons we don't need.
 */
export const GameText = memo(function GameText({ text }: { text: string }) {
  return (
    <div className="break-words">
      <Streamdown remarkPlugins={[remarkGfm, remarkBreaks]} controls={false}>
        {text}
      </Streamdown>
    </div>
  );
});
