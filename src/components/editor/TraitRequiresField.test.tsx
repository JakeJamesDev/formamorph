import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TraitStoreContext, type TraitStore } from '@/contexts/TraitStoreContext';
import { editorGateInput } from '@/lib/owners';
import { ADD_FIRST, ADD_ROW, ADD_TO_ROW, sentences } from '@/test/requirementRows';
import { TraitRequiresField } from './TraitRequiresField';
import type { Entity, Trait, TraitGroup, TraitRequirement, TraitRequirementRow } from '@/types';

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

/** The field over a trait whose edits land, so a test reads the sentences the author would see next. */
function Harness({ trait: initial, offWorld = false, onOpen = () => {}, onRows = () => {}, extra = { traits: [], traitGroups: [] }, miraExtra = [] }: {
  trait: Trait;
  offWorld?: boolean;
  onOpen?: (r: TraitRequirement) => void;
  onRows?: (rows: TraitRequirementRow[]) => void;
  extra?: { traits: Trait[]; traitGroups: TraitGroup[] };
  /** More traits of Mira's own. */
  miraExtra?: Trait[];
}) {
  const [current, setCurrent] = useState(initial);
  // The store reads the edited trait wherever it lives, as the World Editor's store does.
  const swap = (t: Trait) => (t.id === current.id ? current : t);
  const world = {
    traits: [...traits, ...extra.traits].map(swap),
    traitGroups: [...traitGroups, ...extra.traitGroups],
    entities: [albus, { ...mira, traits: [...mira.traits!, ...miraExtra].map(swap) }],
  };
  const store = {
    ...world, placeholders: [], stats: [], gateInput: editorGateInput(world), pinWorld: null, offWorld,
  } as unknown as TraitStore;
  return (
    <TooltipProvider>
      <TraitStoreContext.Provider value={store}>
        <TraitRequiresField
          trait={current}
          onChange={(requires) => {
            onRows(requires);
            setCurrent({ ...current, requires: requires.length ? requires : undefined });
          }}
          onOpen={onOpen}
        />
        <output data-testid="rows">{JSON.stringify(current.requires ?? [])}</output>
      </TraitStoreContext.Provider>
    </TooltipProvider>
  );
}

