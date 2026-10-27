import { LINK_MARK_PROPERTY } from '@/components/game/MarkdownRenderer';
import { feedbackProfileUrl, feedbackThreadUrl, parseFeedbackLinks, type FeedbackLink, type FeedbackLinkKind } from './feedbackLinks';

/** The mdast subset this walks; only the fields read are declared. */
interface MdastNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdastNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
  data?: { hProperties?: Record<string, string> };
}

interface Options {
  /** The kinds to mark; a link of any other kind stays plain markdown. */
  kinds: ReadonlySet<FeedbackLinkKind>;
}

const isUrl = (text: string) => /^https?:/.test(text);

/** Where a link in text points: a pasted URL to itself, a sigil to the address its kind has. */
function hrefOf(link: FeedbackLink, typed: string): string {
  if (isUrl(typed)) return typed;
  return link.kind === 'user' ? feedbackProfileUrl(link.ref) : feedbackThreadUrl(link.ref);
}

const marked = (link: FeedbackLink, url: string, typed: string): MdastNode => ({
  type: 'link',
  url,
  children: [{ type: 'text', value: typed }],
  data: { hProperties: { [LINK_MARK_PROPERTY]: `${link.kind}:${link.ref}` } },
});

/**
 * Remark plugin that marks the links the feedback grammar finds as `<a data-link-mark="kind:ref">`, so
 * the renderer can draw each as a chip. Positions come from `parseFeedbackLinks` over the source, so the
 * rendering matches the grammar and the server: a markdown node gets a link only where the parser put one.
 *
 * Runs before any transformer that rebuilds text nodes, since a match needs the node's source offsets.
 */
export function remarkFeedbackLinks({ kinds }: Options) {
  return (tree: MdastNode, file: { value: unknown }) => {
    const source = String(file.value);
    const links = parseFeedbackLinks(source).filter((link) => kinds.has(link.kind));
    if (!links.length) return;

    const walk = (parent: MdastNode, insideLink: boolean) => {
      if (!parent.children) return;
      const next: MdastNode[] = [];
      for (const node of parent.children) {
        const from = node.position?.start.offset;
        const to = node.position?.end.offset;
        if (from === undefined || to === undefined) {
          next.push(node);
          continue;
        }

        if (node.type === 'link') {
          // A pasted URL, bare, in brackets or as a markdown link's address: the whole link is the chip.
          const link = links.find((l) => l.start >= from && l.end <= to && isUrl(source.slice(l.start, l.end)));
          if (link) {
            next.push(marked(link, node.url ?? '', source.slice(link.start, link.end)));
          } else {
            walk(node, true);
            next.push(node);
          }
          continue;
        }

        // A sigil inside another link's text stays plain: a link never nests in a link.
        if (node.type === 'text' && !insideLink && node.value !== undefined) {
          // An escape or entity elsewhere in the node shortens its value, so each link is found in the
          // value in order rather than at its source offset.
          const value = node.value;
          let cursor = 0;
          for (const link of links) {
            if (link.start < from || link.end > to) continue;
            const typed = source.slice(link.start, link.end);
            const at = value.indexOf(typed, cursor);
            if (at < 0) continue;
            if (at > cursor) next.push({ type: 'text', value: value.slice(cursor, at) });
            next.push(marked(link, hrefOf(link, typed), typed));
            cursor = at + typed.length;
          }
          if (cursor === 0) next.push(node);
          else if (cursor < value.length) next.push({ type: 'text', value: value.slice(cursor) });
          continue;
        }

        walk(node, insideLink);
        next.push(node);
      }
      parent.children = next;
    };

    walk(tree, false);
  };
}
