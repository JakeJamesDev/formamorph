import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TraitStoreContext, type TraitStore } from '@/contexts/TraitStoreContext';
import { editorGateInput } from '@/lib/bearers';
import { TraitRequiresField } from './TraitRequiresField';
import type { Entity, Trait, TraitGroup, TraitRequirement } from '@/types';

const trait = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
// Root: Brave. Blueprints: Classes (Paladin, Wizard), Smite. Albus links Classes; Mira owns Squire.
const traits = [
  trait('brave', { name: 'Brave', groupId: null, order: 0 }),
  trait('paladin', { name: 'Paladin', groupId: 'classes', order: 0 }),
  trait('wizard', { name: 'Wizard', groupId: 'classes', order: 1 }),
  trait('smite', { name: 'Smite', groupId: 'blueprints', order: 1 }),
];
const traitGroups: TraitGroup[] = [
  { id: 'blueprints', name: 'Blueprints', parentId: null, order: 1, system: 'blueprints' },
  { id: 'classes', name: 'Classes', parentId: 'blueprints', order: 0, maxPicks: 1 },
];
const albus: Entity = {
  id: 'albus', name: 'Albus', persona: true,
  traitLinks: [{ id: 'l-classes', originalId: 'classes', kind: 'group', originalName: 'Classes', groupId: null, order: 0 }],
};
const mira: Entity = { id: 'mira', name: 'Mira', traits: [trait('squire', { name: 'Squire' })] };

/** The field over a trait whose edits land, so a test reads the chips the author would see next. */
function Harness({ trait: initial, offWorld = false, onOpen = () => {}, extra = { traits: [], traitGroups: [] } }: {
  trait: Trait;
  offWorld?: boolean;
  onOpen?: (r: TraitRequirement) => void;
  extra?: { traits: Trait[]; traitGroups: TraitGroup[] };
}) {
  const [current, setCurrent] = useState(initial);
  // The store reads the edited trait wherever it lives, as the World Editor's store does.
  const swap = (t: Trait) => (t.id === current.id ? current : t);
  const world = {
    traits: [...traits, ...extra.traits].map(swap),
    traitGroups: [...traitGroups, ...extra.traitGroups],
    entities: [albus, { ...mira, traits: mira.traits!.map(swap) }],
  };
  const store = {
    ...world, placeholders: [], stats: [], gateInput: editorGateInput(world), pinWorld: null, offWorld,
  } as unknown as TraitStore;
  return (
    <TooltipProvider>
      <TraitStoreContext.Provider value={store}>
        <TraitRequiresField
          trait={current}
          onChange={(requires) => setCurrent({ ...current, requires: requires.length ? requires : undefined })}
          onOpen={onOpen}
        />
      </TraitStoreContext.Provider>
    </TooltipProvider>
  );
}

/** Opens the picker that adds a row: **Add Requirement** first, **Or Another Way** after. */
const openPicker = () => fireEvent.click(screen.getByRole('button', { name: /^(Add Requirement|Or Another Way)$/ }));
const option = (name: RegExp) => screen.getByRole('option', { name });
const ADDS = ['Add Requirement', 'Or Another Way', 'And'];
const chips = () => screen.getAllByRole('button').map((b) => b.textContent).filter((t) => t && !ADDS.includes(t) && !t.startsWith('Remove'));
/** Each row's text, chips and joins in order. */
const rowTexts = () => [...document.querySelectorAll('[data-requirement-row]')].map((row) => row.textContent);

