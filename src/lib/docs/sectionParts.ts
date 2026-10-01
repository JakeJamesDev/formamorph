/**
 * Splits an oversized docs section into parts at block boundaries: top-level list items, paragraphs, code
 * fences and table rows. Each part keeps the heading line. A part that starts inside a table repeats its
 * header row. A list item over the limit splits at its nested items, and each part repeats its lead line.
 * A block that still does not fit is cut, with a marker.
 */

import { FENCE } from './headingAnchors';

/** The line that ends a block cut to fit the limit. */
export const SECTION_CUT_MARKER = '*[Cut for length. The full text is on the wiki page.]*';

const TOP_LEVEL_ITEM = /^(?:[-*+]|\d+[.)])\s/;
const ANY_ITEM = /^(\s*)(?:[-*+]|\d+[.)])\s/;
const TABLE_ROW = /^\s{0,3}\|/;
const TABLE_SEPARATOR = /^\s{0,3}\|[\s:|-]+\|\s*$/;

/** A line that a part repeats when it starts inside the block that owns it. Compared by identity. */
interface HeaderLine {
  text: string;
}

interface Block {
  lines: string[];
  /** The table header or list lead lines above this block, outermost first. */
  header: HeaderLine[];
  isListItem: boolean;
}

function isBlank(line: string): boolean {
  return line.trim() === '';
}

/** The blocks of a section body, each with the blank lines that follow it. */
function blocksOf(body: string[]): Block[] {
  const blocks: Block[] = [];
  const addBlock = (lines: string[], header: HeaderLine[] = [], isListItem = false) => blocks.push({ lines, header, isListItem });
  let i = 0;
  while (i < body.length) {
    const line = body[i];
    if (isBlank(line)) {
      blocks.at(-1)?.lines.push(line);
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    let end = i + 1;
    if (fence) {
      while (end < body.length && FENCE.exec(body[end])?.[1] !== fence[1]) end++;
      addBlock(body.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    if (TABLE_ROW.test(line)) {
      end = i;
      while (end < body.length && TABLE_ROW.test(body[end])) end++;
      const rows = body.slice(i, end);
      const hasHeader = rows.length > 1 && TABLE_SEPARATOR.test(rows[1]);
      const header = hasHeader ? rows.slice(0, 2).map((text) => ({ text })) : [];
      if (hasHeader && rows.length === 2) addBlock(rows.slice(0, 2));
      for (const row of hasHeader ? rows.slice(2) : rows) addBlock([row], header);
    } else if (TOP_LEVEL_ITEM.test(line)) {
      // An item runs on through indented lines, lazy continuation lines, and blank lines before indented ones.
      while (end < body.length && !TOP_LEVEL_ITEM.test(body[end])) {
        if (isBlank(body[end]) && !/^\s/.test(body[end + 1] ?? '')) break;
        end++;
      }
      addBlock(body.slice(i, end), [], true);
    } else {
      while (end < body.length && !isBlank(body[end])) end++;
      addBlock(body.slice(i, end));
    }
    i = end;
  }
  return blocks;
}

const render = (lines: string[]) => lines.join('\n').trimEnd();

/** A list item over the limit as its nested items, each under the item's lead lines; else the item itself. */
function expandItem(block: Block, limit: number): Block[] {
  if (!block.isListItem || render(block.lines).length <= limit) return [block];
  const indents = block.lines.slice(1).flatMap((line) => {
    const item = ANY_ITEM.exec(line);
    return item ? [item[1].length] : [];
  });
  const parentIndent = ANY_ITEM.exec(block.lines[0])?.[1].length ?? 0;
  const childIndent = Math.min(...indents.filter((indent) => indent > parentIndent));
  if (!Number.isFinite(childIndent)) return [block];
  const starts = block.lines.flatMap((line, k) => (k > 0 && ANY_ITEM.exec(line)?.[1].length === childIndent ? [k] : []));
  const header = [...block.header, ...block.lines.slice(0, starts[0]).filter((line) => !isBlank(line)).map((text) => ({ text }))];
  return starts.flatMap((start, k) =>
    expandItem({ lines: block.lines.slice(start, starts[k + 1]), header, isListItem: true }, limit),
  );
}

/** The marker of the code fence still open at the end of `lines`, or null. */
function openFence(lines: string[]): string | null {
  let fence: string | null = null;
  for (const line of lines) {
    const marker = FENCE.exec(line)?.[1] ?? null;
    if (marker !== null && fence === null) fence = marker;
    else if (marker !== null && marker === fence) fence = null;
  }
  return fence;
}

/** Cuts `text` at a line break inside the limit and adds the marker; a cut code fence is closed first. */
function cutToLimit(text: string, limit: number): string {
  const room = limit - SECTION_CUT_MARKER.length - '\n```\n\n'.length;
  const breakAt = text.lastIndexOf('\n', room);
  const kept = text.slice(0, breakAt > 0 ? breakAt : room).trimEnd();
  const fence = openFence(kept.split('\n'));
  return `${kept}${fence ? `\n${fence}` : ''}\n\n${SECTION_CUT_MARKER}`;
}

/**
 * The parts of one section's markdown, each at most `limit` characters; one part when it fits.
 *
 * @param hasHeading - Whether the first line is the section's heading, which every part repeats
 */
export function sectionParts(markdown: string, hasHeading: boolean, limit: number): string[] {
  if (markdown.length <= limit) return [markdown];
  const lines = markdown.split('\n');
  const opening = hasHeading ? [lines[0], ''] : [];
  const parts: string[][] = [];
  let current: string[] = [...opening];
  let openHeader: HeaderLine[] = [];
  /** The part with the block added, writing only the header lines the part has not already opened. */
  const withBlock = (part: string[], block: Block, open: HeaderLine[]) => {
    let shared = 0;
    while (shared < open.length && open[shared] === block.header[shared]) shared++;
    return [...part, ...block.header.slice(shared).map((line) => line.text), ...block.lines];
  };
  const blocks = blocksOf(hasHeading ? lines.slice(1) : lines).flatMap((block) => expandItem(block, limit));
  for (const block of blocks) {
    const grown = withBlock(current, block, openHeader);
    if (render(grown).length > limit && current.length > opening.length) {
      parts.push(current);
      current = withBlock([...opening], block, []);
    } else {
      current = grown;
    }
    openHeader = block.header;
  }
  parts.push(current);
  return parts.map(render).map((text) => (text.length > limit ? cutToLimit(text, limit) : text));
}
