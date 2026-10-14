import { describe, expect, it } from 'vitest';
import { codeCompletions, codeDiagnostics } from './statCodeAnalysis';
import { codeCard } from './codeCards';
import { scriptSurface, STAT_CODE_SURFACE, SWITCHED_TRAIT_FIELDS, TRAIT_SCRIPT_SURFACE } from './statCodeSurface';
import type { SurfaceAnalysisOptions } from './statCodeAnalysis';
import type { ScriptTiming } from '@/types';

/** A stat's script box at `timing`, as the box builds its options. */
const statBox = (timing: ScriptTiming): SurfaceAnalysisOptions => ({
  surface: scriptSurface(STAT_CODE_SURFACE, timing), statNames: ['Health'], traits: ['Brave'],
});

const labelsAt = (doc: string, options: SurfaceAnalysisOptions) => {
  const pos = doc.indexOf('|');
  return (codeCompletions(doc.replace('|', ''), pos, options)?.options ?? []).map((option) => option.label);
};

const messages = (code: string, options: SurfaceAnalysisOptions) => codeDiagnostics(code, options).map((d) => d.message);

const cardAt = (doc: string, options: SurfaceAnalysisOptions) => codeCard(doc.replace('|', ''), doc.indexOf('|'), options);

describe('trait in a When a Trait Switches box', () => {
  it('completes as a global, and its fields after the dot', () => {
    expect(labelsAt('tra|', statBox('switch'))).toContain('trait');
    expect(labelsAt('trait.|', statBox('switch'))).toEqual(SWITCHED_TRAIT_FIELDS.map((field) => field.name));
  });

  it('is in a trait’s own switch box too', () => {
    expect(labelsAt('tra|', { surface: scriptSurface(TRAIT_SCRIPT_SURFACE, 'switch'), selfName: 'Brave' })).toContain('trait');
  });

  it('reads clean, and a write to it is an error', () => {
    expect(messages('stats.Health.value = trait.enabled ? 1 : 0;', statBox('switch'))).toEqual([]);
    expect(messages('trait.enabled = false;', statBox('switch')).join()).toMatch(/trait is read-only/);
  });

  it('flags a field the trait does not carry, with the nearest one', () => {
    expect(messages('const n = trait.nmae;', statBox('switch')).join()).toMatch(/no field “nmae”.*“name”/);
    expect(messages('stats.Health.value = trait.owner === "" ? 1 : 0;', statBox('switch'))).toEqual([]);
  });

  it('shows a hover card for trait and for its fields', () => {
    expect(cardAt('tr|ait.enabled', statBox('switch'))?.description).toMatch(/trait that switched/);
    expect(cardAt('trait.ena|bled', statBox('switch'))?.description).toMatch(/switch turned the trait on/);
  });
});

describe('trait in any other timing', () => {
  it.each(['before', 'after', 'output', 'start'] as const)('is unknown in %s', (timing) => {
    expect(labelsAt('tra|', statBox(timing))).not.toContain('trait');
    expect(messages('const x = trait.enabled;', statBox(timing)).join()).toMatch(/trait/);
    expect(cardAt('tr|ait', statBox(timing))).toBeNull();
  });
});
