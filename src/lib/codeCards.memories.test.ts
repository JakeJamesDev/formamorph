import { describe, expect, it } from 'vitest';
import { codeCard } from './codeCards';
import { statBoxLookup, traitBoxSelf, type CodeCardWorld } from './codeWorldLookup';
import { codeDiagnostics, type SurfaceAnalysisOptions } from './statCodeAnalysis';
import { MEMORY_ENTRY_FIELDS, scriptSurface, WORLD_SCRIPT_SURFACE } from './statCodeSurface';
import { statCodeOwners } from './statCodeTargets';

/** `memories` and its two verbs have cards; the retired `memory` has none. */

const world: CodeCardWorld = {
  traits: [], traitGroups: [], entities: [], stats: [], statGroups: [], placeholders: [], locations: [], worldScripts: [], worldTools: [],
};
const lookup = statBoxLookup(statCodeOwners(world), { owner: null, timing: 'after', self: traitBoxSelf('', '') }, world);
const options: SurfaceAnalysisOptions = { surface: scriptSurface(WORLD_SCRIPT_SURFACE, 'after'), lookup };

const cardAt = (doc: string) => codeCard(doc.replace('|', ''), doc.indexOf('|'), options);

describe('the memories cards', () => {
  it('describes the entries on the list’s card', () => {
    const card = cardAt('memo|ries.filter((m) => m.custom);');
    expect(card?.signature).toMatchObject({ path: 'memories', type: 'array' });
    for (const name of ['id', 'turn', 'day', 'daypart', 'text', 'Custom', 'pins']) expect(card?.description).toContain(name);
  });

  it('lists the thirteen entry fields a run reads, each read-only, then the four verbs', () => {
    expect(MEMORY_ENTRY_FIELDS.map((field) => [field.name, field.access])).toEqual([
      ...['id', 'category', 'turn', 'timestamp', 'day', 'daypart', 'text', 'name', 'custom', 'kept', 'inContext', 'pinned', 'forgotten'].map((name) => [name, 'readOnly']),
      ...['pin', 'forget', 'edit', 'remove'].map((name) => [name, undefined]),
    ]);
  });

  it.each([
    ['append', 'memories.appe|nd("Tor lied.");', '(line) => void', /after the AI’s summary/],
    ['pin', 'memories.pi|n("The bridge is out.");', '(nameOrLine, line?) => void', /sent with every request/],
  ])('shows the %s verb', (verb, doc, type, line) => {
    const card = cardAt(doc);
    expect(card?.signature).toMatchObject({ kind: 'method', path: `memories.${verb}`, type });
    expect(card?.description).toMatch(line);
  });

  it('describes the named pin on the pin card', () => {
    expect(cardAt('memories.pi|n("Nursery", "Ash lives at the nursery.");')?.description).toMatch(/With a name and a line, it overwrites the text/);
  });

  it('reads a memory by name as an entry, with each field’s card', () => {
    expect(cardAt('memories["Nursery"].te|xt;')?.signature).toMatchObject({ path: 'Memory.text' });
    expect(cardAt('memories["Nursery"].na|me;')?.description).toMatch(/Name a script pinned the memory under/);
  });

  it('never underlines a name in brackets', () => {
    expect(codeDiagnostics('memories.pin("Nursery", memories["Nursery"].text + " Bree."); return memories["Stable"].id ? 1 : 0;', options)).toEqual([]);
  });

  it('reads a list and an element pick with no complaint', () => {
    expect(codeDiagnostics('memories.append("a"); memories.pin("b"); return memories.filter((m) => m.daypart === "night").length + memories[0].turn;', options))
      .toEqual([]);
  });

  it('marks the retired name unknown and gives it no card', () => {
    expect(cardAt('memo|ry.add("Tor lied.");')).toBeNull();
    expect(codeDiagnostics('memory.add("Tor lied.");', options).map((d) => d.message))
      .toEqual([expect.stringMatching(/^“memory” isn’t available in /)]);
  });
});
