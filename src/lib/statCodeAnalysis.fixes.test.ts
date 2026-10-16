import { describe, it, expect } from 'vitest';
import { codeDiagnostics, statCodeDiagnostics, type AnalysisOptions } from './statCodeAnalysis';
import { spliced } from './statCodeRename';
import { toolScriptSurface } from './tools/toolScriptSurface';
import type { Placeholder } from '@/types';

const ph = (id: string, name: string): Placeholder => ({ id, name, values: [] });
const top = (...names: string[]) => names.map((name) => ({ id: name, name, path: [] }));

const world: AnalysisOptions = {
  statNames: ['Health', 'Max HP'],
  traits: ['Brave', 'Night Owl'],
  placeholders: {
    list: [ph('mood', 'Mood'), ph('hair', 'Hair')],
    owners: new Map([['hair', { kind: 'entity', id: 'mara', name: 'Mara' }]]),
    dictionaries: [{ id: 'lore', name: 'Lore' }],
  },
  entities: [{ id: 'mara', name: 'Mara', persona: true, traits: top('Scarred'), stats: ['Trust'] }],
};

/** What the first fix on offer is called and what the code reads after it. */
function fixed(code: string, options: AnalysisOptions = world) {
  const diagnostic = statCodeDiagnostics(code, options).find((d) => d.fixes?.length);
  expect(diagnostic, `a fix is offered in ${code}`).toBeTruthy();
  const [fix] = diagnostic!.fixes!;
  return { label: fix.label, code: spliced(code, [fix]) };
}

describe('quick fixes for a near name', () => {
  it.each([
    ['a world stat', 'return stats.Helth.value;', 'Health', 'return stats.Health.value;'],
    ['a stat field', 'self.valeu = 1;', 'value', 'self.value = 1;'],
    ['a world placeholder', 'return placeholders.Mod.value;', 'Mood', 'return placeholders.Mood.value;'],
    ['an entity’s placeholder', 'return entities.Mara.placeholders.Hiar.value;', 'Hair', 'return entities.Mara.placeholders.Hair.value;'],
    ['a world trait', 'return traits.Brav.enabled;', 'Brave', 'return traits.Brave.enabled;'],
    ['a trait field', 'traits.Brave.enabld = true;', 'enabled', 'traits.Brave.enabled = true;'],
    ['a clock field', 'return clock.deltaHour;', 'deltaHours', 'return clock.deltaHours;'],
    ['an entity', 'return entities.Mra.name;', 'Mara', 'return entities.Mara.name;'],
    ['a dictionary', 'return dictionaries.Lord.name;', 'Lore', 'return dictionaries.Lore.name;'],
    ['an entity’s stat', 'return entities.Mara.stats.Trst.value;', 'Trust', 'return entities.Mara.stats.Trust.value;'],
    ['an entity’s trait', 'return entities.Mara.traits.Scared.enabled;', 'Scarred', 'return entities.Mara.traits.Scarred.enabled;'],
    ['a persona trait', 'return persona.traits.Scared.enabled;', 'Scarred', 'return persona.traits.Scarred.enabled;'],
    ['an unknown global', 'return slef.value;', 'self', 'return self.value;'],
  ])('changes %s to the name it suggests', (_, code, name, after) => {
    expect(fixed(code)).toEqual({ label: `Change to ${name}`, code: after });
  });

  it('changes an owner’s stat', () => {
    const owned: AnalysisOptions = { statNames: [], owner: 'entity', ownerStatNames: ['Hunger'] };
    expect(fixed('return owner.stats.Hungr.value;', owned).code).toBe('return owner.stats.Hunger.value;');
  });

  it('changes a Tool script’s global', () => {
    const surface = toolScriptSurface([]);
    const [diagnostic] = codeDiagnostics('return arg.name;', { surface });
    expect(diagnostic.fixes).toEqual([{ label: 'Change to args', from: 7, to: 10, insert: 'args' }]);
  });

  it('keeps the quote of a bracket key', () => {
    expect(fixed('return stats["Helth"].value;').code).toBe('return stats["Health"].value;');
    expect(fixed("return stats['Max H'].value;").code).toBe("return stats['Max HP'].value;");
  });

  it('rewrites a dot form to a bracket form for a name with a space', () => {
    expect(fixed('return stats.MaxHP.value;')).toEqual({ label: 'Change to Max HP', code: "return stats['Max HP'].value;" });
    expect(fixed('return stats?.MaxHP.value;').code).toBe("return stats?.['Max HP'].value;");
    expect(fixed('return traits.NightOwl.enabled;').code).toBe("return traits['Night Owl'].enabled;");
  });

  it('offers nothing where no name is near, and tags the name as missing instead', () => {
    const [diagnostic] = statCodeDiagnostics('return stats.Zzyzx.value;', world);
    expect(diagnostic.fixes).toBeUndefined();
    expect(diagnostic.missing).toEqual({ kind: 'stat', root: 'stats', segments: ['Zzyzx'] });
  });
});
