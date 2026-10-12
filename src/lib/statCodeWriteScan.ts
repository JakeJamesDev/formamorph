/**
 * Which stat fields a box of stat code writes, read from its text. Static: no sandbox, so the Test Bench's
 * live pass can use it. Only literal names count; a computed key (`stats[name].value = 1`) is out of reach.
 * Its own module because the executor behind the real list pulls the QuickJS engine in.
 */

/** The fields code may write on a stat. The executor's `SELF_WRITABLE_FIELDS` is the source; a test holds them equal. */
export const SCANNED_STAT_FIELDS: readonly string[] = ['value', 'min', 'max', 'regen'];

/** One write: the stat it lands on, by code name, and the field. A write through `self` has no `stat`. */
export interface ScannedWrite {
  stat: string | null;
  field: string;
}

// Comments and strings in one pass, so a quote inside a comment, or `//` inside a string, never hides code.
const COMMENT_OR_STRING = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|(["'`])(?:\\[\s\S]|(?!\1)[^\\])*\1/g;
/** `code` with comments blanked, and every string body blanked but a member access's bracket key and a
 *  template's `${}` code. */
const blankCommentsAndStrings = (code: string): string =>
  code.replace(COMMENT_OR_STRING, (text: string, quote: string | undefined, at: number) => {
    if (!quote) return ' ';
    if (/[\w$\]]\s*\[\s*$/.test(code.slice(0, at)) && /^\s*\]/.test(code.slice(at + text.length))) return text;
    const keep = quote === '`' ? /(\$\{[^}]*\})|[^\n]/g : /()[^\n]/g;
    return `${quote}${text.slice(1, -1).replace(keep, (_char, code?: string) => code || ' ')}${quote}`;
  });

const MEMBER = String.raw`(?:\s*\.\s*[A-Za-z_$][\w$]*|\s*\[\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`
  + String.raw`\x60(?:\\.|[^\x60\\])*\x60)\s*\])`;
const ASSIGN = String.raw`(?:\*\*|>>>|<<|>>|&&|\|\||\?\?|[-+*/%&|^])?=(?!=)`;
// A chain rooted at `self` or `stats` that is assigned to, or stepped before or after. A postfix step stays
// on the chain's line, as JS reads it.
const WRITE = new RegExp(
  String.raw`(^|[^\w$.])(?:(\+\+|--)\s*)?\b(self|stats)((?:${MEMBER})+)(?:\s*(${ASSIGN})|[^\S\r\n]*(\+\+|--))?`, 'g',
);
const SEGMENT = new RegExp(
  String.raw`\.\s*([A-Za-z_$][\w$]*)|\[\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|\x60((?:\\.|[^\x60\\])*)\x60)\s*\]`, 'g',
);

/** The literal keys of a member chain, unescaped; null when a template key holds `${}`. */
function segmentsOf(chain: string): string[] | null {
  const out: string[] = [];
  for (const m of chain.matchAll(SEGMENT)) {
    const key = m[1] ?? m[2] ?? m[3] ?? m[4] ?? '';
    if (m[4] !== undefined && key.includes('${')) return null;
    out.push(m[1] !== undefined ? key : key.replace(/\\(.)/g, '$1'));
  }
  return out;
}

/** Every literal write to a stat field in `code`, in text order, repeats included. */
export function scanStatWrites(code: string): ScannedWrite[] {
  const writes: ScannedWrite[] = [];
  for (const m of blankCommentsAndStrings(code).matchAll(WRITE)) {
    const [, , prefix, root, chain, operator, postfix] = m;
    // `+=` and friends write; so does a step either side. A bare read does not.
    if (!prefix && !operator && !postfix) continue;
    const segments = segmentsOf(chain);
    if (!segments) continue;
    const own = root === 'self';
    if (segments.length !== (own ? 1 : 2)) continue;
    const field = segments[segments.length - 1];
    if (!SCANNED_STAT_FIELDS.includes(field)) continue;
    writes.push({ stat: own ? null : segments[0], field });
  }
  return writes;
}
