/** Scores one help answer's stat code: its fences, their slot tags, and whether each runs in the sandbox. */
import { STAT_CODE_TIMINGS, type StatCodeTiming } from '@/lib/statCodeTiming';

/** One fenced block of an answer. `closed` is false on a block the answer never closes. */
export interface Fence {
  language: string;
  /** The word after the language, when it names a stat-code box. */
  slot: StatCodeTiming | null;
  code: string;
  closed: boolean;
}

// Model answers indent fences under list items past the three spaces CommonMark allows a top-level fence.
const OPENER = /^(\s*)(`{3,}|~{3,})\s*(.*)$/;
const CLOSER = /^\s*(`{3,}|~{3,})\s*$/;

/** Every fenced block of an answer, in order. */
export function readFences(answer: string): Fence[] {
  const fences: Fence[] = [];
  let open: { marker: string; indent: number; info: string; lines: string[] } | null = null;
  const finish = (closed: boolean) => {
    if (!open) return;
    const [language = '', tag = ''] = open.info.trim().split(/\s+/);
    const slot = STAT_CODE_TIMINGS.find((timing) => timing === tag) ?? null;
    fences.push({ language, slot, code: open.lines.join('\n'), closed });
    open = null;
  };
  for (const line of answer.split(/\r?\n/)) {
    if (open) {
      const closer = CLOSER.exec(line)?.[1];
      if (closer && closer[0] === open.marker[0] && closer.length >= open.marker.length) finish(true);
      else open.lines.push(line.slice(Math.min(open.indent, line.length - line.trimStart().length)));
      continue;
    }
    const opener = OPENER.exec(line);
    if (opener) open = { indent: opener[1].length, marker: opener[2], info: opener[3], lines: [] };
  }
  finish(false);
  return fences;
}

/** One snippet through the stat-code sandbox: `runs` when it ends without an error. */
export interface SnippetRun {
  runs: boolean;
  error: string | null;
}
export type SnippetRunner = (code: string) => Promise<SnippetRun>;

export interface CodeScore {
  fences: number;
  fence: boolean;
  /** The answer has a fence and closes every one. */
  closed: boolean;
  /** The share of the answer's fences that carry a slot tag. */
  tagged: number;
  /** The answer has a fence and every fence runs. */
  runs: boolean;
  fencesRun: number;
  /** The sandbox error of each fence that did not run. */
  errors: string[];
}

/** True when the code is only comments and blank lines: the sandbox runs it, but it does nothing. */
const holdsNoStatement = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').every((line) => !line.trim() || line.trim().startsWith('//'));
const INERT: SnippetRun = { runs: false, error: 'holds no statement' };

/** Scores an answer, running each fence's code through `run`. A fence that holds no statement does not run. */
export async function scoreCodeAnswer(answer: string, run: SnippetRunner): Promise<CodeScore> {
  const fences = readFences(answer);
  const results = await Promise.all(fences.map((fence) => (holdsNoStatement(fence.code) ? INERT : run(fence.code))));
  const fencesRun = results.filter((result) => result.runs).length;
  const fence = fences.length > 0;
  return {
    fences: fences.length,
    fence,
    closed: fence && fences.every((f) => f.closed),
    tagged: fence ? fences.filter((f) => f.slot !== null).length / fences.length : 0,
    runs: fence && fencesRun === fences.length,
    fencesRun,
    errors: results.flatMap((result) => (result.runs ? [] : [result.error ?? 'did not run'])),
  };
}

/** The shares of a set of answers. */
export interface CodeSummary {
  /** Answers, failed requests included. */
  n: number;
  /** Fences over every answer, the denominator of the per-fence shares. */
  fences: number;
  /** Answers with a fence, the denominator of `truncated`. */
  fenced: number;
  fence: number;
  closed: number;
  /** Tagged fences over every fence. */
  tagged: number;
  runs: number;
  /** Fences that run over every fence. */
  fenceRuns: number;
  /** Answers with an open fence over answers with a fence. */
  truncated: number;
}

const share = (part: number, whole: number) => (whole === 0 ? 0 : part / whole);

/** The shares over `scores`. Each of the `failed` requests counts as an answer with no fence. */
export function summarizeCodeScores(scores: readonly CodeScore[], failed: number): CodeSummary {
  const n = scores.length + failed;
  const fences = scores.reduce((sum, s) => sum + s.fences, 0);
  const fenced = scores.filter((s) => s.fence);
  const count = (pick: (s: CodeScore) => boolean) => scores.filter(pick).length;
  return {
    n,
    fences,
    fenced: fenced.length,
    fence: share(fenced.length, n),
    closed: share(count((s) => s.closed), n),
    tagged: share(scores.reduce((sum, s) => sum + s.tagged * s.fences, 0), fences),
    runs: share(count((s) => s.runs), n),
    fenceRuns: share(scores.reduce((sum, s) => sum + s.fencesRun, 0), fences),
    truncated: share(fenced.filter((s) => !s.closed).length, fenced.length),
  };
}
