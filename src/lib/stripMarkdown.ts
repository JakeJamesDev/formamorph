import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFlexibleMarkers from 'remark-flexible-markers';
import { remarkSubSuper } from './remarkSubSuper';

// Match MarkdownRenderer's syntax without loading its React or highlighting dependencies.
const parser = unified()
  .use(remarkParse)
  .use(remarkGfm, { singleTilde: false })
  .use(remarkSubSuper)
  .use(remarkFlexibleMarkers, { actionForEmptyContent: 'remove' });

interface TextNode {
  type: string;
  value?: string;
  alt?: string | null;
  children?: TextNode[];
}

function readableText(node: TextNode): string {
  switch (node.type) {
    case 'text':
    case 'inlineCode':
    case 'code':
      return node.value ?? '';
    case 'image':
    case 'imageReference':
      return node.alt ?? '';
    case 'break':
      return '\n';
    case 'definition':
    case 'html':
      return '';
  }
  const separator = node.type === 'tableRow' ? ' '
    : ['root', 'blockquote'].includes(node.type) ? '\n\n'
    : ['list', 'listItem', 'table'].includes(node.type) ? '\n' : '';
  return (node.children ?? []).map(readableText).filter(Boolean).join(separator);
}

/** Extract readable Markdown text, preserving literal punctuation and paragraph boundaries. */
export function stripMarkdown(text: string): string {
  return readableText(parser.runSync(parser.parse(text)));
}
