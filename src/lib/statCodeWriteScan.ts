/**
 * Which stats a box of stat code looks up, and which fields it writes, read from its text. Static: no sandbox, so the Test Bench's
 * live pass can use it. Only literal names count; a computed key (`stats[name].value = 1`) is out of reach.
 * Its own module because the executor behind the real list pulls the QuickJS engine in.
 */

/** The fields code may write on a stat. The executor's `SELF_WRITABLE_FIELDS` is the source; a test holds them equal. */
export const SCANNED_STAT_FIELDS: readonly string[] = ['value', 'min', 'max', 'regen', 'hidden'];

/** The sandbox global a write or lookup starts at. Every root but `self` and `stats` reaches its stats through `.stats`. */
export type ScannedRoot = 'self' | 'stats' | 'owner' | 'persona' | 'entities';

/** One write: its route, the stat it lands on by code name, and the field. A write through `self` has no
 *  `stat`; one through `entities` names the entity. */
export interface ScannedWrite {
  root: ScannedRoot;
  entity?: string;
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
    if (/[\w$\]]\s*(?:\?\.\s*)?\[\s*$/.test(code.slice(0, at)) && /^\s*\]/.test(code.slice(at + text.length))) return text;
    const keep = quote === '`' ? /(\$\{[^}]*\})|[^\n]/g : /()[^\n]/g;
    return `${quote}${text.slice(1, -1).replace(keep, (_char, code?: string) => code || ' ')}${quote}`;
  });

const MEMBER = String.raw`(?:\s*\.\s*[A-Za-z_$][\w$]*|\s*\[\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`
  + String.raw`\x60(?:\\.|[^\x60\\])*\x60)\s*\])`;
const ASSIGN = String.raw`(?:\*\*|>>>|<<|>>|&&|\|\||\?\?|[-+*/%&|^])?=(?!=)`;
// A chain rooted at a sandbox global that is assigned to, or stepped before or after. A postfix step stays
// on the chain's line, as JS reads it.
const WRITE = new RegExp(
  String.raw`(^|[^\w$.])(?:(\+\+|--)\s*)?\b(self|stats|owner|persona|entities)((?:${MEMBER})+)(?:\s*(${ASSIGN})|[^\S\r\n]*(\+\+|--))?`, 'g',
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

/** The write a chain's keys spell from `root`, or null when they reach no stat field. */
function writeOf(root: ScannedRoot, segments: readonly string[]): ScannedWrite | null {
  const field = segments[segments.length - 1];
  if (!SCANNED_STAT_FIELDS.includes(field)) return null;
  switch (root) {
    case 'self': return segments.length === 1 ? { root, stat: null, field } : null;
    case 'stats': return segments.length === 2 ? { root, stat: segments[0], field } : null;
    case 'entities':
      return segments.length === 4 && segments[1] === 'stats' ? { root, entity: segments[0], stat: segments[2], field } : null;
    default: return segments.length === 3 && segments[0] === 'stats' ? { root, stat: segments[1], field } : null;
  }
}

/** Every literal write to a stat field in `code`, in text order, repeats included. */
export function scanStatWrites(code: string): ScannedWrite[] {
  const writes: ScannedWrite[] = [];
  for (const m of blankCommentsAndStrings(code).matchAll(WRITE)) {
    const [, , prefix, root, chain, operator, postfix] = m;
    // `+=` and friends write; so does a step either side. A bare read does not.
    if (!prefix && !operator && !postfix) continue;
    const segments = segmentsOf(chain);
    const write = segments && writeOf(root as ScannedRoot, segments);
    if (write) writes.push(write);
  }
  return writes;
}

// `turn` as a name of its own: no member access, no bracket key, no longer identifier.
const NAMES_TURN = /(?<![\w$.'"\x60])turn(?![\w$'"\x60])/;

/** Whether `code` names `turn` outside comments and strings, by any path: a read, an alias or a destructure (Q12). */
export const namesTurn = (code: string): boolean => NAMES_TURN.test(blankCommentsAndStrings(code));

/** One literal stat lookup: its route and the stat's code name. One through `entities` names the entity. */
export interface ScannedLookup {
  root: Exclude<ScannedRoot, 'self'>;
  entity?: string;
  stat: string;
}

const LOOKUP_MEMBER = String.raw`(?:\s*\??\.\s*[A-Za-z_$][\w$]*|\s*(?:\?\.\s*)?\[\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`
  + String.raw`\x60(?:\\.|[^\x60\\])*\x60)\s*\])`;
// A chain rooted at a global that holds stats, read or written, optional steps included. A trailing `(` marks a call.
const LOOKUP = new RegExp(String.raw`(?<![\w$.])(stats|owner|persona|entities)((?:${LOOKUP_MEMBER})+)(\s*\()?`, 'g');

/** The stat a chain's keys name from `root`, or null when they name none. A call on the map itself, such as
 *  `stats.find(`, names no stat. */
function lookupOf(root: ScannedLookup['root'], segments: readonly string[], call: boolean): ScannedLookup | null {
  const at = root === 'stats' ? 0 : root === 'entities' ? 2 : 1;
  if (segments.length <= at || (call && segments.length === at + 1)) return null;
  if (root === 'stats') return { root, stat: segments[0] };
  if (segments[at - 1] !== 'stats') return null;
  return root === 'entities' ? { root, entity: segments[0], stat: segments[2] } : { root, stat: segments[1] };
}

/** Every literal stat lookup in `code`, in text order, repeats included. */
export function scanStatLookups(code: string): ScannedLookup[] {
  const lookups: ScannedLookup[] = [];
  for (const [, root, chain, call] of blankCommentsAndStrings(code).matchAll(LOOKUP)) {
    const segments = segmentsOf(chain);
    const lookup = segments && lookupOf(root as ScannedLookup['root'], segments, call !== undefined);
    if (lookup) lookups.push(lookup);
  }
  return lookups;
}
