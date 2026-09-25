import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { CodeLanguage, highlightCode } from '@/lib/codeHighlight';

type Highlighter = typeof highlightCode;

/**
 * Read-only code, colored the same way the editor colors it. No editor is mounted: the parser runs over
 * the string and the spans are dropped straight into the markup.
 *
 * The highlighter rides the same on-demand chunk as the editor, so a preview costs nothing until something
 * on screen needs it — and the plain code shows in the meantime, which is the whole content either way.
 */
export function HighlightedCode({ code, slots, language, className }: {
  code: string;
  /** Mark `{{name:type=default}}` spans as fill-in points rather than reading them as JavaScript. */
  slots?: boolean;
  /** The grammar to read the code with. JavaScript unless given. */
  language?: CodeLanguage;
  className?: string;
}) {
  const [highlight, setHighlight] = useState<{ run: Highlighter } | null>(null);

  useEffect(() => {
    let live = true;
    void import('@/lib/codeHighlight').then((module) => {
      if (live) setHighlight({ run: module.highlightCode });
    });
    return () => { live = false; };
  }, []);

  return (
    <pre className={cn('overflow-auto font-mono whitespace-pre-wrap break-words', className)}>
      {highlight
        ? highlight.run(code, { slots, language }).map((token, index) => (
          <span key={index} className={token.className || undefined}>{token.text}</span>
        ))
        : code}
    </pre>
  );
}

export default HighlightedCode;
