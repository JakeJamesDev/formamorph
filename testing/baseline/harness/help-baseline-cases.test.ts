import { describe, expect, it } from 'vitest';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { SURFACE_IDS } from '@/lib/docs/surfaceMap';
import { surfaceHint } from '@/lib/formaquestion/surfaceHint';
import { BASELINE_KINDS, loadBaselineCases } from './help-baseline-cases';
import { hasName } from './help-baseline-score';

// The set against the real docs: a renamed control or a moved heading fails here, not as a silent score drop.
const index = bundledDocsIndex();
const cases = loadBaselineCases();
const covered = cases.filter((c) => c.section !== undefined);
const sectionText = (id: string) => index.get([id]).map((part) => part.markdown).join('\n');
/** The released changelog is in the index, but its text changes with each release, so the set has no question on it. */
const guidePages = index.contents().map((page) => page.page).filter((page) => page !== 'Changelog');

describe('the help baseline question set', () => {
  it('has two keyed task questions or more for each docs page', () => {
    const short = guidePages.filter((page) => cases.filter((c) => c.kind === 'task' && c.page === page && c.facts.length > 0).length < 2);
    expect(short).toEqual([]);
  });

  it('has questions of every kind', () => {
    const empty = BASELINE_KINDS.filter((kind) => !cases.some((c) => c.kind === kind));
    expect(empty).toEqual([]);
  });

  it('gives each question its own id', () => {
    const ids = cases.map((c) => c.id);
    expect(ids.filter((id, at) => ids.indexOf(id) !== at)).toEqual([]);
  });

  it('names a docs section that exists, on the page of the question', () => {
    expect(covered.filter((c) => sectionText(c.section!) === '').map((c) => c.id)).toEqual([]);
    expect(cases.filter((c) => c.page !== undefined && c.section?.split('#')[0] !== c.page).map((c) => c.id)).toEqual([]);
  });

  it('keys each fact to a name the section holds', () => {
    const missing = covered.flatMap((c) => {
      const text = sectionText(c.section!).toLowerCase();
      return c.facts.filter((fact) => ![fact].flat().some((name) => hasName(text, name))).map((fact) => `${c.id}: ${[fact].flat().join(' | ')}`);
    });
    expect(missing).toEqual([]);
  });

  it('forbids no name the section holds', () => {
    const held = covered.flatMap((c) => {
      const text = sectionText(c.section!).toLowerCase();
      return c.forbidden.filter((name) => hasName(text, name)).map((name) => `${c.id}: ${name}`);
    });
    expect(held).toEqual([]);
  });

  it('keys no question the guide does not cover', () => {
    const uncovered = cases.filter((c) => c.kind === 'uncovered');
    expect(uncovered.filter((c) => c.section !== undefined || c.facts.length > 0).map((c) => c.id)).toEqual([]);
  });

  it('opens a Surface the app has, with a guide section for it', () => {
    const here = cases.filter((c) => c.kind === 'here');
    const known = new Set<string>(SURFACE_IDS);
    const unknown = here.flatMap((c) => [c.surface!.screen, c.surface!.dialog, ...c.surface!.tabs].filter((id) => id !== null && !known.has(id)).map((id) => `${c.id}: ${id}`));
    expect(unknown).toEqual([]);
    expect(here.filter((c) => surfaceHint(c.surface, index) === null).map((c) => c.id)).toEqual([]);
  });

  it('asks each follow-up after a task question', () => {
    const tasks = new Set(cases.filter((c) => c.kind === 'task').map((c) => c.id));
    expect(cases.filter((c) => c.kind === 'followUp' && !tasks.has(c.after ?? '')).map((c) => c.id)).toEqual([]);
  });
});
