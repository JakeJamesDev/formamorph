import { describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TraitStoreContext, type TraitStore } from '@/contexts/TraitStoreContext';
import { editorGateInput } from '@/lib/bearers';
import type { LinkRow } from '@/lib/traitTree';
import { LinkedFromLine, LinkedTraitManager, LinkFooter, ThisLinkSection } from './TraitLinkPanel';
import type { TraitPanelTab } from '@/views/traitPanelTabs';
import { ALWAYS_ADVANCED, EditorModeContext } from '@/lib/editorMode';
import { phValues } from '@/test/placeholderValues';
import type { Entity, Trait, TraitGroup, TraitLink, TraitLinkOverrides } from '@/types';

// The chip fields are Lexical editors; what matters here is whether a link leaves them writable.
vi.mock('@/components/prompt/PlaceholderField', () => ({
  default: (props: { label: string; value: string; readOnly?: boolean }) =>
    <input aria-label={props.label} value={props.value} readOnly={props.readOnly} onChange={() => {}} />,
  PlaceholderNameField: (props: { ariaLabel: string; value: string; readOnly?: boolean }) =>
    <input aria-label={props.ariaLabel} value={props.value} readOnly={props.readOnly} onChange={() => {}} />,
}));

const trait = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
const traits = [
  trait('paladin', {
    name: 'Paladin', groupId: 'classes', order: 0, isDefault: true, aiDescription: 'Sworn to a god.',
    placeholderPins: [{ placeholderId: 'garb', value: 'Tabard' }], statToggles: [{ statId: 's', enabled: false }],
  }),
  trait('wizard', { name: 'Wizard', groupId: 'classes', order: 1, statChanges: [{ statId: 's', value: 1, type: 'min' }] }),
  trait('brave', { name: 'Brave', groupId: null, order: 1 }),
];
const traitGroups: TraitGroup[] = [
  { id: 'blueprints', name: 'Blueprints', parentId: null, order: 0, system: 'blueprints' },
  { id: 'classes', name: 'Classes', parentId: 'blueprints', order: 0 },
];
const garb = { id: 'garb', name: 'Class Garb', values: phValues(['Tabard', 'Robe']) };
const link = (id: string, originalId: string, kind: TraitLink['kind'], overrides?: Record<string, TraitLinkOverrides>): TraitLink =>
  ({ id, originalId, kind, originalName: originalId, groupId: null, order: 0, ...(overrides ? { overrides } : {}) });
const row = (entityId: string, l: TraitLink, originalId = l.originalId, root = true): LinkRow => ({ entityId, link: l, originalId, root });

/** A world store over `entities` whose edits land, so a test reads what the author sees next. */
function Harness({ entities, updateTrait = vi.fn(), children }: {
  entities: Entity[];
  updateTrait?: (t: Trait) => void;
  children: (entities: Entity[]) => ReactNode;
}) {
  const [current, setCurrent] = useState(entities);
  const store = {
    traits, traitGroups, entities: current, placeholders: [garb], stats: [{ id: 's', name: 'Strength' }],
    placeholderOwners: new Map(), pinWorld: null, updateTrait,
    gateInput: editorGateInput({ traits, traitGroups, entities: current }),
    editEntity: (id: string, edit: (e: Entity) => Entity) => setCurrent((all) => all.map((e) => (e.id === id ? edit(e) : e))),
  } as unknown as TraitStore;
  // Advanced, so the Pins tab and Stat Availability show.
  return (
    <EditorModeContext.Provider value={ALWAYS_ADVANCED}>
      <TraitStoreContext.Provider value={store}>{children(current)}</TraitStoreContext.Provider>
    </EditorModeContext.Provider>
  );
}

/** Ash's link to Paladin in the panel, open on `tab`; `seen` gets every entity after each render. */
function renderLink(entities: Entity[], { tab = 'availability' as TraitPanelTab, updateTrait = vi.fn() } = {}) {
  const seen: { entities: Entity[] } = { entities };
  render(
    <Harness entities={entities} updateTrait={updateTrait}>
      {(all) => {
        seen.entities = all;
        const ash = all.find((e) => e.id === 'ash')!;
        return (
          <LinkedTraitManager
            bearer={ash} link={ash.traitLinks![0]} original={traits[0]}
            onOpenTrait={vi.fn()} tab={tab} onTabChange={vi.fn()}
          />
        );
      }}
    </Harness>,
  );
  return seen;
}
const ashLinks = (overrides?: Record<string, TraitLinkOverrides>): Entity =>
  ({ id: 'ash', name: 'Ash', traitLinks: [link('l-ash', 'paladin', 'trait', overrides)] });
