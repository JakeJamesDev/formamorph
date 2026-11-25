import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ADD_FIRST, FieldHarness, type FieldInput } from '@/test/requirementRows';
import type { GateOwner, GateStat, GateStatSet, RequirementOption } from '@/lib/traitGates';
import { scoped } from '@/lib/scope';
import type { Trait } from '@/types';

const S = (name: string): GateStat => ({ name, value: 10, min: 0, max: 100 });
const T = (id: string, name: string, groupId: string | null = null): Trait => ({ id, name, statChanges: [], groupId });

// Six Global traits (the odd ones in Habits), five of Ash's in Bond, three of Mira's; Mira can be played.
const globalTraits = Array.from({ length: 6 }, (_, i) => T(`w${i}`, `World Trait ${i}`, i % 2 ? 'habits' : null));
const ash: GateOwner = { id: 'ash', name: 'Ash', groups: [{ id: 'bond', name: 'Bond', parentId: null }], traits: Array.from({ length: 5 }, (_, i) => T(`a${i}`, `Ash Trait ${i}`, 'bond')) };
const mira: GateOwner = { id: 'mira', name: 'Mira', groups: [], traits: Array.from({ length: 3 }, (_, i) => T(`m${i}`, `Mira Trait ${i}`)) };
const input: FieldInput = {
  global: { traits: globalTraits, groups: [{ id: 'habits', name: 'Habits', parentId: null }] },
  owners: [ash, mira],
  entities: [{ id: 'ash', name: 'Ash' }, { id: 'mira', name: 'Mira', persona: true }],
  stats: scoped<GateStatSet>({ rage: S('Rage'), gold: S('Gold') }, { ash: { hunger: S('Hunger'), thirst: S('Thirst') }, mira: { mood: S('Mood'), joy: S('Joy') } }),
};
const ASH = { kind: 'entity', id: 'ash', name: 'Ash' } as const;

function Harness({ gate = input, offWorld = false, items }: { gate?: FieldInput; offWorld?: boolean; items?: RequirementOption[] }) {
  const options = { personas: [{ requirement: { kind: 'playingAs' as const, id: 'mira' }, label: 'Mira', breadcrumb: ['Persona'] }], ...(items && { items }) };
  return <FieldHarness input={gate} host={ASH} options={options} offWorld={offWorld} />;
}

const items = () => screen.getAllByRole('option').map((o) => o.getAttribute('aria-label') ?? o.textContent);
const opens = (name: string, count: number) => `${name}, ${count} available, opens a page`;
const pageRow = (name: string) => screen.getByRole('option', { name: new RegExp(`^${name}, \\d+ available, opens a page$`) });
const openPicker = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: ADD_FIRST }));
  return user;
};

