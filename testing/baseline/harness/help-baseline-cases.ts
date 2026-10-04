// Reads the fixed Formaquestion question set, `testing/baseline/help-baseline-cases.json`.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { SurfaceId } from '@/lib/docs/surfaceMap';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import type { Keys } from './help-baseline-score';

export const BASELINE_KINDS = ['task', 'here', 'followUp', 'language', 'changelog', 'uncovered'] as const;
export type BaselineKind = (typeof BASELINE_KINDS)[number];

/** One question of the set, with the keys its answers are scored on. */
export interface BaselineCase extends Keys {
  id: string;
  kind: BaselineKind;
  question: string;
  /** Task: the docs page the question is for. */
  page?: string;
  /** Here: what the player has open. */
  surface?: Surface;
  /** Task and here: the surface the question is about; `null` when the steps have no single surface. */
  expectSurface?: SurfaceId | null;
  /** Follow-up: the id of the task case asked first. */
  after?: string;
  /** Language: the AI Language setting. */
  language?: string;
  /** Language: the question is written in that language too, not in English. */
  asked?: boolean;
}

interface KeyedEntry extends Keys { id: string; question: string; section: string }
interface CaseFile {
  cases: (KeyedEntry & { page: string; expectSurface: SurfaceId | null })[];
  here: (KeyedEntry & { surface: Surface; expectSurface: SurfaceId | null })[];
  followUps: (KeyedEntry & { after: string })[];
  changelog: { id: string; question: string; section: string }[];
  uncovered: { id: string; question: string }[];
  language: { id: string; of: string; language: string; question?: string }[];
}

export const BASELINE_CASES_FILE = path.resolve('testing/baseline/help-baseline-cases.json');

/** Every question of the set. A language case takes the sections and the keys of its task. */
export function loadBaselineCases(file = BASELINE_CASES_FILE): BaselineCase[] {
  const set = JSON.parse(readFileSync(file, 'utf8')) as CaseFile;
  const tasks = new Map(set.cases.map((c) => [c.id, c]));
  return [
    ...set.cases.map((c): BaselineCase => ({ ...c, kind: 'task' })),
    ...set.here.map((c): BaselineCase => ({ ...c, kind: 'here' })),
    ...set.followUps.map((c): BaselineCase => ({ ...c, kind: 'followUp' })),
    ...set.language.map(({ id, of, language, question }): BaselineCase => {
      const task = tasks.get(of);
      if (!task) throw new Error(`language case ${id} names no task: ${of}`);
      const { section, otherSections, facts, forbidden } = task;
      return { id, kind: 'language', question: question ?? task.question, language, asked: question !== undefined, section, otherSections, facts, forbidden };
    }),
    ...set.changelog.map((c): BaselineCase => ({ ...c, kind: 'changelog', facts: [], forbidden: [] })),
    ...set.uncovered.map((c): BaselineCase => ({ ...c, kind: 'uncovered', facts: [], forbidden: [] })),
  ];
}
