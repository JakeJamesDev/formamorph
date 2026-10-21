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

  it('lists the eleven entry fields a run reads, each read-only, then the four verbs', () => {
    expect(MEMORY_ENTRY_FIELDS.map((field) => [field.name, field.access])).toEqual([
      ...['id', 'turn', 'timestamp', 'day', 'daypart', 'text', 'custom', 'kept', 'inContext', 'pinned', 'forgotten'].map((name) => [name, 'readOnly']),
      ...['pin', 'forget', 'edit', 'remove'].map((name) => [name, undefined]),
    ]);
  });

  it.each([
    ['add', 'memories.ad|d("Tor lied.");', /after the AI’s summary/],
    ['pin', 'memories.pi|n("The bridge is out.");', /sent with every request/],
  ])('shows the %s verb', (verb, doc, line) => {
    const card = cardAt(doc);
    expect(card?.signature).toMatchObject({ kind: 'method', path: `memories.${verb}`, type: '(line) => void' });
    expect(card?.description).toMatch(line);
  });

  it('reads a list and an element pick with no complaint', () => {
    expect(codeDiagnostics('memories.add("a"); memories.pin("b"); return memories.filter((m) => m.daypart === "night").length + memories[0].turn;', options))
      .toEqual([]);
  });

  it('marks the retired name unknown and gives it no card', () => {
    expect(cardAt('memo|ry.add("Tor lied.");')).toBeNull();
    expect(codeDiagnostics('memory.add("Tor lied.");', options).map((d) => d.message))
      .toEqual([expect.stringMatching(/^“memory” isn’t available in /)]);
  });
});
