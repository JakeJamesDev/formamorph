// Reads the two question sets the recall probe scores: the known set of `help-baseline-cases.json`, and the
// blind set of `help-recall-blind-cases.json`.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import { loadBaselineCases } from './help-baseline-cases';

export const RECALL_SETS = ['known', 'blind'] as const;
export type RecallSet = (typeof RECALL_SETS)[number];
export const RECALL_KINDS = ['task', 'here', 'followUp'] as const;
export type RecallKind = (typeof RECALL_KINDS)[number];

/** One question with the sections that answer it. */
export interface RecallCase {
  set: RecallSet;
  id: string;
  kind: RecallKind;
  question: string;
  /** The ids of the sections that answer the question; the search finds it with any one of them. */
  right: string[];
  /** Task: the docs page the question is for. */
  page?: string;
  /** Here: what the player has open. */
  surface?: Surface;
  /** Follow-up: the id of the task question asked first. */
  after?: string;
}

interface BlindEntry { id: string; question: string; section: string; otherSections?: string[] }
interface BlindFile {
  cases: (BlindEntry & { page: string })[];
  followUps: (BlindEntry & { after: string })[];
}

export const BLIND_CASES_FILE = path.resolve('testing/baseline/help-recall-blind-cases.json');

/** The blind set: task questions and follow-ups. */
export function loadBlindCases(file = BLIND_CASES_FILE): RecallCase[] {
  const set = JSON.parse(readFileSync(file, 'utf8')) as BlindFile;
  const right = (c: BlindEntry) => [c.section, ...(c.otherSections ?? [])];
  return [
    ...set.cases.map((c): RecallCase => ({ set: 'blind', id: c.id, kind: 'task', question: c.question, right: right(c), page: c.page })),
    ...set.followUps.map((c): RecallCase => ({ set: 'blind', id: c.id, kind: 'followUp', question: c.question, right: right(c), after: c.after })),
  ];
}

/** The known set: the English task, "here" and follow-up questions of the help baseline, the kinds the pass bar counts. */
export function loadKnownCases(): RecallCase[] {
  return loadBaselineCases().flatMap((c): RecallCase[] => {
    const kind = RECALL_KINDS.find((k) => k === c.kind);
    if (!kind || !c.section) return [];
    return [{ set: 'known', id: c.id, kind, question: c.question, right: [c.section, ...(c.otherSections ?? [])], page: c.page, surface: c.surface, after: c.after }];
  });
}
