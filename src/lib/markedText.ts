/**
 * The control in Chip Options a run of rendered text comes from. A renderer tags each run it writes, so the
 * dialog lights what a control produces without reading the rendered string back.
 */
export type TextOrigin =
  /** An entity's description, summary or name, as its Content picks. */
  | 'content'
  /** An entity's owned traits lines. */
  | 'traits'
  /** An entity's owned stats lines. */
  | 'stats'
  /** One Stat Detail piece of a stat line. */
  | 'range' | 'descriptor' | 'meaning'
  /** An entity that owns stats or traits, so it passes that Only With pick. */
  | 'ownsStats' | 'ownsTraits'
  /** The placement text around a chip's value. */
  | 'header' | 'prepend' | 'append';

/** One stretch of rendered text and every origin it belongs to. */
export interface MarkedRun {
  readonly text: string;
  readonly origins: readonly TextOrigin[];
}

/** Rendered text as runs; its text is the runs' texts joined. */
export type MarkedText = readonly MarkedRun[];

/** A part of marked text: a string with no origin, or runs. */
export type MarkedPart = string | MarkedText;

/** The text `runs` spells. */
export const textOf = (runs: MarkedText): string => runs.map((run) => run.text).join('');

/** `parts` in order as runs, each run also under `origins`. Empty runs drop out. */
export function mark(origins: readonly TextOrigin[], ...parts: readonly MarkedPart[]): MarkedRun[] {
  const out: MarkedRun[] = [];
  for (const part of parts) {
    for (const run of typeof part === 'string' ? [{ text: part, origins: [] }] : part) {
      if (!run.text) continue;
      const added = origins.filter((origin) => !run.origins.includes(origin));
      out.push(added.length ? { text: run.text, origins: [...run.origins, ...added] } : run);
    }
  }
  return out;
}

/** `parts` in order as runs, with no origin added. */
export const runs = (...parts: readonly MarkedPart[]): MarkedRun[] => mark([], ...parts);

/** `list` joined by `separator`, as `Array.join` joins strings. */
export function joinRuns(list: readonly MarkedPart[], separator: string): MarkedRun[] {
  return runs(...list.flatMap((part, i) => (i ? [separator, part] : [part])));
}

/** Every line of `text` led by `pad`, as `text.split('\n').map((line) => pad + line).join('\n')` pads it. */
export function indentRuns(text: MarkedText, pad: string): MarkedRun[] {
  const out: MarkedPart[] = [pad];
  for (const run of text) {
    run.text.split('\n').forEach((piece, i) => {
      if (i) out.push(mark(run.origins, '\n'), pad);
      out.push(mark(run.origins, piece));
    });
  }
  return runs(...out);
}

/** Each run's text passed through `map`, its origins kept. */
export const mapRuns = (text: MarkedText, map: (text: string) => string): MarkedRun[] =>
  runs(...text.map((run) => mark(run.origins, map(run.text))));

/** The runs covering `text.slice(start, end)` of `textOf(text)`, cut at both ends. */
export function sliceRuns(text: MarkedText, start: number, end: number): MarkedRun[] {
  const out: MarkedRun[] = [];
  let at = 0;
  for (const run of text) {
    const from = Math.max(start, at);
    const to = Math.min(end, at + run.text.length);
    if (from < to) out.push({ text: run.text.slice(from - at, to - at), origins: run.origins });
    at += run.text.length;
  }
  return out;
}

/** `text` cut into lines at each newline, the newline kept at the end of its line. */
export function splitRunLines(text: MarkedText): MarkedRun[][] {
  const lines: MarkedRun[][] = [[]];
  for (const run of text) {
    run.text.split(/(?<=\n)/).forEach((piece) => {
      lines[lines.length - 1].push({ text: piece, origins: run.origins });
      if (piece.endsWith('\n')) lines.push([]);
    });
  }
  return lines.filter((line) => line.length);
}
