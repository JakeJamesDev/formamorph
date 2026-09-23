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

/** A headed placement's static frame: a blank line, the heading line, then the body ending its own line. */
export function promptHeader(header: string | undefined, format: string | null | undefined): { pre: string; post: string } | null {
  const text = header?.replace(/[\r\n\u2028\u2029]+/g, ' ').trim();
  if (!text) return null;
  if (format === 'xml') {
    let tag = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'section';
    if (!/^[a-z_]/.test(tag) || /^xml/i.test(tag)) tag = `section_${tag}`;
    return { pre: `\n<${tag}>\n`, post: `\n</${tag}>\n` };
  }
  if (format === 'markdown') {
    const title = titleCase(text).replace(/&/g, '&amp;').replace(/[\\`*_{}[\]<>#!|]/g, '\\$&');
    return { pre: `\n## ${title}\n`, post: '\n' };
  }
  return { pre: `\n${text.toLocaleUpperCase('en-US')}:\n`, post: '\n' };
}
