import { describe, expect, it } from 'vitest';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { SURFACE_EXCLUSIONS, SURFACE_IDS } from '@/lib/docs/surfaceMap';
import { surfaceHint } from '@/lib/formaquestion/surfaceHint';
import { BASELINE_KINDS, loadBaselineCases } from './help-baseline-cases';
import { CHECKED_LANGUAGES, hasName } from './help-baseline-score';

// The set against the real docs: a renamed control or a moved heading fails here, not as a silent score drop.
const index = bundledDocsIndex();
const cases = loadBaselineCases();
const covered = cases.filter((c) => c.section !== undefined);
const pages = index.contents().map((page) => page.page);
/** The changelog's text changes with each release, so its questions have no keyed fact. */
const CHANGELOG = 'Changelog';
const guidePages = pages.filter((page) => page !== CHANGELOG);
const anySection = (section: string) => section.endsWith('#*');
const keyed = covered.filter((c) => !anySection(c.section!));
const sectionText = (id: string) => index.get([id]).map((part) => part.markdown).join('\n');
const names = (fact: string | string[]) => [fact].flat();

describe('the help baseline question set', () => {
  it('has two keyed task questions or more for each guide page', () => {
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

  it('names docs sections that exist, with the first one on the page of the question', () => {
    const missing = keyed.flatMap((c) => [c.section!, ...(c.otherSections ?? [])].filter((id) => sectionText(id) === '').map((id) => `${c.id}: ${id}`));
    expect(missing).toEqual([]);
    expect(cases.filter((c) => c.page !== undefined && c.section?.split('#')[0] !== c.page).map((c) => c.id)).toEqual([]);
  });

  it('takes any section only of the changelog', () => {
    expect(covered.filter((c) => anySection(c.section!) && c.section !== `${CHANGELOG}#*`).map((c) => c.id)).toEqual([]);
    expect(pages).toContain(CHANGELOG);
  });

  it('keys one fact or more on each question with a section of its own', () => {
    expect(keyed.filter((c) => c.facts.length === 0).map((c) => c.id)).toEqual([]);
  });

  it('keys each fact to a name that every listed section holds', () => {
    const missing = keyed.flatMap((c) => [c.section!, ...(c.otherSections ?? [])].flatMap((id) => {
      const text = sectionText(id);
      return c.facts.filter((fact) => !names(fact).some((name) => hasName(text, name))).map((fact) => `${c.id} in ${id}: ${names(fact).join(' | ')}`);
    }));
    expect(missing).toEqual([]);
  });

  it('keys no name that sits inside the name of another fact, which would count for both', () => {
    const inside = keyed.flatMap((c) => c.facts.flatMap((fact, at) => {
      const others = c.facts.filter((_, other) => other !== at).flatMap(names);
      return names(fact).filter((name) => others.some((longer) => hasName(longer, name))).map((name) => `${c.id}: ${name}`);
    }));
    expect(inside).toEqual([]);
  });

  it('forbids no name the section holds', () => {
    const held = keyed.flatMap((c) => {
      const text = sectionText(c.section!);
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

  it('gives each task and here question an expected surface the app has: a surface id, or null for no single surface', () => {
    const asked = cases.filter((c) => c.kind === 'task' || c.kind === 'here');
    const known = new Set<string>(SURFACE_IDS);
    expect(asked.filter((c) => c.expectSurface === undefined).map((c) => c.id)).toEqual([]);
    expect(asked.filter((c) => c.expectSurface && (!known.has(c.expectSurface) || c.expectSurface in SURFACE_EXCLUSIONS)).map((c) => `${c.id}: ${c.expectSurface}`)).toEqual([]);
  });

  it('expects a here question to be about a surface the player has open', () => {
    const here = cases.filter((c) => c.kind === 'here');
    const outside = here.filter((c) => c.expectSurface && ![c.surface!.screen, c.surface!.dialog, ...c.surface!.tabs].includes(c.expectSurface));
    expect(outside.map((c) => c.id)).toEqual([]);
  });

  it('asks each follow-up after a task question', () => {
    const tasks = new Set(cases.filter((c) => c.kind === 'task').map((c) => c.id));
    expect(cases.filter((c) => c.kind === 'followUp' && !tasks.has(c.after ?? '')).map((c) => c.id)).toEqual([]);
  });

  it('sets only an AI Language the language check knows', () => {
    expect(cases.filter((c) => c.language !== undefined && !CHECKED_LANGUAGES.includes(c.language)).map((c) => c.id)).toEqual([]);
  });
});
