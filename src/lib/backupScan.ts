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

export interface BackupSpans {
  /** Top-level values other than `data`, by key. */
  header: Record<string, Span>;
  /** Each element of a `data.<category>` array. */
  records: (Span & { category: string })[];
  /** Whether the top level has a `data` object. */
  hasData: boolean;
}

/** The file breaks JSON structure. */
export class BackupSyntaxError extends Error {}
/** The file is JSON but its top level is not an object. */
export class BackupShapeError extends Error {}

type Role = 'root' | 'data' | 'category' | 'record' | 'header' | 'other';

interface Frame {
  kind: 'obj' | 'arr';
  role: Role;
  start: number;
  /** The current member's key, in an object. */
  key: string | null;
  /** The span's label: a header key or a category. */
  label?: string;
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

const isSpace = (b: number) => b === 0x20 || b === 0x0a || b === 0x0d || b === 0x09;
/** A UTF-8 byte order mark, which `Blob.text()` also drops. */
const isBom = (b: number) => b === 0xef || b === 0xbb || b === 0xbf;

/**
 * Scan `blob` in chunks of `chunkSize` bytes. Throws `BackupSyntaxError` on broken structure and
 * `BackupShapeError` when the top level is not an object. Values are not checked here; parsing a span does that.
 */
export async function scanBackupSpans(
  blob: Blob,
  categories: readonly string[],
  chunkSize = 4 * 2 ** 20,
): Promise<BackupSpans> {
  const spans: BackupSpans = { header: {}, records: [], hasData: false };
  const stack: Frame[] = [];
  let started = false;
  let done = false;
  let inString = false;
  let escape = false;
  let expectKey = false;
  // The string being read is an object key; its bytes are kept while short.
  let keyBytes: number[] | null = null;
  // A string or scalar value in progress, and its span label.
  // Typed by assertion: closures assign it, which a plain `= null` would hide from narrowing.
  let pending = null as { role: Role; label?: string; start: number } | null;
  let scalarOpen = false;
  const decoder = new TextDecoder();

  const emit = (role: Role, label: string | undefined, start: number, end: number) => {
    if (role === 'header' && label !== undefined) spans.header[label] = { start, end };
    else if (role === 'record' && label !== undefined) spans.records.push({ category: label, start, end });
  };

  const endScalar = (pos: number) => {
    if (!scalarOpen || !pending) return;
    emit(pending.role, pending.label, pending.start, pos);
    pending = null;
    scalarOpen = false;
  };

  /** The role and label of a value that starts now, with `kind` its container type or null for a scalar. */
  const roleFor = (kind: 'obj' | 'arr' | null): { role: Role; label?: string } => {
    const top = stack[stack.length - 1];
    if (top.role === 'root') {
      if (top.key === 'data' && kind === 'obj') return { role: 'data' };
      return top.key === null || top.key === 'data' ? { role: 'other' } : { role: 'header', label: top.key };
    }
    if (top.role === 'data') {
      return kind === 'arr' && top.key !== null && categories.includes(top.key)
        ? { role: 'category', label: top.key }
        : { role: 'other' };
    }
    if (top.role === 'category') return { role: 'record', label: top.label };
    return { role: 'other' };
  };

  /** Called at the first byte of any value. */
  const startValue = (pos: number, kind: 'obj' | 'arr' | null) => {
    if (done) throw new BackupSyntaxError('Text after the end of the file.');
    if (!started) {
      if (kind !== 'obj') throw new BackupShapeError('The top level is not an object.');
      started = true;
      stack.push({ kind, role: 'root', start: pos, key: null });
      expectKey = true;
      return;
    }
    const top = stack[stack.length - 1];
    if (top.kind === 'obj' && expectKey) throw new BackupSyntaxError('Expected a key.');
    const { role, label } = roleFor(kind);
    if (kind) {
      if (role === 'data') spans.hasData = true;
      stack.push({ kind, role, start: pos, key: null, label });
      expectKey = kind === 'obj';
    } else {
      pending = { role, label, start: pos };
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
          expectKey = false;
        } else if (pending) {
          emit(pending.role, pending.label, pending.start, pos + 1);
          pending = null;
        }
        i = stop + 1;
        continue;
      }

      const b = chunk[i];
      const pos = offset + i;
      i++;
      if (isSpace(b) || (!started && isBom(b))) {
        endScalar(pos);
      } else if (b === Q) {
        endScalar(pos);
        const top = stack[stack.length - 1];
        if (top && top.kind === 'obj' && expectKey) {
          keyBytes = [];
        } else {
          startValue(pos, null);
        }
        inString = true;
        // The cached search positions were found before this string opened.
        nextQ = -1;
        nextBs = -1;
      } else if (b === LB || b === LS) {
        endScalar(pos);
        startValue(pos, b === LB ? 'obj' : 'arr');
      } else if (b === RB || b === RS) {
        endScalar(pos);
        const frame = stack.pop();
        if (!frame || frame.kind !== (b === RB ? 'obj' : 'arr')) throw new BackupSyntaxError('Unmatched bracket.');
        emit(frame.role, frame.label, frame.start, pos + 1);
        expectKey = false;
        if (stack.length === 0) done = true;
      } else if (b === COMMA) {
        endScalar(pos);
        const top = stack[stack.length - 1];
        if (!top) throw new BackupSyntaxError('Comma outside a value.');
        if (top.kind === 'obj') {
          top.key = null;
          expectKey = true;
        }
      } else if (b === COLON) {
        endScalar(pos);
      } else if (!scalarOpen) {
        startValue(pos, null);
        scalarOpen = true;
      }
    }
  }
  endScalar(blob.size);
  if (inString || !done) throw new BackupSyntaxError('The file ends early.');
  return spans;
}
