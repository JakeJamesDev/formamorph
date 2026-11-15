// Mention links: a turn's resolved mentions as links in its rendered narration, for the hover cards.
import { LINK_MARK_PROPERTY, type RemarkPlugin } from '@/components/game/MarkdownRenderer';
import { parseSpanKey, spanKey, type TextSpan } from '@/lib/quoteSegments';
import type { MentionLink, MentionReading } from './mentionReading';
import { turnMentionReading, type MentionReadingMap } from './mentionReadings';

/** The mark a mention link carries, before `<start>:<end>:<entity id>` (its span in the narration). */
export const MENTION_MARK = 'mention:';

/** A mention mark's entity and narration span, or null for any other mark. */
export function parseMentionMark(mark: string): (TextSpan & { entityId: string }) | null {
  if (!mark.startsWith(MENTION_MARK)) return null;
  const rest = mark.slice(MENTION_MARK.length);
  const span = parseSpanKey(rest);
  const entityId = rest.slice(rest.indexOf(':', rest.indexOf(':') + 1) + 1);
  return span && entityId ? { ...span, entityId } : null;
}
/** A fragment, so the renderer's link hardening lets it through. */
const MENTION_HREF = '#mention';

/** A narration and its resolved mentions, whose spans index into it. */
export interface MentionLinkSource {
  text: string;
  mentions: readonly MentionLink[];
}

/** The mdast subset this walks; only the fields read are declared. */
interface MdastNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdastNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
  data?: { hProperties?: Record<string, string> };
}

/** A mention with its span relative to the rendered block, and its span in the narration. */
interface BlockMention { start: number; end: number; entityId: string; from: number; to: number }

/** The resolved mentions of `source`, outermost first where spans nest. */
function resolvedMentions(source: MentionLinkSource): (MentionLink & { entityId: string })[] {
  const sorted = source.mentions
    .filter((m): m is MentionLink & { entityId: string } => m.entityId !== null && m.end > m.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: (MentionLink & { entityId: string })[] = [];
  for (const mention of sorted) if (!kept.length || mention.start >= kept[kept.length - 1].end) kept.push(mention);
  return kept;
}

/**
 * The resolved mentions inside one markdown block, offset into the block's own source. The renderer parses
 * each block apart, so the block is found in the narration by its text. A block it cannot place gets none,
 * and so does one that occurs more than once with different mentions.
 */
export function blockMentions(source: MentionLinkSource, block: string): BlockMention[] {
  const body = block.trim();
  if (!body) return [];
  const lead = block.indexOf(body);
  const mentions = resolvedMentions(source);
  const inBlock = (at: number) => mentions
    .filter((m) => m.start >= at && m.end <= at + body.length)
    .map((m) => ({ start: m.start - at + lead, end: m.end - at + lead, entityId: m.entityId, from: m.start, to: m.end }));
  const found: BlockMention[][] = [];
  for (let at = source.text.indexOf(body); at >= 0; at = source.text.indexOf(body, at + 1)) found.push(inBlock(at));
  const [first, ...rest] = found;
  if (!first) return [];
  const same = (other: BlockMention[]) => other.length === first.length
    && other.every((m, i) => m.start === first[i].start && m.end === first[i].end && m.entityId === first[i].entityId);
  return rest.every(same) ? first : [];
}

const marked = (mention: BlockMention, typed: string): MdastNode => ({
  type: 'link',
  url: MENTION_HREF,
  children: [{ type: 'text', value: typed }],
  data: { hProperties: { [LINK_MARK_PROPERTY]: `${MENTION_MARK}${spanKey({ start: mention.from, end: mention.to })}:${mention.entityId}` } },
});

const WORD = /[\p{L}\p{N}]/u;

/** Where `typed` sits in a text node's value. Exact by offset when the value is its source; otherwise the
 *  next whole-word match from `cursor`, since an escape or entity shortens the value. */
function placeIn(value: string, sourceText: string, typed: string, offset: number, cursor: number): number {
  if (value === sourceText) return offset >= cursor ? offset : -1;
  for (let at = value.indexOf(typed, cursor); at >= 0; at = value.indexOf(typed, at + 1)) {
    if (!WORD.test(value[at - 1] ?? '') && !WORD.test(value[at + typed.length] ?? '')) return at;
  }
  return -1;
}

/**
 * Remark plugin that marks each resolved mention as `<a data-link-mark="mention:<start>:<end>:<id>">`, so the renderer can
 * draw it as a card trigger. Text inside a link or code stays as it is.
 *
 * Runs before any transformer that rebuilds text nodes, since a match needs the node's source offsets.
 */
export function remarkMentionLinks({ source }: { source: MentionLinkSource }) {
  return (tree: MdastNode, file: { value: unknown }) => {
    const block = String(file.value);
    const mentions = blockMentions(source, block);
    if (!mentions.length) return;

    const walk = (parent: MdastNode) => {
      if (!parent.children) return;
      const next: MdastNode[] = [];
      for (const node of parent.children) {
        const from = node.position?.start.offset;
        const to = node.position?.end.offset;
        if (from === undefined || to === undefined || node.type === 'link' || node.type === 'linkReference') {
          next.push(node);
          continue;
        }
        if (node.type === 'text' && node.value !== undefined) {
          const value = node.value;
          const sourceText = block.slice(from, to);
          let cursor = 0;
          for (const mention of mentions) {
            if (mention.start < from || mention.end > to) continue;
            const typed = block.slice(mention.start, mention.end);
            const at = placeIn(value, sourceText, typed, mention.start - from, cursor);
            if (at < 0) continue;
            if (at > cursor) next.push({ type: 'text', value: value.slice(cursor, at) });
            next.push(marked(mention, typed));
            cursor = at + typed.length;
          }
          if (cursor === 0) next.push(node);
          else if (cursor < value.length) next.push({ type: 'text', value: value.slice(cursor) });
          continue;
        }
        walk(node);
        next.push(node);
      }
      parent.children = next;
    };

    walk(tree);
  };
}

// One plugin per reading: the renderer memoizes on its identity.
const plugins = new WeakMap<MentionReading, Map<string, RemarkPlugin>>();

/** A turn's mention links for the renderer, or undefined when the feature is off, the turn has no reading,
 *  or the reading links no one. The same reading and narration always give the same plugin. */
export function turnMentionLinks(
  enabled: boolean, readings: MentionReadingMap, turnId: string | undefined, narration: string,
): RemarkPlugin | undefined {
  const reading = enabled ? turnMentionReading(readings, turnId, narration) : null;
  if (!reading?.mentions.some((mention) => mention.entityId)) return undefined;
  let byText = plugins.get(reading);
  if (!byText) {
    byText = new Map();
    plugins.set(reading, byText);
  }
  let plugin = byText.get(narration);
  if (!plugin) {
    plugin = [remarkMentionLinks, { source: { text: narration, mentions: reading.mentions } }];
    byText.set(narration, plugin);
  }
  return plugin;
}
