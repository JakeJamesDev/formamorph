import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RequirementRowsField } from './RequirementRowsField';
import { requirementStatSections } from '@/lib/requirementStatOptions';
import type { GateInput, GateStat, GateStatSet, RequirementOption, RequirementOptions, RowState } from '@/lib/traitGates';
import { scoped, type OwnerId } from '@/lib/scope';
import type { TraitRequirement, TraitRequirementRow } from '@/types';

const S = (name: string): GateStat => ({ name, value: 10, min: 0, max: 100 });
const ash = { id: 'ash', name: 'Ash' };
const mira = { id: 'mira', name: 'Mira', persona: true };

const trait = (id: string, label: string, breadcrumb: string[], home?: { id: string; name: string }, owners: RequirementOption['owners'] = []): RequirementOption =>
  ({ requirement: { kind: 'trait', id }, label, breadcrumb, owners, ...(home ? { home } : {}) });
const world = (n: number) => Array.from({ length: n }, (_, i) => trait(`w${i}`, `World Trait ${i}`, i % 2 ? ['Habits'] : ['World']));
const traits = [
  ...world(6),
  ...Array.from({ length: 5 }, (_, i) => trait(`a${i}`, `Ash Trait ${i}`, ['Ash', 'Bond'], ash, [{ owner: { kind: 'you' }, name: 'Persona' }])),
  ...Array.from({ length: 3 }, (_, i) => trait(`m${i}`, `Mira Trait ${i}`, ['Mira'], mira)),
];
const personas: RequirementOption[] = [{ requirement: { kind: 'playingAs', id: 'mira' }, label: 'Mira', breadcrumb: ['Persona'], owners: [] }];
const input: Pick<GateInput, 'owners' | 'entities' | 'stats'> = {
  owners: [],
  entities: [ash, mira],
  stats: scoped<GateStatSet>({ rage: S('Rage'), gold: S('Gold') }, { ash: { hunger: S('Hunger'), thirst: S('Thirst') }, mira: { mood: S('Mood'), joy: S('Joy') } }),
};
const textOf = (r: TraitRequirement) => r.id ?? '';

function Harness({ choices = { traits, groups: [], personas }, host = 'ash', offWorld = false, stats = true }: {
  choices?: RequirementOptions;
  host?: OwnerId;
  offWorld?: boolean;
  stats?: boolean;
}) {
  const [rows, setRows] = useState<TraitRequirementRow[]>([]);
  const states: RowState[] = rows.map((row) => ({
    holds: false, conditions: row.all.map((r) => ({ text: textOf(r), holds: false, unresolved: false, hidden: false })),
  }));
  return (
    <TooltipProvider>
      <RequirementRowsField
        rows={rows} states={states} options={choices} statSections={stats ? requirementStatSections(input, host) : []}
        textOf={textOf} placeholders={[]} offWorld={offWorld} onChange={setRows} onOpen={() => {}}
      />
      <output data-testid="rows">{JSON.stringify(rows)}</output>
    </TooltipProvider>
  );
}

const items = () => screen.getAllByRole('option').map((o) => o.getAttribute('aria-label') ?? o.textContent);
const opens = (name: string, count: number) => `${name}, ${count} available, opens a page`;
const pageRow = (name: string) => screen.getByRole('option', { name: new RegExp(`^${name}, \\d+ available, opens a page$`) });
const openPicker = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Add Requirement' }));
  return user;
};

describe('the Requires picker categories', () => {
  it('opens on the categories with counts in a large world', async () => {
    render(<Harness />);
    await openPicker();
    // 14 traits, 8 stats, Time of Day and one persona: Time of Day and the lone persona are rows of their own.
    expect(items()).toEqual([opens('Traits', 14), opens('Stats', 8), 'Time of Day', 'MiraPlaying As › Persona']);
  });

  it('lists the stat owners in the order of the old sections', async () => {
    render(<Harness />);
    const user = await openPicker();
    await user.click(pageRow('Stats'));
    // The host's own first, then Global, then Persona, then each entity.
    expect(items()).toEqual([opens('Ash', 2), opens('Global', 2), opens('Persona', 2), opens('Mira', 2)]);
    await user.click(pageRow('Global'));
    expect(items()).toEqual(['Rage', 'Gold']);
  });

  it('drops the owner from the breadcrumb on its page and keeps it in root search', async () => {
    render(<Harness />);
    const user = await openPicker();
    await user.click(pageRow('Traits'));
    expect(items()).toEqual([opens('World', 6), opens('Ash', 5), opens('Mira', 3)]);
    await user.click(pageRow('Ash'));
    expect(items()).toEqual(Array.from({ length: 5 }, (_, i) => `Ash Trait ${i}Bond`));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(pageRow('World'));
    expect(items()).toEqual(world(6).map((o, i) => `${o.label}${i % 2 ? 'Habits' : ''}`));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));

    await user.type(screen.getByPlaceholderText(/^Search /), 'Ash Trait 0');
    expect(items()).toEqual(['Ash Trait 0Ash › Bond']);
  });

  it('keeps two owners with one name on pages of their own', async () => {
    const twin = { id: 'ash2', name: 'Ash' };
    const choices = { traits: [...traits, trait('t1', 'Twin Trait', ['Ash'], twin), trait('t2', 'Twin Trait Two', ['Ash'], twin)], groups: [], personas };
    render(<Harness choices={choices} />);
    const user = await openPicker();
    await user.click(pageRow('Traits'));
    expect(items().filter((i) => i?.startsWith('Ash,'))).toHaveLength(2);
  });

  it('shows only the categories that have targets off-world', async () => {
    const many = { ...input, stats: scoped<GateStatSet>({}, { ash: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`s${i}`, S(`Stat ${i}`)])) }) };
    const Off = () => (
      <TooltipProvider>
        <RequirementRowsField
          rows={[]} states={[]} options={{ traits: [], groups: [], personas: [] }} statSections={requirementStatSections(many, 'ash')}
          textOf={textOf} placeholders={[]} offWorld onChange={() => {}} onOpen={() => {}}
        />
      </TooltipProvider>
    );
    render(<Off />);
    await openPicker();
    expect(items()).toEqual([opens('Stats', 16), 'Time of Day']);
  });

  it('returns from the owner choice page to the drilled page', async () => {
    render(<Harness />);
    const user = await openPicker();
    await user.click(pageRow('Traits'));
    await user.click(pageRow('Ash'));
    fireEvent.click(screen.getByRole('option', { name: /^Ash Trait 1/ }));
    expect(screen.getByRole('button', { name: 'Back to targets' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to targets' }));
    expect(items()).toEqual(Array.from({ length: 5 }, (_, i) => `Ash Trait ${i}Bond`));
    expect(screen.getByText('Traits › Ash')).toBeInTheDocument();
  });

  it('keeps a small picker as today’s flat list', async () => {
    render(<Harness choices={{ traits: traits.slice(0, 3), groups: [], personas: [] }} stats={false} />);
    await openPicker();
    expect(screen.queryByRole('option', { name: /opens a page/ })).toBeNull();
    expect(items()).toEqual(['World Trait 0World', 'World Trait 1Habits', 'World Trait 2World', 'Time of Day']);
  });
});
