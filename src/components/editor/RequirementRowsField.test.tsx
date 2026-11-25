import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ADD_FIRST, ADD_ROW, ADD_TO_ROW, FieldHarness, sentences, writtenRows, type FieldInput } from '@/test/requirementRows';
import type { ClauseHost } from '@/lib/traitGates';
import type { Trait, TraitRequirementRow } from '@/types';

const T = (id: string, name: string, extra: Partial<Trait> = {}): Trait => ({ id, name, statChanges: [], ...extra });

// Paladin and Healer are global; Mira owns Knight, Squire and the Arms group; Albus and Sylvie are personas.
const input: FieldInput = {
  global: { traits: [T('paladin', 'Paladin'), T('healer', 'Healer')], groups: [] },
  owners: [{
    id: 'mira', name: 'Mira',
    traits: [T('knight', 'Knight', { groupId: 'arms' }), T('squire', 'Squire', { groupId: 'arms' })],
    groups: [{ id: 'arms', name: 'Arms', parentId: null }],
  }],
  entities: [{ id: 'mira', name: 'Mira' }, { id: 'albus', name: 'Albus', persona: true }, { id: 'sylvie', name: 'Sylvie', persona: true }],
};
// The Conditions sit on Ash, who holds none of the targets.
const ASH: ClauseHost = { kind: 'entity', id: 'ash', name: 'Ash' };
const knight = { kind: 'trait', id: 'knight' } as const;
const arms = { kind: 'group', id: 'arms' } as const;
const albus = { kind: 'playingAs', id: 'albus' } as const;
const threeKinds: TraitRequirementRow = { all: [knight, arms, albus] };

const field = (initial: TraitRequirementRow[] = [], extra: Partial<Parameters<typeof FieldHarness>[0]> = {}) =>
  render(<FieldHarness input={input} host={ASH} initial={initial} {...extra} />);
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const optionNames = () => screen.getAllByRole('option').map((o) => o.textContent);

