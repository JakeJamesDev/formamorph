/**
 * Finds the byte spans of a backup file's header values and records by scanning its bytes, so restore
 * never holds the whole file as one string. Every JSON structural character is ASCII and every UTF-8
 * continuation byte is ≥ 0x80, so a byte scan is safe across chunk boundaries.
 */

/** A half-open byte range in the file. */
export interface Span {
  start: number;
  end: number;
}

export interface BackupSpans<C extends string> {
  /** Top-level values other than `data`, by key. */
  header: Record<string, Span>;
  /** Each element of a `data.<category>` array. */
  records: (Span & { category: C })[];
  /** Whether the top level has a `data` object. */
  hasData: boolean;
}

/** The file breaks JSON syntax. */
export class BackupSyntaxError extends Error {}
/** The file is JSON but its top level is not an object. */
export class BackupShapeError extends Error {}

type Role = 'root' | 'data' | 'category' | 'record' | 'header' | 'other';

/** What the next significant byte may be. */
type Expect = 'value' | 'key' | 'colon' | 'commaOrClose' | 'keyOrClose' | 'valueOrClose' | 'end';

interface Frame<C> {
  kind: 'obj' | 'arr';
  role: Role;
  start: number;
  /** The current member's key, in an object. */
  key: string | null;
  /** A header frame's key. */
  header?: string;
  /** A category or record frame's category. */
  category?: C;
}

const Q = 0x22;
const BS = 0x5c;
const LB = 0x7b;
const RB = 0x7d;
const LS = 0x5b;
const RS = 0x5d;
const COLON = 0x3a;
const COMMA = 0x2c;
/** Keys longer than this are never a header key or category, so they aren't kept. */
const MAX_KEY_BYTES = 64;
/** Longer than any valid `true`/`false`/`null` or any number a backup writes. */
const MAX_SCALAR_BYTES = 64;
const SCALAR = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)$/;

const isSpace = (b: number) => b === 0x20 || b === 0x0a || b === 0x0d || b === 0x09;
/** A UTF-8 byte order mark, which `Blob.text()` also drops. */
const isBom = (b: number) => b === 0xef || b === 0xbb || b === 0xbf;
/** A byte that can start a JSON value. */
const startsValue = (b: number) =>
  b === LB || b === LS || b === Q || b === 0x2d || (b >= 0x30 && b <= 0x39) || b === 0x74 || b === 0x66 || b === 0x6e;

/**
 * Scan `blob` in chunks of `chunkSize` bytes. Throws `BackupSyntaxError` on broken JSON and
 * `BackupShapeError` when the top level is JSON but not an object. A repeated key keeps its last value,
 * as `JSON.parse` does. Strings inside a value are not checked here; parsing its span does that.
 */