const mira: Entity = { id: 'mira', name: 'Mira', traitLinks: [link('l-mira', 'paladin', 'trait')] };

describe('LinkedFromLine', () => {
  it('names where the original lives', () => {
    render(<Harness entities={[]}>{() => <LinkedFromLine originalId="paladin" />}</Harness>);
    expect(screen.getByText(/Linked from/).textContent).toBe('Linked from Blueprints › Classes › Paladin');
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('LinkedTraitManager', () => {
  it("writes an edit as this link's override; the original and another bearer's link stay as they were", () => {
    const updateTrait = vi.fn();
    const seen = renderLink([ashLinks(), mira], { updateTrait });
    expect(screen.queryByRole('button', { name: /^Reset/ })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: /Player Can Toggle/ }));

    expect(screen.getByRole('checkbox', { name: /Player Can Toggle/ })).toBeChecked();
    expect(seen.entities[0].traitLinks![0].overrides).toEqual({ paladin: { playerToggle: { value: true, blueprint: false } } });
    expect(seen.entities[1]).toBe(mira);
    expect(updateTrait).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Reset Player Can Toggle In-Game' })).toBeInTheDocument();
  });

  it('resets one field to the blueprint and keeps the other overrides', () => {
    const seen = renderLink([ashLinks({
      paladin: { isDefault: { value: false, blueprint: true }, playerToggle: { value: true, blueprint: false } },
    })]);
    fireEvent.click(screen.getByRole('button', { name: 'Reset Player Can Toggle In-Game' }));

    expect(seen.entities[0].traitLinks![0].overrides).toEqual({ paladin: { isDefault: { value: false, blueprint: true } } });
    expect(screen.getByRole('checkbox', { name: /Player Can Toggle/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Enabled by Default/ })).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'Reset Player Can Toggle In-Game' })).toBeNull();
  });

  it('marks an override "Blueprint changed" only when the blueprint moved since the override was made', () => {
    renderLink([ashLinks({
      paladin: { isDefault: { value: false, blueprint: false }, playerToggle: { value: true, blueprint: false } },
    })]);
    // Paladin is on by default now; the default-on override was made while it was off.
    expect(screen.getAllByText('Blueprint changed')).toHaveLength(1);
    const marker = screen.getByText('Blueprint changed');
    expect(within(marker.parentElement!).getByRole('button', { name: 'Reset Enabled by Default' })).toBeInTheDocument();
  });

  it('keeps the name and both descriptions read-only on a link', () => {
    renderLink([ashLinks()], { tab: 'details' });
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('readonly');
    expect(screen.getByRole('textbox', { name: 'Player-Facing Description' })).toHaveAttribute('readonly');
    expect(screen.getByRole('textbox', { name: 'AI-Facing Description' })).toHaveAttribute('readonly');
  });

  it("overrides the stat changes as a whole list", () => {
    const seen = renderLink([ashLinks()], { tab: 'stats' });
    fireEvent.click(screen.getByRole('button', { name: 'Add Stat Change' }));
    expect(seen.entities[0].traitLinks![0].overrides?.paladin?.statChanges)
      .toEqual({ value: [{ statId: '', value: 0, type: 'min' }], blueprint: [] });
    expect(screen.getByRole('button', { name: 'Reset Stat Changes' })).toBeInTheDocument();
  });

  it('keeps Stat Availability read-only on a link', () => {
    renderLink([ashLinks()], { tab: 'stats' });
    expect(screen.queryByRole('button', { name: 'Add Stat Availability' })).toBeNull();
    const toggleRow = screen.getByText('Stat Availability').closest('.space-y-2')!;
    for (const control of within(toggleRow as HTMLElement).getAllByRole('combobox')) expect(control).toBeDisabled();
  });

  it("overrides the pins as a whole list, with a Reset back to the blueprint's pins", () => {
    const seen = renderLink([ashLinks()], { tab: 'pins' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Pin' }));
    expect(seen.entities[0].traitLinks![0].overrides?.paladin?.placeholderPins)
      .toEqual({ value: [], blueprint: [{ placeholderId: 'garb', value: 'Tabard' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Placeholder Pins' }));
    expect(seen.entities[0].traitLinks![0]).not.toHaveProperty('overrides');
    expect(screen.getByRole('button', { name: 'Remove Pin' })).toBeInTheDocument();
  });
});

describe('LinkFooter', () => {
  const both = { paladin: { isDefault: { value: false, blueprint: true } }, wizard: { isDefault: { value: true, blueprint: false } } };
  const renderFooter = (entity: Entity, pick: (e: Entity) => LinkRow, onEditBlueprint?: () => void) => {
    const seen: { entity: Entity } = { entity };
    render(
      <Harness entities={[entity]}>
        {([e]) => {
          seen.entity = e;
          return <LinkFooter bearer={e} row={pick(e)} onEditBlueprint={onEditBlueprint} />;
        }}
      </Harness>,
    );
    return seen;
  };

  it("drops every override the link holds from the link's own row, and is off once nothing is overridden", () => {
    const onEdit = vi.fn();
    const seen = renderFooter({ id: 'ash', name: 'Ash', traitLinks: [link('l1', 'classes', 'group', both)] }, (e) => row('ash', e.traitLinks![0]), onEdit);
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Blueprint' }));
    expect(seen.entity.traitLinks![0]).not.toHaveProperty('overrides');
    expect(screen.getByRole('button', { name: 'Reset to Blueprint' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Blueprint' }));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("drops only that trait's overrides from a row of a linked group's subtree", () => {
    const seen = renderFooter(
      { id: 'ash', name: 'Ash', traitLinks: [link('l1', 'classes', 'group', both)] }, (e) => row('ash', e.traitLinks![0], 'wizard', false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Blueprint' }));
    expect(seen.entity.traitLinks![0].overrides).toEqual({ paladin: both.paladin });
    expect(screen.getByRole('button', { name: 'Reset to Blueprint' })).toBeDisabled();
  });

  it('has no Edit Blueprint where the host cannot open the original', () => {
    renderFooter(ashLinks(), (e) => row('ash', e.traitLinks![0]));
    expect(screen.queryByRole('button', { name: 'Edit Blueprint' })).toBeNull();
  });
});

describe('ThisLinkSection', () => {
  const renderSection = (entity: Entity, originalId: string) =>
    render(<Harness entities={[entity]}>{([e]) => <ThisLinkSection entity={e} link={e.traitLinks![0]} originalId={originalId} />}</Harness>);

  it('lists each trait of a linked group with its own default, and a Reset on the one the link overrides', () => {
    renderSection({ id: 'ash', name: 'Ash', traitLinks: [link('l1', 'classes', 'group')] }, 'classes');
    const list = screen.getByRole('list', { name: 'Enabled by Default' });
    expect(within(list).getByRole('checkbox', { name: 'Paladin' })).toBeChecked();
    fireEvent.click(within(list).getByRole('checkbox', { name: 'Wizard' }));
    expect(within(list).getByRole('checkbox', { name: 'Wizard' })).toBeChecked();
    expect(within(list).queryByRole('button', { name: 'Reset Paladin Enabled by Default' })).toBeNull();

    fireEvent.click(within(list).getByRole('button', { name: 'Reset Wizard Enabled by Default' }));
    expect(within(list).getByRole('checkbox', { name: 'Wizard' })).not.toBeChecked();
    expect(within(list).queryByRole('button', { name: /^Reset/ })).toBeNull();
  });

  it('notes that stat changes wait for play as a playable entity', () => {
    renderSection({ id: 'ash', name: 'Ash', persona: true, traitLinks: [link('l1', 'classes', 'group')] }, 'classes');
    expect(screen.getByText('Stat changes apply only when you play as them')).toBeInTheDocument();
  });

  it('notes that stat changes never apply to an entity nobody can play as', () => {
    renderSection({ id: 'ash', name: 'Ash', traitLinks: [link('l1', 'classes', 'group')] }, 'classes');
    expect(screen.getByText("Stat changes don't apply to entities")).toBeInTheDocument();
  });

  it("has no stat note on the Custom Persona entity, whose links are the player's", () => {
    renderSection({ id: 'you', name: 'Wanderer', customPersona: true, traitLinks: [link('l1', 'classes', 'group')] }, 'classes');
    expect(screen.queryByText(/Stat changes/)).toBeNull();
    expect(screen.getByText('Selected when a new game starts')).toBeInTheDocument();
  });
});