describe('TraitRequiresField bearer choice', () => {
  it('asks which bearer after a target, listing Same Bearer, You, then every entity that bears it', async () => {
    render(<Harness trait={traits[3]} />);
    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /^Paladin/ }));
    expect(screen.getByRole('button', { name: 'Back to targets' }).parentElement?.textContent).toBe('Requires Paladin on');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Same BearerWhoever has the trait', 'You', 'Albus']);
    expect(screen.getByPlaceholderText('Search bearers')).toHaveValue('');
  });

  it('adds the requirement scoped to the picked bearer, and the chip names the bearer', async () => {
    render(<Harness trait={traits[3]} />);
    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /^Paladin/ }));
    fireEvent.click(option(/^Albus/));
    expect(screen.getByRole('button', { name: 'Albus: Paladin' })).toBeInTheDocument();

    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /^Paladin/ }));
    fireEvent.click(option(/^You/));
    expect(screen.getByRole('button', { name: 'You: Paladin' })).toBeInTheDocument();

    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /^Paladin/ }));
    fireEvent.click(option(/^Same Bearer/));
    expect(chips()).toEqual(['Albus: Paladin', 'You: Paladin', 'Paladin']);
  });

  it('opens a chip on its target whatever its bearer', async () => {
    const onOpen = vi.fn();
    render(<Harness trait={trait('smite', { name: 'Smite', requires: [{ all: [{ kind: 'trait', id: 'paladin', bearer: { kind: 'you' } }] }] })} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'You: Paladin' }));
    expect(onOpen).toHaveBeenCalledWith({ kind: 'trait', id: 'paladin', bearer: { kind: 'you' } });
  });

  it('disables a bearer already listed, and the target only once every bearer is', async () => {
    const listed: TraitRequirement[] = [{ kind: 'trait', id: 'paladin', bearer: { kind: 'you' } }];
    render(<Harness trait={trait('smite', { name: 'Smite', requires: [{ all: listed }] })} />);
    openPicker();
    const paladin = await screen.findByRole('option', { name: /^Paladin/ });
    expect(paladin).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(paladin);
    expect(option(/^You/)).toHaveAttribute('aria-disabled', 'true');
    expect(option(/^Same Bearer/)).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(option(/^Same Bearer/));
    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /^Paladin/ }));
    fireEvent.click(option(/^Albus/));
    openPicker();
    expect(await screen.findByRole('option', { name: /^Paladin/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('goes back to the targets with the search cleared, and closing the picker forgets the target', async () => {
    render(<Harness trait={traits[3]} />);
    openPicker();
    fireEvent.change(screen.getByPlaceholderText('Search traits, groups, and personas'), { target: { value: 'pal' } });
    fireEvent.click(await screen.findByRole('option', { name: /^Paladin/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to targets' }));
    expect(screen.getByPlaceholderText('Search traits, groups, and personas')).toHaveValue('');
    expect(screen.getByRole('option', { name: /^Wizard/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /^Paladin/ }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    openPicker();
    expect(await screen.findByPlaceholderText('Search traits, groups, and personas')).toBeInTheDocument();
  });

  it('offers a same-bearer requirement on an owned trait and names its group bearers', async () => {
    render(<Harness trait={mira.traits![0]} />);
    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /^any Classes/ }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Same BearerWhoever has the trait', 'You', 'Albus']);
    fireEvent.click(option(/^Albus/));
    expect(screen.getByRole('button', { name: 'Albus: any Classes' })).toBeInTheDocument();
  });

  it('adds a playing-as target at once, and every target at once off-world', async () => {
    render(<Harness trait={traits[3]} />);
    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /^playing as Albus/ }));
    expect(screen.getByRole('button', { name: 'playing as Albus' })).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('adds a target for the same bearer at once off-world', async () => {
    render(<Harness trait={mira.traits![0]} offWorld />);
    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /^Brave/ }));
    expect(screen.getByRole('button', { name: 'Brave' })).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('TraitRequiresField breadcrumbs', () => {
  // Lore › Runes › Elder › Deep holds Rune: a path long enough to collapse.
  const deep = {
    traits: [trait('rune', { name: 'Rune', groupId: 'deep', order: 0 })],
    traitGroups: [
      { id: 'lore', name: 'Lore', parentId: null, order: 2 },
      { id: 'runes', name: 'Runes', parentId: 'lore', order: 0 },
      { id: 'elder', name: 'Elder', parentId: 'runes', order: 0 },
      { id: 'deep', name: 'Deep', parentId: 'elder', order: 0 },
    ] satisfies TraitGroup[],
  };

  it('collapses a deep path to its first and last groups, and shows the full path on hover', async () => {
    const user = userEvent.setup();
    render(<Harness trait={traits[0]} extra={deep} />);
    await user.click(screen.getByRole('button', { name: 'Add Requirement' }));
    expect(option(/^Rune/).textContent).toBe('RuneLore › … › Deep');
    expect(option(/^Paladin/).textContent).toBe('PaladinBlueprints › Classes');
    await user.hover(option(/^Rune/));
    expect(await screen.findByText('Lore › Runes › Elder › Deep')).toBeVisible();
  });

  it('finds a row by a group its collapsed path hides', async () => {
    const user = userEvent.setup();
    render(<Harness trait={traits[0]} extra={deep} />);
    await user.click(screen.getByRole('button', { name: 'Add Requirement' }));
    await user.type(screen.getByPlaceholderText('Search traits, groups, and personas'), 'elder');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'RuneLore › … › Deep', 'any ElderLore › Runes', 'any DeepLore › … › Elder',
    ]);
  });
});

describe('TraitRequiresField rows', () => {
  const paladin: TraitRequirement = { kind: 'trait', id: 'paladin' };
  const brave: TraitRequirement = { kind: 'trait', id: 'brave' };
  const wizard: TraitRequirement = { kind: 'trait', id: 'wizard' };
  const smite = (requires: Trait['requires']) => trait('smite', { name: 'Smite', requires });

  it('reads Add Requirement with no rows, and Or Another Way once a row exists', () => {
    render(<Harness trait={smite(undefined)} />);
    expect(screen.getByRole('button', { name: 'Add Requirement' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'And' })).toBeNull();
    expect(screen.queryByText(/any one of these/)).toBeNull();
  });

  it('joins Conditions with "and" inside a row and rows with "or" between them', () => {
    render(<Harness trait={smite([{ all: [paladin, brave] }, { all: [wizard] }])} />);
    expect(rowTexts()).toEqual(['PaladinandBraveAnd', 'WizardAnd']);
    expect(screen.getAllByText('or')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'And' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Or Another Way' })).toBeInTheDocument();
  });

  it('adds a Condition to its own row with And, and a new row with Or Another Way', async () => {
    render(<Harness trait={smite([{ all: [paladin] }, { all: [wizard] }])} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'And' })[1]);
    // Only You can hold a world trait, so Brave adds with no bearer page.
    fireEvent.click(await screen.findByRole('option', { name: /^Brave/ }));
    expect(rowTexts()).toEqual(['PaladinAnd', 'WizardandBraveAnd']);

    openPicker();
    // Only You can hold a world trait, so Brave adds with no bearer page.
    fireEvent.click(await screen.findByRole('option', { name: /^Brave/ }));
    expect(rowTexts()).toEqual(['PaladinAnd', 'WizardandBraveAnd', 'BraveAnd']);
  });

  it('disables a Condition already in the row And adds to, but not one only in another row', async () => {
    render(<Harness trait={smite([{ all: [paladin] }, { all: [wizard] }])} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'And' })[0]);
    fireEvent.click(await screen.findByRole('option', { name: /^Paladin/ }));
    expect(option(/^Same Bearer/)).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Back to targets' }));
    fireEvent.click(screen.getByRole('option', { name: /^Wizard/ }));
    expect(option(/^Same Bearer/)).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('removes a chip from its row, and the row with its last chip', () => {
    render(<Harness trait={smite([{ all: [paladin, brave] }, { all: [wizard] }])} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Wizard' }));
    expect(rowTexts()).toEqual(['PaladinandBraveAnd']);
    expect(screen.queryByText('or')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Brave' }));
    expect(rowTexts()).toEqual(['PaladinAnd']);
  });

  it('removes a whole row with its own control', () => {
    render(<Harness trait={smite([{ all: [paladin, brave] }, { all: [wizard] }])} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove row Paladin and Brave' }));
    expect(rowTexts()).toEqual(['WizardAnd']);
  });

  it('removes the last row and goes back to Add Requirement', () => {
    render(<Harness trait={smite([{ all: [paladin] }])} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove row Paladin' }));
    expect(rowTexts()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Add Requirement' })).toBeInTheDocument();
  });
});
