import { describe, expect, it } from 'vitest';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { loadBaselineCases } from './help-baseline-cases';
import { loadBlindCases, loadKnownCases } from './help-recall-cases';

// The blind set against the real docs: a moved heading fails here, not as a silent recall drop.
const index = bundledDocsIndex();
const blind = loadBlindCases();
const known = loadKnownCases();
const guidePages = index.contents().map((page) => page.page).filter((page) => page !== 'Changelog');
const words = (question: string) => (question.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []).join(' ');

describe('the blind recall question set', () => {
  it('has 60 questions or more', () => {
    expect(blind.length).toBeGreaterThanOrEqual(60);
  });

  it('has two task questions or more for each guide page', () => {
    const short = guidePages.filter((page) => blind.filter((c) => c.kind === 'task' && c.page === page).length < 2);
    expect(short).toEqual([]);
  });

  it('gives each question an id that no question of either set has', () => {
    const ids = [...blind, ...known].map((c) => c.id);
    expect(ids.filter((id, at) => ids.indexOf(id) !== at)).toEqual([]);
  });

  it('keys each question to sections that exist, with the first one on the page of a task question', () => {
    const missing = blind.flatMap((c) => c.right.filter((id) => index.get([id]).length === 0).map((id) => `${c.id}: ${id}`));
    expect(missing).toEqual([]);
    expect(blind.filter((c) => c.kind === 'task' && c.right[0].split('#')[0] !== c.page).map((c) => c.id)).toEqual([]);
  });

  it('keys no section twice on one question', () => {
    expect(blind.filter((c) => new Set(c.right).size !== c.right.length).map((c) => c.id)).toEqual([]);
  });

  it('asks each follow-up after a task question of the blind set', () => {
    const tasks = new Set(blind.filter((c) => c.kind === 'task').map((c) => c.id));
    expect(blind.filter((c) => c.kind === 'followUp' && !tasks.has(c.after ?? '')).map((c) => c.id)).toEqual([]);
  });

  it('repeats no question of the known set', () => {
    const asked = new Set(known.map((c) => words(c.question)));
    expect(blind.filter((c) => asked.has(words(c.question))).map((c) => c.id)).toEqual([]);
  });
});

describe('the known recall question set', () => {
  it('holds every task, here and follow-up question of the help baseline, and no other kind', () => {
    const bar = loadBaselineCases().filter((c) => c.kind === 'task' || c.kind === 'here' || c.kind === 'followUp');
    expect(known.map((c) => c.id)).toEqual(bar.map((c) => c.id));
    expect(known.map((c) => c.right)).toEqual(bar.map((c) => [c.section, ...(c.otherSections ?? [])]));
  });

  it('keeps the open screen of a here question and the first question of a follow-up', () => {
    expect(known.filter((c) => c.kind === 'here' && !c.surface).map((c) => c.id)).toEqual([]);
    expect(known.filter((c) => c.kind === 'followUp' && !known.some((first) => first.id === c.after)).map((c) => c.id)).toEqual([]);
  });
});
