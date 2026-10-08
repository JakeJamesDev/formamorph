import type { SliceEdit } from '@/lib/editorHistory';

/**
 * Measures a committed world change for auto save: one unit per character of text changed, and a fixed weight
 * per discrete action (a toggle, a pick, an image, an add, a remove, a reorder).
 */

export const DISCRETE_UNITS = 10;

/** A change split by kind, so a write that joins the Step before it can skip the discrete part. */
export interface ChangeSize {
  text: number;
  discrete: number;
}

/** One committed change as the History recorder saw it. `merged` is true when it joined the Step before it. */
export interface CommittedChange {
  edits: SliceEdit[];
  merged: boolean;
}

const NONE: ChangeSize = { text: 0, discrete: 0 };
const DISCRETE: ChangeSize = { text: 0, discrete: DISCRETE_UNITS };
const add = (a: ChangeSize, b: ChangeSize): ChangeSize => ({ text: a.text + b.text, discrete: a.discrete + b.discrete });

/** Characters changed between two strings: the longer side of the span between their shared ends. */
export function textChange(was: string, now: string): number {
  const shorter = Math.min(was.length, now.length);
  let start = 0;
  while (start < shorter && was[start] === now[start]) start += 1;
  let end = 0;
  while (end < shorter - start && was[was.length - 1 - end] === now[now.length - 1 - end]) end += 1;
  return Math.max(was.length - start - end, now.length - start - end);
}

const isImage = (text: string) => text.startsWith('data:');
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const idOf = (value: unknown) => (isRecord(value) && typeof value.id === 'string' ? value.id : undefined);

function measureValue(was: unknown, now: unknown): ChangeSize {
  if (was === now) return NONE;
  const [a, b] = [was ?? (typeof now === 'string' ? '' : was), now ?? (typeof was === 'string' ? '' : now)];
  if (typeof a === 'string' && typeof b === 'string') {
    return isImage(a) || isImage(b) ? DISCRETE : { text: textChange(a, b), discrete: 0 };
  }
  if (Array.isArray(a) && Array.isArray(b)) return measureList(a, b);
  if (isRecord(a) && isRecord(b)) {
    let size = NONE;
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) size = add(size, measureValue(a[key], b[key]));
    return size;
  }
  return DISCRETE;
}

/** Records with ids match by id; other lists match by position, and each item added or removed is one action. */
function measureList(was: unknown[], now: unknown[]): ChangeSize {
  const keyed = [...was, ...now].length > 0 && [...was, ...now].every((item) => idOf(item) !== undefined);
  if (!keyed) {
    if (was.length !== now.length) return { text: 0, discrete: DISCRETE_UNITS * Math.abs(was.length - now.length) };
    return was.reduce<ChangeSize>((size, item, i) => add(size, measureValue(item, now[i])), NONE);
  }
  const byId = (items: unknown[]) => new Map(items.map((item) => [idOf(item) ?? '', item]));
  return measureKeyed(byId(was), byId(now), was.map((item) => idOf(item) ?? ''), now.map((item) => idOf(item) ?? ''));
}

/** Records matched by id: a changed one by its fields, an added or removed one as one action, a reorder as one. */
function measureKeyed(
  before: Map<string, unknown>, after: Map<string, unknown>, beforeOrder: string[], afterOrder: string[],
): ChangeSize {
  let size = NONE;
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    size = add(size, before.has(id) && after.has(id) ? measureValue(before.get(id), after.get(id)) : DISCRETE);
  }
  return reordered(beforeOrder, afterOrder) ? add(size, DISCRETE) : size;
}

/** Whether the ids both orders share sit in a different sequence. */
function reordered(before: string[], after: string[]): boolean {
  const [inBefore, inAfter] = [new Set(before), new Set(after)];
  const kept = before.filter((id) => inAfter.has(id));
  return after.filter((id) => inBefore.has(id)).some((id, i) => id !== kept[i]);
}

/** The size of the slices' edits: each touched record against its earlier self, and a reorder as one action. */
export function measureEdits(edits: SliceEdit[]): ChangeSize {
  let size = NONE;
  for (const edit of edits) {
    if (edit.slice === 'worldOverview') { size = add(size, measureValue(edit.before, edit.after)); continue; }
    const byId = (records: { id: string }[]) => new Map<string, unknown>(records.map((record) => [record.id, record]));
    size = add(size, measureKeyed(byId(edit.before), byId(edit.after), edit.beforeOrder, edit.afterOrder));
  }
  return size;
}

/** Units a change adds to the count. A write that joins its Step adds its text only: one action counts once. */
export function measureChange(change: CommittedChange): number {
  const { text, discrete } = measureEdits(change.edits);
  return text + (change.merged ? 0 : discrete);
}
