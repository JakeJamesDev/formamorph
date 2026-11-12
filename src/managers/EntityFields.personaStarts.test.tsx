import 'fake-indexeddb/auto';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useGameData } from '@/contexts/GameDataContext';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { panelWorld, renderPanelBench } from '@/test/panelBench';
import { PLAYER_START, type Entity, type EntityStart, type GameLocation } from '@/types';
import { EntityPersonaField } from './EntityFields';

const LOCATIONS = ['inn', 'mill', 'keep'].map((id) => ({ id, name: id })) as GameLocation[];

const start = (id: string, place: string, over: Partial<EntityStart> = {}): EntityStart => ({ id, place, weight: 2, schedule: [], ...over });
const row = { id: 'r1', time: 'allDay', action: { kind: 'stay', place: 'keep' } } as EntityStart['schedule'][number];

const base = { id: 'mira', name: 'Mira', playerDescription: '', aiDescription: '' };

function Host() {
  const { entities, updateEntity } = useGameData();
  const entity = entities.find((e) => e.id === 'mira');
  return entity ? <Editing entity={entity} write={updateEntity} /> : null;
}

function Editing({ entity, write }: { entity: Entity; write: (next: Entity) => void }) {
  const { draft, setField } = useEditingDraft<Entity>(entity, write);
  return <EntityPersonaField value={draft} onChange={setField} home="world" />;
}

const mount = (entity: Partial<Entity>) => {
  const bench = renderPanelBench(panelWorld({ locations: LOCATIONS, entities: [{ ...base, ...entity } as Entity] }), 'advanced', <Host />);
  return { ...bench, stored: () => bench.ctx().entities.find((e) => e.id === 'mira')! };
};

const switchTo = async (role: string) => { await userEvent.click(screen.getByRole('radio', { name: role })); };

const playable: Partial<Entity> = {
  persona: true, kind: 'unique', traversable: ['mill'], onMap: 'never', knownIn: ['keep'],
  starts: [start('s1', 'inn', { schedule: [row] }), start('s2', PLAYER_START), start('s3', 'mill'), start('s4', 'inn')],
};

describe('a role switch converts the start places', () => {
  it('turns the Starts of a Playable entity into the list, in Start order, and drops the routine fields', async () => {
    const { stored } = mount(playable);
    await switchTo('Persona-Only');
    const e = stored();
    expect(e.locations).toEqual(['inn', 'mill']);
    expect(e).toMatchObject({ persona: true, personaOnly: true });
    for (const gone of ['kind', 'starts', 'traversable', 'onMap', 'knownIn'] as const) expect(e[gone]).toBeUndefined();
  });

  it('turns the list of a Persona-Only entity into one Unique Start per place, with empty Schedules', async () => {
    const { stored } = mount({ persona: true, personaOnly: true, locations: ['mill', 'inn'] });
    await switchTo('Playable');
    const e = stored();
    expect(e.kind).toBe('unique');
    expect(e.starts?.map((s) => [s.place, s.weight, s.schedule])).toEqual([['mill', 1, []], ['inn', 1, []]]);
    expect(new Set(e.starts?.map((s) => s.id)).size).toBe(2);
    expect(e.locations).toBeUndefined();
    expect(e.personaOnly).toBeUndefined();
  });

  it('converts a Generic Cast entity to the Custom Persona list and back', async () => {
    const generic = { kind: 'generic', starts: [start('g1', 'keep'), start('g2', 'inn')] } as Partial<Entity>;
    const { stored } = mount(generic);
    await switchTo('Custom Persona');
    expect(stored().locations).toEqual(['keep', 'inn']);
    expect(stored().starts).toBeUndefined();
    await switchTo('Cast');
    expect(stored().kind).toBe('unique');
    expect(stored().starts?.map((s) => s.place)).toEqual(['keep', 'inn']);
    expect(stored().locations).toBeUndefined();
    expect(stored().customPersona).toBeUndefined();
  });

  it('keeps the Starts when the role stays Cast or Playable', async () => {
    const { stored } = mount(playable);
    await switchTo('Cast');
    expect(stored().starts).toHaveLength(4);
    expect(stored().locations).toBeUndefined();
    expect(stored().onMap).toBe('never');
  });

  it('keeps the list between Persona-Only and the Custom Persona', async () => {
    const { stored } = mount({ persona: true, personaOnly: true, locations: ['mill'] });
    await switchTo('Custom Persona');
    expect(stored().locations).toEqual(['mill']);
    expect(stored().kind).toBeUndefined();
  });

  it('undoes a switch in one step, restoring the Starts and rows exactly', async () => {
    const bench = mount(playable);
    const before = bench.stored();
    await switchTo('Persona-Only');
    expect(bench.stored().starts).toBeUndefined();
    await act(async () => { bench.history().undo(); });
    expect(bench.stored()).toEqual(before);
  });
});
