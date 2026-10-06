import { describe, it, expect } from 'vitest';
import type { WorldOverview } from '@/types';
import { createWorldMirror, createWorldPatcher } from './worldMirror';
import type { RuleWorld } from './rules';

const base: RuleWorld = {
  worldOverview: { name: 'Sedge Landing', description: '', thumbnail: 'data:image/webp;base64,AAAA' } as WorldOverview,
  stats: [],
  locations: [{ id: 'harbor', name: 'Harbor Steps' }],
  entities: [{ id: 'e1', name: 'Maren' }, { id: 'e2', name: 'Wick' }],
  traits: [], statUpdates: [], dictionaries: [], placeholders: [],
};

/** Send `world` through a structured-clone hop, as postMessage does. */
const hop = <T>(value: T): T => structuredClone(value);

describe('the world mirror', () => {
  it('rebuilds each world the patches describe, edit after edit', () => {
    const patcher = createWorldPatcher();
    const mirror = createWorldMirror();
    const worlds: RuleWorld[] = [base];
    worlds.push({ ...base, entities: [base.entities[0], { ...base.entities[1], name: 'Wick the Elder' }] });
    worlds.push({ ...worlds[1], entities: [worlds[1].entities[1], worlds[1].entities[0], { id: 'e3', name: 'Moss' }] });
    worlds.push({ ...worlds[2], entities: [worlds[2].entities[2]] });
    worlds.push({ ...worlds[3], worldOverview: { ...base.worldOverview, name: 'Sedge Landing, grown', thumbnail: null } });
    const { connections: _c, ...withoutConnections } = { ...worlds[4], connections: [] };
    worlds.push({ ...withoutConnections, connections: [{ id: 'c1', a: 'harbor', b: 'harbor', aToB: {} }] });
    worlds.push(withoutConnections);
    for (const world of worlds) expect(mirror.apply(hop(patcher.patch(world)))).toEqual(world);
  });

  it('sends a record once and keeps it by identity on the far side', () => {
    const patcher = createWorldPatcher();
    const mirror = createWorldMirror();
    const first = mirror.apply(hop(patcher.patch(base)));
    const edited = { ...base, entities: [base.entities[0], { ...base.entities[1], name: 'Wick the Elder' }] };
    const patch = patcher.patch(edited);
    expect(Object.keys(patch.slices)).toEqual(['entities']);
    expect(patch.slices.entities).toEqual({ kind: 'records', order: ['e1', 'e2'], upserts: [edited.entities[1]] });

    const second = mirror.apply(hop(patch));
    expect(second.entities[0]).toBe(first.entities[0]);
    expect(second.locations).toBe(first.locations);
  });

  it('sends only the overview fields an edit changed', () => {
    const patcher = createWorldPatcher();
    patcher.patch(base);
    const patch = patcher.patch({ ...base, worldOverview: { ...base.worldOverview, name: 'Sedge' } });
    expect(patch.slices.worldOverview).toEqual({ kind: 'fields', keys: ['name', 'description', 'thumbnail'], changed: { name: 'Sedge' } });
  });

  it('sends everything again after a reset, for a mirror that was lost', () => {
    const patcher = createWorldPatcher();
    patcher.patch(base);
    patcher.reset();
    expect(createWorldMirror().apply(hop(patcher.patch(base)))).toEqual(base);
  });
});