describe('the Requires field as sentences', () => {
  it('reads a trait, a group and a persona Condition as the grammar table writes them', () => {
    field([threeKinds]);
    expect(sentences()).toEqual(['Ash has Knight and Ash has a trait in Arms and the player is Albus and…']);
    expect(screen.getAllByRole('button', { name: 'Owner: Ash' })).toHaveLength(2);
    for (const name of ['Target: Knight', 'Target: Arms', 'Target: Albus', "Change to “doesn't have”", 'Change to “has no trait in”', 'Change to “is not”']) {
      expect(button(name)).toBeInTheDocument();
    }
  });

  it('holds each Condition and its own "and" in one box', () => {
    field([threeKinds]);
    const boxes = [...document.querySelectorAll('[data-clause]')];
    expect(boxes.map((b) => b.textContent?.trim())).toEqual(['Ash has Knight and', 'Ash has a trait in Arms and', 'the player is Albus and…']);
    expect(boxes[2].querySelector(`[aria-label="${ADD_TO_ROW}"]`)).not.toBeNull();
  });

  it('flips Not on the verb and back', () => {
    field([{ all: [knight] }]);
    fireEvent.click(button("Change to “doesn't have”"));
    expect(writtenRows()).toEqual([{ all: [{ ...knight, not: true }] }]);
    expect(sentences()).toEqual(["Ash doesn't have Knight and…"]);
    fireEvent.click(button('Change to “has”'));
    expect(writtenRows()).toEqual([{ all: [knight] }]);
  });

  it('writes the owner picked in the owner token, and clears it with no owner', async () => {
    const user = userEvent.setup();
    field([{ all: [knight] }]);
    await user.click(button('Owner: Ash'));
    expect(optionNames()).toEqual(['Ash', 'The player', 'Mira']);
    await user.click(screen.getByRole('option', { name: 'Mira' }));
    expect(writtenRows()).toEqual([{ all: [{ ...knight, owner: { kind: 'entity', id: 'mira', name: 'Mira' } }] }]);
    expect(sentences()).toEqual(['Mira has Knight and…']);
    await user.click(button('Owner: Mira'));
    await user.click(screen.getByRole('option', { name: 'Ash' }));
    expect(writtenRows()).toEqual([{ all: [knight] }]);
  });

  it('reads an owner token as plain text off-world', () => {
    field([{ all: [knight] }], { offWorld: true });
    expect(screen.queryByRole('button', { name: /^Owner:/ })).toBeNull();
    expect(sentences()).toEqual(['Ash has Knight and…']);
  });

  it('swaps the target for one of the same kind, keeping an owner the new target allows', async () => {
    const user = userEvent.setup();
    const mira = { kind: 'entity', id: 'mira', name: 'Mira' } as const;
    field([{ all: [{ ...knight, owner: mira, not: true }] }]);
    await user.click(button('Target: Knight'));
    expect(optionNames()).toEqual(['PaladinWorld', 'HealerWorld', 'KnightMira › Arms', 'SquireMira › Arms']);
    await user.click(screen.getByRole('option', { name: /^Squire/ }));
    expect(writtenRows()).toEqual([{ all: [{ kind: 'trait', id: 'squire', owner: mira, not: true }] }]);
    // Paladin is global, so it names no owner and the Mira owner goes.
    await user.click(button('Target: Squire'));
    await user.click(screen.getByRole('option', { name: /^Paladin/ }));
    expect(writtenRows()).toEqual([{ all: [{ kind: 'trait', id: 'paladin', not: true }] }]);
  });

  it('lists only personas in a persona target, and Open calls the host', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    field([{ all: [albus] }], { onOpen });
    await user.click(button('Target: Albus'));
    expect(optionNames()).toEqual(['AlbusPersona', 'SylviePersona']);
    await user.click(button('Open Albus'));
    expect(onOpen).toHaveBeenCalledWith(albus);
  });

  it('offers no Open where the host has nowhere to open the target', async () => {
    const user = userEvent.setup();
    field([{ all: [albus] }], { opens: () => false });
    await user.click(button('Target: Albus'));
    expect(screen.queryByRole('button', { name: 'Open Albus' })).toBeNull();
  });

  it('adds with "and…" to its row and with "or…" as a row, naming the entity that holds the target, with no owner page', async () => {
    const user = userEvent.setup();
    const mira = { kind: 'entity', id: 'mira', name: 'Mira' } as const;
    field();
    await user.click(button(ADD_FIRST));
    await user.click(screen.getByRole('option', { name: /^Knight/ }));
    expect(writtenRows()).toEqual([{ all: [{ ...knight, owner: mira }] }]);
    expect(sentences()).toEqual(['Mira has Knight and…']);
    await user.click(button(ADD_TO_ROW));
    await user.click(screen.getByRole('option', { name: /^Arms/ }));
    expect(writtenRows()).toEqual([{ all: [{ ...knight, owner: mira }, { ...arms, owner: mira }] }]);
    await user.click(button(ADD_ROW));
    await user.click(screen.getByRole('option', { name: /^Squire/ }));
    expect(screen.queryByRole('button', { name: 'Back to targets' })).toBeNull();
    expect(writtenRows()).toEqual([{ all: [{ ...knight, owner: mira }, { ...arms, owner: mira }] }, { all: [{ kind: 'trait', id: 'squire', owner: mira }] }]);
    expect(screen.getByText('or')).toBeInTheDocument();
  });

  it('adds a global trait with no owner', async () => {
    const user = userEvent.setup();
    field();
    await user.click(button(ADD_FIRST));
    await user.click(screen.getByRole('option', { name: /^Paladin/ }));
    expect(writtenRows()).toEqual([{ all: [{ kind: 'trait', id: 'paladin' }] }]);
  });

  it('removes one Condition with ×, the row with its last one, and a whole row with its delete button', () => {
    field([{ all: [knight, arms] }, { all: [albus] }, { all: [{ kind: 'trait', id: 'paladin' }] }]);
    fireEvent.click(button('Remove Ash has Knight'));
    expect(writtenRows()).toEqual([{ all: [arms] }, { all: [albus] }, { all: [{ kind: 'trait', id: 'paladin' }] }]);
    fireEvent.click(button('Remove the player is Albus'));
    expect(writtenRows()).toEqual([{ all: [arms] }, { all: [{ kind: 'trait', id: 'paladin' }] }]);
    fireEvent.click(button('Delete row: Ash has a trait in Arms'));
    expect(writtenRows()).toEqual([{ all: [{ kind: 'trait', id: 'paladin' }] }]);
    fireEvent.click(button('Remove Paladin is active'));
    expect(writtenRows()).toEqual([]);
    expect(button(ADD_FIRST)).toBeInTheDocument();
  });

  describe('the duplicate guard', () => {
    it('disables a verb flip and a target that would repeat a Condition in the row', async () => {
      const user = userEvent.setup();
      field([{ all: [knight, { ...knight, not: true }, { kind: 'trait', id: 'squire' }] }]);
      // Knight's flip would repeat its Not twin; Squire's flip is free.
      const [knightFlip, squireFlip] = screen.getAllByRole('button', { name: "Change to “doesn't have”" });
      expect(knightFlip).toBeDisabled();
      expect(squireFlip).toBeEnabled();
      await user.click(button('Target: Squire'));
      expect(screen.getByRole('option', { name: /^Knight/ })).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('option', { name: /^Paladin/ })).not.toHaveAttribute('aria-disabled', 'true');
    });

    it('disables an owner that would turn a one-Condition row into a copy of another row', async () => {
      const user = userEvent.setup();
      const mira = { kind: 'entity', id: 'mira', name: 'Mira' } as const;
      field([{ all: [{ ...knight, owner: mira }] }, { all: [knight] }]);
      await user.click(button('Owner: Ash'));
      expect(screen.getByRole('option', { name: 'Mira' })).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('option', { name: 'The player' })).not.toHaveAttribute('aria-disabled', 'true');
    });

    it('disables a picker row already in the row', async () => {
      const user = userEvent.setup();
      field([{ all: [{ ...knight, owner: { kind: 'entity' as const, id: 'mira', name: 'Mira' } }] }]);
      await user.click(button(ADD_TO_ROW));
      expect(screen.getByRole('option', { name: /^Knight/ })).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('a Condition with no subject (Q25)', () => {
    it('takes its owner from the target popover and then reads its subject', async () => {
      const user = userEvent.setup();
      const options = { traits: [{ requirement: knight, label: 'Knight', breadcrumb: ['World'], owners: [{ owner: { kind: 'you' as const }, name: 'Persona' }] }], groups: [], personas: [] };
      // On the world, a global trait with no owner names no one.
      const world: FieldInput = { ...input, global: { traits: [T('knight', 'Knight')], groups: [] }, owners: [] };
      render(<FieldHarness input={world} options={options} host={{ kind: 'world' }} initial={[{ all: [knight] }]} />);
      expect(sentences()).toEqual(['Knight is active and…']);
      expect(screen.queryByRole('button', { name: /^Owner:/ })).toBeNull();
      await user.click(button('Target: Knight'));
      await user.click(button('The player'));
      expect(writtenRows()).toEqual([{ all: [{ ...knight, owner: { kind: 'you' } }] }]);
      expect(sentences()).toEqual(['The player has Knight and…']);
    });
  });

  it('marks a missing owner red with a warning, as a token and as plain text off-world', () => {
    const gone = { ...knight, owner: { kind: 'entity' as const, id: 'gone', name: 'Old Hand' } };
    const { unmount } = field([{ all: [gone] }]);
    const token = button('Owner: Old Hand');
    expect(token).toHaveAttribute('data-broken');
    expect(token).toHaveAccessibleDescription('This owner no longer exists.');
    expect(token.querySelector('svg')).not.toBeNull();
    unmount();
    field([{ all: [gone] }], { offWorld: true });
    const plain = screen.getByLabelText('Old Hand: This owner no longer exists.');
    expect(plain).toHaveAttribute('data-broken');
    expect(plain.querySelector('svg')).not.toBeNull();
  });

  it('marks a missing target red, with the reason in its name', () => {
    field([{ all: [{ kind: 'trait', id: 'gone', name: 'Old' }] }]);
    const target = button('Target: Old');
    expect(target).toHaveAttribute('data-broken');
    expect(target).toHaveAccessibleDescription('This trait no longer exists.');
  });
});
