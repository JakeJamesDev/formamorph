const CONNECTING_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'up', 'via', 'with']);

function titleCase(text: string): string {
  const words = text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) ?? [];
  const normalize = words.length > 1 && text === text.toLocaleUpperCase('en-US');
  let index = 0;
  return text.replace(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu, raw => {
    const word = normalize ? raw.toLocaleLowerCase('en-US') : raw;
    const first = index++ === 0;
    if (word !== word.toLocaleLowerCase('en-US')) return word;
    if (!first && index < words.length && CONNECTING_WORDS.has(word)) return word;
    return word[0].toLocaleUpperCase('en-US') + word.slice(1);
  });
}

/** Generated boundaries for plain heading text in a placement's selected format. */
export function promptHeader(header: string | undefined, format: string | null | undefined): { pre: string; post: string } | null {
  const text = header?.replace(/[\r\n\u2028\u2029]+/g, ' ').trim();
  if (!text) return null;
  if (format === 'xml') {
    let tag = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'section';
    if (!/^[a-z_]/.test(tag) || /^xml/i.test(tag)) tag = `section_${tag}`;
    return { pre: `<${tag}>\n`, post: `\n</${tag}>` };
  }
  if (format === 'markdown') {
    const title = titleCase(text).replace(/&/g, '&amp;').replace(/[\\`*_{}[\]<>#!|]/g, '\\$&');
    return { pre: `## ${title}\n`, post: '' };
  }
  return { pre: `${text.toLocaleUpperCase('en-US')}:\n`, post: '' };
}

/** Supply only missing boundary newlines; authored whitespace belongs to its original piece. */
export function sectionSpacing(parts: { text: string; section: boolean }[]): { before: string; after: string }[] {
  const text = parts.map(part => part.text);
  return parts.map((part, i) => {
    if (!part.section || !part.text) return { before: '', after: '' };
    const left = text.slice(0, i).join('');
    const right = text.slice(i + 1).join('');
    const leading = left.match(/[ \t\r\n]*$/)?.[0] ?? '';
    const trailing = (part.text.match(/[ \t\r\n]*$/)?.[0] ?? '') + (right.match(/^[ \t\r\n]*/)?.[0] ?? '');
    const before = left.trim() ? '\n'.repeat(Math.max(0, 2 - (leading.match(/\n/g)?.length ?? 0))) : '';
    const after = right.trim() ? '\n'.repeat(Math.max(0, 2 - (trailing.match(/\n/g)?.length ?? 0))) : '';
    text[i] = before + part.text + after;
    return { before, after };
  });
}