/** Opens the picker that adds a row: "Add a requirement…" first, "or…" after. */
const openPicker = () => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^(${ADD_FIRST}|${ADD_ROW})$`) }));
const option = (name: RegExp) => screen.getByRole('option', { name });
const button = (name: string) => screen.getByRole('button', { name });
const rows = (): TraitRequirementRow[] => JSON.parse(screen.getByTestId('rows').textContent!);
const smite = (requires: Trait['requires']) => trait('smite', { name: 'Smite', groupId: 'blueprints', requires });
const ALBUS = { kind: 'entity', id: 'albus', name: 'Albus' } as const;

describe('TraitRequiresField owners', () => {
  // A Blueprint trait's Condition with no owner on a Blueprint target reads "This entity" (Q37).
  it('adds a target at once with no owner, and offers no owner, the player, then every entity that owns it', async () => {
    const user = userEvent.setup();
    render(<Harness trait={traits[3]} />);
    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /^Paladin.*Blueprints/ }));
    expect(screen.queryByRole('button', { name: 'Back to targets' })).toBeNull();
    expect(rows()).toEqual([{ all: [{ kind: 'trait', id: 'paladin' }] }]);
    expect(sentences()).toEqual(['This entity has Paladin and…']);
    await user.click(button('Owner: This entity'));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['This entity', 'The player', 'Albus']);
    expect(option(/^This entity/)).toHaveAttribute('aria-selected', 'true');
  });

  it('lists Blueprint traits on their own page of the add menu, never under Global', async () => {
    const user = userEvent.setup();
    // Enough rows that the menu opens on its pages.
    const calm = Array.from({ length: 12 }, (_, i) => trait(`calm${i}`, { name: `Calm ${i}`, groupId: null, order: 2 + i }));
    render(<Harness trait={traits[0]} extra={{ traits: calm, traitGroups: [] }} />);
    openPicker();
    const names = () => screen.getAllByRole('option').map((o) => o.getAttribute('aria-label') ?? o.textContent);
    await user.click(await screen.findByRole('option', { name: /^Traits, / }));
    expect(names()).toEqual([
      'Global, 12 available, opens a page', 'Blueprints, 3 available, opens a page', 'Persona, 2 available, opens a page', 'Albus, 2 available, opens a page', 'SquireMira',
    ]);
    await user.click(screen.getByRole('option', { name: /^Blueprints, / }));
    expect(names()).toEqual(['PaladinClasses', 'WizardClasses', 'Smite']);
  });

  it('lists an entity’s linked traits on its page, and a pick there names the entity', async () => {
    const user = userEvent.setup();
    const calm = Array.from({ length: 12 }, (_, i) => trait(`calm${i}`, { name: `Calm ${i}`, groupId: null, order: 2 + i }));
    render(<Harness trait={traits[0]} extra={{ traits: calm, traitGroups: [] }} />);
    openPicker();
    await user.click(await screen.findByRole('option', { name: /^Traits, / }));
    await user.click(screen.getByRole('option', { name: /^Albus, / }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['PaladinClasses', 'WizardClasses']);
    await user.click(option(/^Paladin/));
    expect(rows()).toEqual([{ all: [{ kind: 'trait', id: 'paladin', owner: ALBUS }] }]);
    expect(sentences()).toEqual(['Albus has Paladin and…']);
  });

  it('names the entity whose page a trait is picked from, never the field’s own entity', async () => {
    const user = userEvent.setup();
    // Squire is Mira's own; the field sits on Brave, a Global Trait.
    render(<Harness trait={traits[0]} />);
    openPicker();
    await user.click(await screen.findByRole('option', { name: /^Squire/ }));
    expect(rows()).toEqual([{ all: [{ kind: 'trait', id: 'squire', owner: { kind: 'entity', id: 'mira', name: 'Mira' } }] }]);
    expect(sentences()).toEqual(['Mira has Squire and…']);
  });

  // A Global Trait's Condition on a Blueprint trait names no one (Q25), so it needs an owner from the target popover (Q31, Q37).
  it('marks a Blueprint target with no owner on a Global Trait, and takes the owner in the target popover', async () => {
    const user = userEvent.setup();
    render(<Harness trait={{ ...traits[0], requires: [{ all: [{ kind: 'trait', id: 'paladin' }] }] }} />);
    expect(sentences()).toEqual(['Paladin is active and…']);
    const target = button('Target: Paladin');
    expect(target).toHaveAttribute('data-broken');
    expect(target).toHaveAttribute('aria-description', 'This trait needs an owner.');
    await user.click(target);
    expect(screen.getAllByRole('button', { pressed: false }).map((b) => b.textContent).filter((t) => ['The player', 'Albus'].includes(t ?? ''))).toEqual(['The player', 'Albus']);
    expect(button('No owner')).toHaveAttribute('aria-pressed', 'true');
    expect(button('Open Paladin')).toBeEnabled();
    await user.click(button('Albus'));
    expect(rows()).toEqual([{ all: [{ kind: 'trait', id: 'paladin', owner: ALBUS }] }]);
    expect(sentences()).toEqual(['Albus has Paladin and…']);
    expect(document.querySelector('[data-broken]')).toBeNull();
  });

  // Q42: the Persona page lists what an entity that can be played holds, and a pick reads the player.
  it('adds a trait from the Persona page as the player’s', async () => {
    const user = userEvent.setup();
    const calm = Array.from({ length: 12 }, (_, i) => trait(`calm${i}`, { name: `Calm ${i}`, groupId: null, order: 2 + i }));
    render(<Harness trait={traits[0]} extra={{ traits: calm, traitGroups: [] }} />);
    openPicker();
    await user.click(await screen.findByRole('option', { name: /^Traits, / }));
    await user.click(screen.getByRole('option', { name: /^Persona, / }));
    await user.click(option(/^Paladin/));
    expect(rows()).toEqual([{ all: [{ kind: 'trait', id: 'paladin', owner: { kind: 'you' } }] }]);
    expect(sentences()).toEqual(['The player has Paladin and…']);
  });

  // Q43: Mira holds no Paladin, so her own reading is no choice, and she never shows by name.
  it('leaves the field’s own entity out of a target it does not hold', async () => {
    const user = userEvent.setup();
    render(<Harness trait={{ ...mira.traits![0], requires: [{ all: [{ kind: 'trait', id: 'paladin', owner: ALBUS }] }] }} />);
    await user.click(button('Owner: Albus'));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['The player', 'Albus']);
  });

  it('writes the owner picked, and the sentence names it', async () => {
    const user = userEvent.setup();
    render(<Harness trait={smite([{ all: [{ kind: 'trait', id: 'paladin' }] }])} />);
    await user.click(button('Owner: This entity'));
    await user.click(option(/^Albus/));
    expect(rows()).toEqual([{ all: [{ kind: 'trait', id: 'paladin', owner: ALBUS }] }]);
    expect(sentences()).toEqual(['Albus has Paladin and…']);
    await user.click(button('Owner: Albus'));
    await user.click(option(/^The player/));
    expect(sentences()).toEqual(['The player has Paladin and…']);
    await user.click(button('Owner: The player'));
    await user.click(option(/^This entity/));
    expect(rows()).toEqual([{ all: [{ kind: 'trait', id: 'paladin' }] }]);
  });

  it('opens a target whatever its owner', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<Harness trait={smite([{ all: [{ kind: 'trait', id: 'paladin', owner: { kind: 'you' } }] }])} onOpen={onOpen} />);
    await user.click(button('Target: Paladin'));
    await user.click(button('Open Paladin'));
    expect(onOpen).toHaveBeenCalledWith({ kind: 'trait', id: 'paladin', owner: { kind: 'you' } });
  });

  it('disables an owner already listed in the row, and the target only once its no-owner form is', async () => {
    const user = userEvent.setup();
    const listed: TraitRequirement[] = [{ kind: 'trait', id: 'paladin', owner: { kind: 'you' } }];
    render(<Harness trait={smite([{ all: listed }])} />);
    fireEvent.click(button(ADD_TO_ROW));
    const paladin = await screen.findByRole('option', { name: /^Paladin.*Blueprints/ });
    expect(paladin).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(paladin);
    expect(sentences()).toEqual(['The player has Paladin and this entity has Paladin and…']);
    await user.click(button('Owner: this entity'));
    expect(option(/^The player/)).toHaveAttribute('aria-disabled', 'true');
    expect(option(/^Albus/)).not.toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Escape}');
    fireEvent.click(button(ADD_TO_ROW));
    expect(await screen.findByRole('option', { name: /^Paladin.*Blueprints/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('reads an owned trait’s Condition under its owner, and lists the group’s owners', async () => {
    const user = userEvent.setup();
    render(<Harness trait={mira.traits![0]} />);
    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /^Classes.*Blueprints/ }));
    expect(sentences()).toEqual(['Mira has a trait in Classes and…']);
    await user.click(button('Owner: Mira'));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Mira', 'The player', 'Albus']);
    await user.click(option(/^Albus/));
    expect(sentences()).toEqual(['Albus has a trait in Classes and…']);
  });

  it('adds a playing-as target at once', async () => {
    render(<Harness trait={traits[3]} />);
    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /^Albus/ }));
    expect(sentences()).toEqual(['The player is Albus and…']);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  // Off-world a trait still reads the world the entity was opened from, and every pick stores no owner.
  it('adds a target at once off-world, with the owner as plain text', async () => {
    render(<Harness trait={mira.traits![0]} miraExtra={[trait('steady', { name: 'Steady' })]} offWorld />);
    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /^Brave/ }));
    expect(button('Target: Brave')).toBeInTheDocument();
    expect(rows()).toEqual([{ all: [{ kind: 'trait', id: 'brave' }] }]);
    expect(screen.queryByRole('button', { name: /^Owner:/ })).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(button(ADD_TO_ROW));
    const names = screen.getAllByRole('option').map((o) => o.textContent);
    // Each trait once: the host's own, the world's, and a Blueprint one; no Persona rows.
    expect(names.filter((n) => /^(Steady|Paladin|Brave)/.test(n ?? ''))).toEqual(['SteadyMira', 'BraveGlobal', 'PaladinBlueprints › Classes']);
    fireEvent.click(screen.getByRole('option', { name: /^Paladin/ }));
    expect(rows()).toEqual([{ all: [{ kind: 'trait', id: 'brave' }, { kind: 'trait', id: 'paladin' }] }]);
    // Off-world no owner can be picked, so no target asks for one.
    expect(document.querySelector('[data-broken]')).toBeNull();
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
    await user.click(button(ADD_FIRST));
    // The world opens on its pages; a search lists rows with their whole path.
    const search = screen.getByPlaceholderText('Search traits, groups, time of day, and personas');
    await user.type(search, 'paladin');
    expect(option(/^Paladin.*Blueprints/).textContent).toBe('PaladinBlueprints › Classes');
    await user.clear(search);
    await user.type(search, 'rune');
    expect(option(/^Rune(?!s)/).textContent).toBe('RuneLore › … › Deep');
    await user.hover(option(/^Rune(?!s)/));
    expect(await screen.findByText('Lore › Runes › Elder › Deep')).toBeVisible();
  });

  it('finds a row by a group its collapsed path hides', async () => {
    const user = userEvent.setup();
    render(<Harness trait={traits[0]} extra={deep} />);
    await user.click(button(ADD_FIRST));
    await user.type(screen.getByPlaceholderText('Search traits, groups, time of day, and personas'), 'elder');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'RuneLore › … › Deep', 'ElderLore › Runes', 'DeepLore › … › Elder',
    ]);
  });
});

describe('TraitRequiresField rows', () => {
  const paladin: TraitRequirement = { kind: 'trait', id: 'paladin' };
  const brave: TraitRequirement = { kind: 'trait', id: 'brave' };
  const wizard: TraitRequirement = { kind: 'trait', id: 'wizard' };

  it('reads "Add a requirement…" with no rows, and no "and…"', () => {
    render(<Harness trait={smite(undefined)} />);
    expect(button(ADD_FIRST)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ADD_TO_ROW })).toBeNull();
  });

  it('joins Conditions with "and" inside a row and rows with "or" between them', () => {
    render(<Harness trait={smite([{ all: [paladin, brave] }, { all: [wizard] }])} />);
    expect(sentences()).toEqual(['This entity has Paladin and Brave is active and…', 'This entity has Wizard and…']);
    expect(screen.getAllByText('or')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: ADD_TO_ROW })).toHaveLength(2);
    expect(button(ADD_ROW)).toBeInTheDocument();
  });

  it('adds a Condition to its own row with "and…", and a new row with "or…"', async () => {
    render(<Harness trait={smite([{ all: [paladin] }, { all: [wizard] }])} />);
    fireEvent.click(screen.getAllByRole('button', { name: ADD_TO_ROW })[1]);
    fireEvent.click(await screen.findByRole('option', { name: /^Brave/ }));
    expect(sentences()).toEqual(['This entity has Paladin and…', 'This entity has Wizard and Brave is active and…']);

    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /^Brave/ }));
    expect(sentences()).toEqual(['This entity has Paladin and…', 'This entity has Wizard and Brave is active and…', 'Brave is active and…']);
  });

  it('disables a Condition already in the row "and…" adds to, but not one only in another row', async () => {
    render(<Harness trait={smite([{ all: [paladin] }, { all: [wizard] }])} />);
    fireEvent.click(screen.getAllByRole('button', { name: ADD_TO_ROW })[0]);
    expect(await screen.findByRole('option', { name: /^Paladin.*Blueprints/ })).toHaveAttribute('aria-disabled', 'true');
    expect(option(/^Wizard.*Blueprints/)).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('removes a Condition from its row, and the row with its last one', () => {
    render(<Harness trait={smite([{ all: [paladin, brave] }, { all: [wizard] }])} />);
    fireEvent.click(button('Remove this entity has Wizard'));
    expect(sentences()).toEqual(['This entity has Paladin and Brave is active and…']);
    expect(screen.queryByText('or')).toBeNull();

    fireEvent.click(button('Remove Brave is active'));
    expect(sentences()).toEqual(['This entity has Paladin and…']);
  });

  it('removes a whole row with its own control', () => {
    render(<Harness trait={smite([{ all: [paladin, brave] }, { all: [wizard] }])} />);
    fireEvent.click(button('Delete row: this entity has Paladin and Brave is active'));
    expect(sentences()).toEqual(['This entity has Wizard and…']);
  });

  it('removes the last row and goes back to "Add a requirement…"', () => {
    render(<Harness trait={smite([{ all: [paladin] }])} />);
    fireEvent.click(button('Delete row: this entity has Paladin'));
    expect(sentences()).toEqual([]);
    expect(button(ADD_FIRST)).toBeInTheDocument();
  });
});

describe('TraitRequiresField Not flip', () => {
  const paladin: TraitRequirement = { kind: 'trait', id: 'paladin' };
  const brave: TraitRequirement = { kind: 'trait', id: 'brave' };

  it('flips a Condition to Not on its verb, and stores the flag', () => {
    const onRows = vi.fn();
    render(<Harness trait={smite([{ all: [paladin, brave] }])} onRows={onRows} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Change to “doesn\'t have”' })[0]);
    expect(onRows).toHaveBeenLastCalledWith([{ all: [{ ...paladin, not: true }, brave] }]);
    expect(sentences()).toEqual(["This entity doesn't have Paladin and Brave is active and…"]);
    expect(button("Delete row: this entity doesn't have Paladin and Brave is active")).toBeInTheDocument();
  });

  it('flips a Not Condition back to plain', () => {
    const onRows = vi.fn();
    render(<Harness trait={smite([{ all: [{ ...paladin, not: true }] }])} onRows={onRows} />);
    fireEvent.click(button('Change to “has”'));
    expect(onRows).toHaveBeenLastCalledWith([{ all: [paladin] }]);
    expect(sentences()).toEqual(['This entity has Paladin and…']);
  });

  it('keeps the owner on a flipped Condition', () => {
    render(<Harness trait={smite([{ all: [{ ...paladin, owner: { kind: 'you' as const } }] }])} />);
    fireEvent.click(button("Change to “doesn't have”"));
    expect(sentences()).toEqual(["The player doesn't have Paladin and…"]);
    expect(rows()).toEqual([{ all: [{ ...paladin, owner: { kind: 'you' }, not: true }] }]);
  });

  it('disables a flip that would repeat a Condition in its row', () => {
    render(<Harness trait={smite([{ all: [paladin, { ...paladin, not: true }, brave] }])} />);
    const paladinOff = button('Change to “doesn\'t have”');
    const braveOff = button('Change to “is not”');
    expect(paladinOff).toBeDisabled();
    expect(button('Change to “has”')).toBeDisabled();
    expect(braveOff).toBeEnabled();
  });

  it('disables a flip that would turn a one-Condition row into a copy of another', () => {
    render(<Harness trait={smite([{ all: [{ ...paladin, not: true }] }, { all: [paladin] }, { all: [paladin, brave] }])} />);
    expect(button('Change to “has”')).toBeDisabled();
    const toOff = screen.getAllByRole('button', { name: 'Change to “doesn\'t have”' });
    expect(toOff[0]).toBeDisabled();
    expect(toOff[1]).toBeEnabled();
  });

  it('adds a target already present as plain to another row, where it flips to Not', async () => {
    render(<Harness trait={smite([{ all: [paladin] }, { all: [brave] }])} />);
    fireEvent.click(screen.getAllByRole('button', { name: ADD_TO_ROW })[1]);
    fireEvent.click(await screen.findByRole('option', { name: /^Paladin.*Blueprints/ }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Change to “doesn\'t have”' })[1]);
    expect(sentences()).toEqual(['This entity has Paladin and…', "Brave is active and this entity doesn't have Paladin and…"]);
  });

  it('lets a plain row join beside a Not row on the same target', async () => {
    render(<Harness trait={smite([{ all: [{ ...paladin, not: true }] }])} />);
    openPicker();
    expect(await screen.findByRole('option', { name: /^Paladin.*Blueprints/ })).not.toHaveAttribute('aria-disabled', 'true');
  });
});

// Parked with the summary: its call in TraitRequiresField is commented out.
describe.skip('TraitRequiresField summary', () => {
  const extra = { traits: [trait('mage', { name: 'Mage', groupId: null, order: 1 }), trait('rogue', { name: 'Rogue', groupId: null, order: 2 })], traitGroups: [] };
  const on = (id: string): TraitRequirement => ({ kind: 'trait', id });
  const off = (id: string): TraitRequirement => ({ kind: 'trait', id, not: true });
  const smite = (...rows: TraitRequirement[][]) => trait('smite', { name: 'Smite', requires: rows.map((all) => ({ all })) });
  const summary = () => [...document.querySelectorAll('[data-requirement-summary] :is(p, li)')].map((l) => l.textContent);

  it('reads an empty Requirement as always available', () => {
    render(<Harness trait={trait('smite', { name: 'Smite' })} />);
    expect(screen.getByText('Always available')).toBeInTheDocument();
  });

  it('reads one row as Needs and Blocked By, with no option list', () => {
    render(<Harness trait={smite([on('brave'), off('paladin'), off('wizard')])} extra={extra} />);
    expect(summary()).toEqual(['Needs: Brave', 'Blocked By: Paladin and Wizard']);
  });

  it('joins three Needs with a serial comma and three blockers with commas alone', () => {
    render(<Harness trait={smite([on('brave'), on('paladin'), on('wizard'), off('mage'), off('rogue'), off('squire')])} extra={{ ...extra, traits: [...extra.traits, trait('squire', { name: 'Squire', groupId: null, order: 3 })] }} />);
    expect(summary()).toEqual(['Needs: Brave, Paladin, and Wizard', 'Blocked By: Mage, Rogue, Squire']);
  });

  it('factors a Not every row shares into Blocked By, last, under Needs One Of', () => {
    render(<Harness trait={smite([on('brave'), off('paladin')], [on('wizard'), off('paladin')])} extra={extra} />);
    expect(summary()).toEqual(['Needs One Of:', 'Brave', 'Wizard', 'Blocked By: Paladin']);
  });

  it('lists what each row adds under Plus One Of when the rows share a Need', () => {
    render(<Harness trait={smite([on('brave'), on('paladin')], [on('brave'), on('wizard'), off('mage'), off('rogue')], [on('brave'), off('paladin')])} extra={extra} />);
    expect(summary()).toEqual(['Needs: Brave', 'Plus One Of:', 'Paladin', 'Wizard, blocked by Mage and Rogue', 'blocked by Paladin']);
  });

  it('keeps a Not in only some rows inside those rows', () => {
    render(<Harness trait={smite([on('brave'), off('paladin')], [on('wizard'), off('mage')])} extra={extra} />);
    expect(summary()).toEqual(['Needs One Of:', 'Brave, blocked by Paladin', 'Wizard, blocked by Mage']);
  });

  it('drops the options when one row is only the shared part, since that row already holds', () => {
    render(<Harness trait={smite([on('brave')], [on('brave'), on('paladin')])} extra={extra} />);
    expect(summary()).toEqual(['Needs: Brave']);
  });

  it('tells owners apart and names them as the chips do', () => {
    render(<Harness trait={smite(
      [{ kind: 'trait', id: 'paladin', owner: { kind: 'you' } }, off('brave')],
      [on('paladin'), off('brave')],
    )} />);
    expect(summary()).toEqual(['Needs One Of:', 'Persona: Paladin', 'Paladin', 'Blocked By: Brave']);
  });
});
