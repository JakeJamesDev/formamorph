import { toHtml } from 'hast-util-to-html';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

const markdown = unified().use(remarkParse).use(remarkRehype);

/** Render trusted policy markdown without pulling the game's syntax highlighter into the site bundle. */
export function SiteMarkdown({ text }: { text: string }) {
  const html = toHtml(markdown.runSync(markdown.parse(text)));

  return (
    <div
      className="min-w-0 break-words text-body text-foreground space-y-3 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-title [&_h1]:font-semibold [&_h2]:text-title [&_h2]:font-semibold [&_h3]:text-label [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_strong]:font-semibold [&_ul]:list-disc"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
