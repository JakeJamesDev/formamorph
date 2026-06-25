import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

// Maps markdown elements to Tailwind classes that fit the story box's dark theme (no `prose` reset).
const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="line-through">{children}</del>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  h1: ({ children }) => <h1 className="text-lg font-bold mt-1 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold mt-1 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-bold mt-1 mb-1">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-3 italic text-muted-foreground mb-2">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="underline text-primary">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border px-2 py-1 text-left font-semibold bg-muted">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1 align-top">{children}</td>,
  pre: ({ children }) => (
    <pre className="bg-background/60 rounded p-2 overflow-x-auto mb-2 text-sm">{children}</pre>
  ),
  code: ({ className, children }) =>
    /language-/.test(className ?? '') ? (
      <code className={className}>{children}</code> // fenced block — `pre` provides the styling
    ) : (
      <code className="bg-background/60 rounded px-1 py-0.5 text-[0.9em] font-mono">{children}</code>
    ),
};

/** Renders AI narration as GitHub-flavored Markdown. Safe by default — react-markdown ignores raw HTML. */
export const GameText = memo(function GameText({ text }: { text: string }) {
  return (
    <div className="break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
