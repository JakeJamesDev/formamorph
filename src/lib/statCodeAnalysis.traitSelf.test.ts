import { describe, expect, it } from 'vitest';
import { codeCompletions, codeDiagnostics } from './statCodeAnalysis';
import { STAT_CODE_SURFACE, TRAIT_ENTRY_FIELDS, TRAIT_SCRIPT_SURFACE } from './statCodeSurface';
import { buildVariableTree } from './statCodeVariableTree';

/** A trait's script box, as the trait editor builds its options. */
const traitBox = { surface: TRAIT_SCRIPT_SURFACE, selfName: 'Brave', traits: ['Brave'], statNames: ['Health'] };

const messages = (code: string) => codeDiagnostics(code, traitBox).map((d) => d.message);

const labelsAt = (doc: string) => {
  const pos = doc.indexOf('|');
  return (codeCompletions(doc.replace('|', ''), pos, traitBox)?.options ?? []).map((option) => option.label);
};

describe('a trait script’s self', () => {
  it('completes as the trait’s entry', () => {
    expect(labelsAt('self.|')).toEqual(TRAIT_ENTRY_FIELDS.map((field) => field.name));
  });

  it('is read-only: a write to it is an error that names where a switch goes', () => {
    const [problem, ...rest] = messages('self.enabled = false;');
    expect(rest).toEqual([]);
    expect(problem).toMatch(/self is read-only/);
  });

  it('carries no stat fields', () => {
    expect(messages('stats.Health.value = self.value;').some((m) => /value/.test(m))).toBe(true);
  });

  it('warns of no missing return, since a trait script returns nothing', () => {
    expect(messages('stats.Health.value = self.enabled ? 1 : 0;')).toEqual([]);
    expect(messages('const x = 1;')).toEqual([]);
  });

  it('leaves a stat box’s self a stat', () => {
    const stat = codeDiagnostics('self.enabled = false;', { surface: STAT_CODE_SURFACE });
    expect(stat.map((d) => d.message).join()).not.toMatch(/read-only/);
  });

  it('heads the Variable menu as This Trait with the trait’s fields', () => {
    const [first] = buildVariableTree(undefined, null, 'trait');
    expect(first.kind === 'group' && first.label).toBe('This Trait');
    expect(first.kind === 'group' && first.children.map((node) => node.kind === 'field' && node.label))
      .toEqual(TRAIT_ENTRY_FIELDS.map((field) => field.name));
  });
});
