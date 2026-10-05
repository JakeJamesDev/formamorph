/** Scores one help answer's stat code: its fences, their slot tags, whether each runs in the sandbox, and the names it uses. */
import { CLOCK_MEMBERS, CLOCK_PREVIOUS_FIELDS } from '@/lib/statCodeSurface';
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

// A string literal first, so a `//` inside one stays text.
const STRING_OR_COMMENT = /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
const withoutComments = (code: string) => code.replace(STRING_OR_COMMENT, (_comment, text?: string) => text ?? ' ');

/** True when the code is only comments and blank lines: the sandbox runs it, but it does nothing. */
const holdsNoStatement = (code: string) => !withoutComments(code).trim();
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

/** One name a case's code must hold, or must not. */
export interface NameCheck {
  label: string;
  pattern: RegExp;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const segment = (name: string) =>
  String.raw`\s*(?:\??\.\s*${escapeRegExp(name)}(?![\w$])|(?:\?\.)?\[\s*["'\x60]${escapeRegExp(name)}["'\x60]\s*\])`;
const pathPattern = (path: string) => {
  const [head, ...rest] = path.split('.');
  return String.raw`(?<![\w$.])${escapeRegExp(head)}(?![\w$])` + rest.map(segment).join('');
};

/** A check that matches any of the dotted `paths`, each segment in dot or bracket form, never under another owner. */
export const ref = (...paths: string[]): NameCheck =>
  ({ label: paths.join(' | '), pattern: new RegExp(paths.map(pathPattern).join('|')) });

const CLOCK_NAMES = new Set(CLOCK_MEMBERS.map((member) => member.name));
const PREVIOUS_NAMES = new Set(CLOCK_PREVIOUS_FIELDS.map((field) => field.name));
/** One member read, in dot, optional-chain or bracket form: the name is group 1 or group 2. */
const MEMBER = String.raw`\s*(?:\??\.\s*([A-Za-z_$][\w$]*)|(?:\?\.)?\[\s*["'\x60]([^"'\x60]*)["'\x60]\s*\])`;
const CLOCK_READ = new RegExp(String.raw`(?<![\w$.])clock${MEMBER}(?:${MEMBER})?`, 'g');
const WHOLE_STAT = String.raw`(?<![\w$.])(?:stats\s*\.\s*[A-Za-z_$][\w$]*|stats\s*\[\s*["'\x60][^"'\x60]*["'\x60]\s*\]|self)(?![\w$.[(?])`;
// The `>` of an arrow is no comparison.
const COMPARE = String.raw`(?:(?<!=)[<>]=?|[!=]==?)`;
const WHOLE_STAT_COMPARED = new RegExp(String.raw`${WHOLE_STAT}\s*${COMPARE}|${COMPARE}\s*${WHOLE_STAT}`, 'g');

/** The invented forms in `code`, in order: an unknown `clock` or `clock.previous` field, and a whole stat compared. */
export function inventedNames(code: string): string[] {
  const bare = withoutComments(code);
  const found: { at: number; name: string }[] = [];
  for (const read of bare.matchAll(CLOCK_READ)) {
    const field = read[1] ?? read[2];
    const inner = read[3] ?? read[4];
    if (!CLOCK_NAMES.has(field)) found.push({ at: read.index, name: `clock.${field}` });
    else if (field === 'previous' && inner && !PREVIOUS_NAMES.has(inner)) found.push({ at: read.index, name: `clock.previous.${inner}` });
  }
  for (const compared of bare.matchAll(WHOLE_STAT_COMPARED)) found.push({ at: compared.index, name: compared[0].replace(/\s+/g, ' ') });
  return found.sort((a, b) => a.at - b.at).map((hit) => hit.name);
}

/** The names a known case's answer must hold, and those it must not on top of the invented forms. */
export interface CaseNames {
  present: readonly NameCheck[];
  absent?: readonly NameCheck[];
}

export interface NameScore {
  /** Each present check the fences miss. */
  missing: string[];
  /** Each invented form in the fences, then each absent check they match. */
  invented: string[];
}

/** The names of an answer's fenced code against `names`. Prose and comments do not count. */
export function scoreNames(answer: string, names: CaseNames): NameScore {
  const code = readFences(answer).map((fence) => withoutComments(fence.code)).join('\n');
  return {
    missing: names.present.filter((check) => !check.pattern.test(code)).map((check) => check.label),
    invented: [...inventedNames(code), ...(names.absent ?? []).filter((check) => check.pattern.test(code)).map((check) => check.label)],
  };
}

/** True when a known case's answer runs, holds every real name, and holds no invented one. */
export const passesCase = (score: CodeScore, names: NameScore): boolean =>
  score.runs && names.missing.length === 0 && names.invented.length === 0;
