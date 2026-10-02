import { describe, it, expect } from 'vitest';
import { statCodeCompletions, statCodeDiagnostics, type CodeEntityNames } from './statCodeAnalysis';
import { PERSONA_FIELDS, TRAIT_ENTRY_FIELDS } from './statCodeSurface';

/** Completions for a caret written as `|` in the doc. */
function labels(doc: string, options?: Parameters<typeof statCodeCompletions>[2]) {
  const pos = doc.indexOf('|');
  expect(pos, 'every completion case marks its caret with |').toBeGreaterThanOrEqual(0);
  return (statCodeCompletions(doc.replace('|', ''), pos, options)?.options ?? []).map((option) => option.label);
}

const messages = (code: string, options?: Parameters<typeof statCodeDiagnostics>[1]) =>
  statCodeDiagnostics(code, options).map((diagnostic) => diagnostic.message);

/** Top-level traits under these names. */
const topLevel = (...names: string[]) => names.map((name) => ({ id: name, name, path: [] }));

// Two entities a persona choice can play, and one it can't, whose trait is no persona trait.
const entities: CodeEntityNames[] = [
  { id: 'e1', name: 'Mira', persona: true, traits: topLevel('Scarred', 'Night Owl') },
  { id: 'e2', name: 'Lyra', persona: true, traits: topLevel('Scarred') },
  { id: 'e3', name: 'Ash', persona: false, traits: topLevel('Loyal') },
];
const personaOptions = { entities };

describe('persona in stat code', () => {
  it('reads the reporter’s script as clean', () => {
    expect(messages("if (persona.traits['Scarred'].enabled) self.value -= 1;", personaOptions)).toEqual([]);
    expect(messages('return persona.traits.Scarred?.enabled && persona.name === "Mira" ? 1 : 0;', personaOptions)).toEqual([]);
  });

  it('offers persona’s members, its trait names once each, and a trait’s members', () => {
    expect(labels('return persona.|')).toEqual(PERSONA_FIELDS.map((field) => field.name));
    expect(labels('return persona.traits.|', personaOptions)).toEqual(['Scarred']);
    expect(labels('return persona.traits["|"];', { ...personaOptions, traits: ['Brave'] })).toEqual(['Scarred', 'Night Owl']);
    const members = TRAIT_ENTRY_FIELDS.map((field) => field.name);
    expect(labels('return persona.traits.Scarred.|', personaOptions)).toEqual(members);
    expect(labels('return persona.traits["Night Owl"].|', personaOptions)).toEqual(members);
  });

  it('warns on a trait no persona in the world holds, since a library persona can', () => {
    const [problem] = statCodeDiagnostics('return persona.traits.Scared.enabled ? 1 : 0;', personaOptions);
    expect(problem).toMatchObject({
      severity: 'warning',
      message: 'Unknown persona trait name “Scared”. A library persona can have it. Did you mean “Scarred”?',
    });
  });

  it('reads persona trait names only from entities a persona choice can play', () => {
    expect(messages('return persona.traits.Loyal.enabled ? 1 : 0;', personaOptions))
      .toEqual(['Unknown persona trait name “Loyal”. A library persona can have it.']);
  });

  it('checks no persona trait name when it is given no names', () => {
    expect(messages('return persona.traits.Anything.enabled ? 1 : 0;')).toEqual([]);
  });

  it('keeps persona trait names apart from the world’s', () => {
    expect(messages('return persona.traits.Brave.enabled ? 1 : 0;', { traits: ['Brave'], ...personaOptions }))
      .toEqual(['Unknown persona trait name “Brave”. A library persona can have it.']);
    expect(messages('return traits.Scarred.enabled ? 1 : 0;', { traits: ['Brave'], ...personaOptions }))
      .toEqual(['No trait is named “Scarred”.']);
  });

  it('flags a write to anything but a persona trait’s enabled', () => {
    expect(messages('persona.traits.Scarred.acquired = true;', personaOptions))
      .toEqual(['persona.traits.Scarred.acquired can’t be written. Only persona.traits.Scarred.enabled can.']);
    expect(messages('persona.traits.Scarred = false;', personaOptions))
      .toEqual(['Write to persona.traits.Scarred.enabled instead.']);
    expect(messages('persona.name = "Rook";')).toEqual(['persona.name is read-only.']);
  });

  it('counts a persona switch as code that does something, so it asks for no return', () => {
    expect(messages('persona.traits.Scarred.enabled = self.value <= 0;', personaOptions)).toEqual([]);
  });

  it('leaves an author’s own persona variable alone', () => {
    expect(messages('const persona = { traits: {} }; persona.traits.x = 1; return 1;', personaOptions)).toEqual([]);
  });
});
