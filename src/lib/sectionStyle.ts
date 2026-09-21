import { PROMPT_TEXT_KEYS, type PromptValues, type SectionStyle } from './promptPresets';
import { parsePromptTemplate, serializeSegments } from './promptTemplate';
import { variableForToken, variableAxes, decodeVariant, encodeVariant, baseToken, tokenVariant, splitToken, joinToken } from './promptVariables';

// Built-ins derive from canonical Markdown; raw Header data stays on its placement.

const HEADER_LINE = /^#{1,6}[ \t]+(.+?)[ \t]*$/gm;
const HEADER_TEST = /^(#{1,6})[ \t]+(.+?)[ \t]*$/;

/** Slugify a heading into an XML tag name: lowercase, non-alphanumerics collapsed to `_`, edges trimmed. */
function xmlTag(heading: string): string {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Wrap each markdown section in `<tag>…</tag>`. Level-aware: a header of level N closes any open section of
 *  level ≥ N; all remaining tags close at EOF. Preamble before the first header stays outside any tag. */
function wrapXml(text: string, affixLevels: (number | undefined)[]): string {
  const out: string[] = [];
  const stack: { level: number; tag: string }[] = [];
  const closeTo = (level: number) => {
    const tags: string[] = [];
    while (stack.length && stack[stack.length - 1].level >= level) tags.push(`</${stack.pop()!.tag}>`);
    return tags;
  };
  for (const line of text.split('\n')) {
    const m = HEADER_TEST.exec(line);
    if (!m) {
      out.push(line.replace(MASKED, (mask, index: string) => {
        // Conditional headings close surrounding sections outside the optional chip.
        const closes = closeTo(affixLevels[Number(index)] ?? Infinity);
        return closes.length ? `${closes.join('\n')}\n${mask}` : mask;
      }));
      continue;
    }
    const level = m[1].length;
    const tag = xmlTag(m[2]);
    out.push(...closeTo(level));
    out.push(`<${tag}>`);
    stack.push({ level, tag });
  }
  out.push(...closeTo(0));
  return out.join('\n');
}

const toLabel = (text: string) => text.replace(HEADER_LINE, (_line, heading: string) => `${heading.toUpperCase()}:`);

/** Restyle the headings inside a placement's affixes. In xml, each one opens a tag that closes at the end of
 *  the placement, before the suffix's trailing whitespace, so the section vanishes with the value. */
function restyleAffixes(token: string, style: Exclude<SectionStyle, 'markdown'>): string {
  const parts = splitToken(token);
  if (!parts || (!parts.pre && !parts.post)) return token;
  if (style === 'labels') return joinToken({ ...parts, pre: toLabel(parts.pre), post: toLabel(parts.post) });
  const opened: string[] = [];
  const open = (text: string) => text.replace(HEADER_LINE, (_line, heading: string) => {
    opened.push(xmlTag(heading));
    return `<${xmlTag(heading)}>`;
  });
  const pre = open(parts.pre);
  const tail = /\s*$/.exec(parts.post)![0];
  const body = open(parts.post.slice(0, parts.post.length - tail.length));
  const closes = opened.reverse().map((tag) => `\n</${tag}>`).join('');
  return joinToken({ ...parts, pre, post: `${body}${closes}${tail}` });
}

// A token is masked while the line transforms run: an affix can span lines, and a heading inside one must
// not be read as a header line of the template itself.
const MASK = String.fromCharCode(0);
const MASKED = new RegExp(`${MASK}([0-9]+)${MASK}`, 'g');

/** Rewrite markdown section headers in `text` into `style` (markdown = identity), affixes included. */
export function restyle(text: string, style: SectionStyle): string {
  if (style === 'markdown') return text;
  const tokens: string[] = [];
  const affixLevels: (number | undefined)[] = [];
  const masked = parsePromptTemplate(text)
    .map((seg) => {
      if (seg.type === 'text') return seg.value;
      const parts = splitToken(seg.token);
      const heading = parts?.pre.split('\n').map(line => HEADER_TEST.exec(line)).find(Boolean);
      affixLevels.push(parts?.header?.trim() ? 2 : heading?.[1].length);
      return `${MASK}${tokens.push(restyleAffixes(seg.token, style)) - 1}${MASK}`;
    })
    .join('');
  const out = style === 'xml' ? wrapXml(masked, affixLevels) : toLabel(masked);
  return out.replace(MASKED, (_m, i: string) => tokens[Number(i)]);
}

/** Align body-capable and Header-only placements with a built-in's selected format. */
function setChipFormat(text: string, format: 'markdown' | 'xml' | null): string {
  return serializeSegments(
    parsePromptTemplate(text).map((seg) => {
      if (seg.type !== 'variable') return seg;
      const variable = variableForToken(seg.token);
      const parts = splitToken(seg.token);
      if (!variable || !parts) return seg;
      if (!variableAxes(variable).some((a) => a.id === 'format')) {
        return parts.header?.trim()
          ? { type: 'variable', token: joinToken({ ...parts, headerFormat: format ?? undefined }) }
          : seg;
      }
      const selection = { ...decodeVariant(variable, tokenVariant(seg.token)), format };
      return {
        type: 'variable',
        token: joinToken({
          ...parts,
          base: baseToken(seg.token),
          variantId: encodeVariant(variable, selection),
          pre: parts?.pre,
          post: parts?.post,
        }),
      };
    }),
  );
}

/** Style built-in prose sections and chip formats without changing raw Headers or affix content. */
export function buildStyledValues(canonical: PromptValues, style: SectionStyle): PromptValues {
  const out = {} as PromptValues;
  for (const key of PROMPT_TEXT_KEYS) {
    const headered = restyle(canonical[key], style);
    out[key] = setChipFormat(headered, style === 'labels' ? null : style);
  }
  return out;
}