export async function scanBackupSpans<C extends string>(
  blob: Blob,
  categories: readonly C[],
  chunkSize = 4 * 2 ** 20,
): Promise<BackupSpans<C>> {
  const spans: BackupSpans<C> = { header: {}, records: [], hasData: false };
  const stack: Frame<C>[] = [];
  // Typed by assertion: closures assign `expect`, `pending` and `scalarBytes`, which plain initializers would
  // hide from narrowing.
  let expect = 'value' as Expect;
  let inString = false;
  let escape = false;
  // The string being read is an object key; its bytes are kept while short.
  let keyBytes: number[] | null = null;
  // A string or scalar value in progress, and where its span goes.
  let pending = null as { role: Role; header?: string; category?: C; start: number } | null;
  let scalarBytes = null as number[] | null;
  const decoder = new TextDecoder();
  const isCategory = (key: string | null): key is C => key !== null && (categories as readonly string[]).includes(key);

  const emit = (role: Role, header: string | undefined, category: C | undefined, start: number, end: number) => {
    if (role === 'header' && header !== undefined) spans.header[header] = { start, end };
    else if (role === 'record' && category !== undefined) spans.records.push({ category, start, end });
  };

  /** A value just ended: the next byte closes its container, adds a sibling, or ends the file. */
  const valueDone = () => {
    expect = stack.length ? 'commaOrClose' : 'end';
  };

  const endScalar = (pos: number) => {
    if (!scalarBytes || !pending) return;
    if (scalarBytes.length > MAX_SCALAR_BYTES || !SCALAR.test(String.fromCharCode(...scalarBytes))) {
      throw new BackupSyntaxError('Unknown word.');
    }
    emit(pending.role, pending.header, pending.category, pending.start, pos);
    pending = null;
    scalarBytes = null;
    valueDone();
  };

  /** The role of a value that starts now, with `kind` its container type or null for a scalar. */
  const roleFor = (kind: 'obj' | 'arr' | null): { role: Role; header?: string; category?: C } => {
    const top = stack[stack.length - 1];
    if (top.role === 'root') {
      if (top.key === 'data' && kind === 'obj') return { role: 'data' };
      return top.key === null || top.key === 'data' ? { role: 'other' } : { role: 'header', header: top.key };
    }
    if (top.role === 'data') {
      return kind === 'arr' && isCategory(top.key) ? { role: 'category', category: top.key } : { role: 'other' };
    }
    if (top.role === 'category') return { role: 'record', category: top.category };
    return { role: 'other' };
  };

  /** Called at the first byte of any value. */
  const startValue = (pos: number, kind: 'obj' | 'arr' | null) => {
    if (!stack.length) {
      if (kind !== 'obj') throw new BackupShapeError('The top level is not an object.');
      stack.push({ kind, role: 'root', start: pos, key: null });
      expect = 'keyOrClose';
      return;
    }
    const { role, header, category } = roleFor(kind);
    if (kind) {
      // A repeated key keeps its last value, so a later `data` or category replaces the records found so far.
      if (role === 'data') {
        spans.hasData = true;
        spans.records = [];
      } else if (role === 'category') {
        spans.records = spans.records.filter((r) => r.category !== category);
      }
      stack.push({ kind, role, start: pos, key: null, header, category });
      expect = kind === 'obj' ? 'keyOrClose' : 'valueOrClose';
    } else {
      pending = { role, header, category, start: pos };
    }
  };

  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    const chunk = new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer());
    // Cached next positions of a quote and a backslash, so long strings are skipped with native search.
    let nextQ = -1;
    let nextBs = -1;
    let i = 0;
    while (i < chunk.length) {
      if (inString) {
        if (escape) {
          escape = false;
          if (keyBytes && keyBytes.length < MAX_KEY_BYTES) keyBytes.push(chunk[i]);
          i++;
          continue;
        }
        if (nextQ < i) nextQ = chunk.indexOf(Q, i);
        if (nextBs < i && nextBs !== -2) nextBs = chunk.indexOf(BS, i);
        if (nextBs === -1) nextBs = -2; // none left in this chunk
        const q = nextQ === -1 ? chunk.length : nextQ;
        const bs = nextBs === -2 ? chunk.length : nextBs;
        const stop = Math.min(q, bs);
        if (keyBytes) for (let k = i; k < stop && keyBytes.length < MAX_KEY_BYTES; k++) keyBytes.push(chunk[k]);
        if (stop === chunk.length) break;
        if (stop === bs) {
          escape = true;
          if (keyBytes && keyBytes.length < MAX_KEY_BYTES) keyBytes.push(BS);
          i = stop + 1;
          continue;
        }
        inString = false;
        const pos = offset + stop;
        if (keyBytes) {
          stack[stack.length - 1].key = decoder.decode(new Uint8Array(keyBytes));
          keyBytes = null;
          expect = 'colon';
        } else if (pending) {
          emit(pending.role, pending.header, pending.category, pending.start, pos + 1);
          pending = null;
          valueDone();
        }
        i = stop + 1;
        continue;
      }

      const b = chunk[i];
      const pos = offset + i;
      i++;
      if (scalarBytes) {
        if (isSpace(b) || b === COMMA || b === RB || b === RS || b === COLON) endScalar(pos);
        else {
          scalarBytes.push(b);
          if (scalarBytes.length > MAX_SCALAR_BYTES) throw new BackupSyntaxError('Unknown word.');
          continue;
        }
      }
      if (isSpace(b) || (expect === 'value' && !stack.length && isBom(b))) continue;
      if (expect === 'end') throw new BackupSyntaxError('Text after the end of the file.');

      if (b === Q) {
        if (expect === 'key' || expect === 'keyOrClose') {
          keyBytes = [];
        } else if (expect === 'value' || expect === 'valueOrClose') {
          startValue(pos, null);
        } else {
          throw new BackupSyntaxError('Unexpected string.');
        }
        inString = true;
        // The cached search positions were found before this string opened.
        nextQ = -1;
        nextBs = -1;
      } else if (b === COLON) {
        if (expect !== 'colon') throw new BackupSyntaxError('Unexpected colon.');
        expect = 'value';
      } else if (b === COMMA) {
        if (expect !== 'commaOrClose') throw new BackupSyntaxError('Unexpected comma.');
        const top = stack[stack.length - 1];
        if (top.kind === 'obj') top.key = null;
        expect = top.kind === 'obj' ? 'key' : 'value';
      } else if (b === RB || b === RS) {
        const top = stack[stack.length - 1];
        const kind = b === RB ? 'obj' : 'arr';
        const canClose = expect === 'commaOrClose' || expect === (kind === 'obj' ? 'keyOrClose' : 'valueOrClose');
        if (!top || top.kind !== kind || !canClose) throw new BackupSyntaxError('Unexpected bracket.');
        stack.pop();
        emit(top.role, top.header, top.category, top.start, pos + 1);
        valueDone();
      } else if (expect === 'value' || expect === 'valueOrClose') {
        if (!startsValue(b)) throw new BackupSyntaxError('Unexpected character.');
        if (b === LB || b === LS) {
          startValue(pos, b === LB ? 'obj' : 'arr');
        } else {
          startValue(pos, null);
          scalarBytes = [b];
        }
      } else {
        throw new BackupSyntaxError('Unexpected character.');
      }
    }
  }
  endScalar(blob.size);
  if (inString || expect !== 'end') throw new BackupSyntaxError('The file ends early.');
  return spans;
}