describe('the Requires picker categories', () => {
  it('opens on the categories with counts in a large world', async () => {
    render(<Harness />);
    await openPicker();
    // 17 trait rows (Mira's three on Persona and on her page), 2 groups, 8 stats, Time of Day and one persona.
    expect(items()).toEqual([opens('Traits', 17), opens('Any Trait in a Group', 2), opens('Stats', 8), 'Time of Day', 'MiraPlaying As › Persona']);
  });

  it('gives Traits, Any Trait in a Group and Stats the same pages in the same order', async () => {
    // Two groups on every page, so each category drills into pages.
    const two = (a: string, b: string) => [{ id: a, name: a, parentId: null }, { id: b, name: b, parentId: null }];
    const both = {
      ...input,
      global: { ...input.global, groups: [...input.global.groups, ...two('Quirks', 'Vows')] },
      owners: [{ ...ash, groups: [...ash.groups, ...two('Kin', 'Pack')] }, { ...mira, groups: two('Mood', 'Air') }],
    };
    render(<Harness gate={both} />);
    const user = await openPicker();
    const pages = async (category: string) => {
      await user.click(pageRow(category));
      const names = items().map((i) => i?.replace(/, \d+ available, opens a page$/, ''));
      await user.click(screen.getByRole('button', { name: 'Back' }));
      return names;
    };
    const traitPages = await pages('Traits');
    expect(traitPages).toEqual(['Ash', 'Global', 'Persona', 'Mira']);
    expect(await pages('Any Trait in a Group')).toEqual(traitPages);
    expect(await pages('Stats')).toEqual(traitPages);
  });

  it('lists the stat owners: the host’s own first, then Global, then Persona, then each entity', async () => {
    render(<Harness />);
    const user = await openPicker();
    await user.click(pageRow('Stats'));
    expect(items()).toEqual([opens('Ash', 2), opens('Global', 2), opens('Persona', 2), opens('Mira', 2)]);
    await user.click(pageRow('Global'));
    expect(items()).toEqual(['Rage', 'Gold']);
  });

  it('drops the owner from the breadcrumb on its page and keeps it in root search', async () => {
    render(<Harness />);
    const user = await openPicker();
    await user.click(pageRow('Traits'));
    expect(items()).toEqual([opens('Ash', 5), opens('Global', 6), opens('Persona', 3), opens('Mira', 3)]);
    await user.click(pageRow('Ash'));
    expect(items()).toEqual(Array.from({ length: 5 }, (_, i) => `Ash Trait ${i}Bond`));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(pageRow('Global'));
    // Tree order: the Habits group's traits, then the root's.
    expect(items()).toEqual(['World Trait 1Habits', 'World Trait 3Habits', 'World Trait 5Habits', 'World Trait 0', 'World Trait 2', 'World Trait 4']);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));

    await user.type(screen.getByPlaceholderText(/^Search /), 'Ash Trait 0');
    expect(items()).toEqual(['Ash Trait 0Ash › Bond']);
  });

  it('keeps two owners with one name on pages of their own', async () => {
    const twin: GateOwner = { id: 'ash2', name: 'Ash', groups: [], traits: [T('t1', 'Twin Trait'), T('t2', 'Twin Trait Two')] };
    render(<Harness gate={{ ...input, owners: [...input.owners, twin] }} />);
    const user = await openPicker();
    await user.click(pageRow('Traits'));
    expect(items().filter((i) => i?.startsWith('Ash,'))).toHaveLength(2);
  });

  it('shows only the host’s own page off-world', async () => {
    const many = { ...input, owners: [], global: { traits: [], groups: [] }, stats: scoped<GateStatSet>({ rage: S('Rage') }, { ash: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`s${i}`, S(`Stat ${i}`)])) }) };
    render(<Harness gate={many} offWorld />);
    await openPicker();
    expect(items()).toEqual([opens('Stats', 16), 'Time of Day']);
  });

  it('adds a trait at once from a drilled page, with no owner page', async () => {
    render(<Harness />);
    const user = await openPicker();
    await user.click(pageRow('Traits'));
    await user.click(pageRow('Ash'));
    fireEvent.click(screen.getByRole('option', { name: /^Ash Trait 1/ }));
    expect(screen.queryByRole('button', { name: 'Back to targets' })).toBeNull();
    expect(JSON.parse(screen.getByTestId('rows').textContent!)).toEqual([{ all: [{ kind: 'trait', id: 'a1' }] }]);
  });

  it('adds an item at once from a drilled page, with no owner page', async () => {
    const lamp: RequirementOption = { requirement: { kind: 'item', id: 'lamp', status: 'owned' }, label: 'Lantern', breadcrumb: [] };
    const rope: RequirementOption = { ...lamp, requirement: { kind: 'item', id: 'rope', status: 'owned' }, label: 'Rope' };
    render(<Harness items={[lamp, rope]} />);
    const user = await openPicker();
    await user.click(pageRow('Items'));
    fireEvent.click(screen.getByRole('option', { name: /^Lantern/ }));
    expect(screen.queryByRole('button', { name: 'Back to targets' })).toBeNull();
    expect(JSON.parse(screen.getByTestId('rows').textContent!)).toEqual([{ all: [{ kind: 'item', id: 'lamp', status: 'owned' }] }]);
  });

  it('keeps a small picker as today’s flat list', async () => {
    const small = { global: { traits: globalTraits.slice(0, 3), groups: input.global.groups }, owners: [], entities: [] };
    render(<FieldHarness input={small} host={ASH} options={{ personas: [] }} />);
    await openPicker();
    expect(screen.queryByRole('option', { name: /opens a page/ })).toBeNull();
    expect(items()).toEqual(['World Trait 1Habits', 'World Trait 0Global', 'World Trait 2Global', 'HabitsGlobal', 'Time of Day']);
  });
});
