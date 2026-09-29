import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { renderRightPanel, statFixture, type PanelHarnessOptions } from '@/test/gamePanels';
import type { Trait, TraitGroup } from '@/types';

import { phValues } from '@/test/placeholderValues';
// Same reason the panel harness gives: neither dependency runs in jsdom, and neither is what these cases
// are about. RightPanel pulls them in through the shared module.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const TURNS = [{ action: 'walk the dock', narration: 'The dock creaks.', turnId: 't1', choices: ['Keep walking'] }];
const STATS = [statFixture('Vigor', 50), statFixture('Luck', 50, { hidden: true })];

const T = (id: string, name: string, extra: Partial<Trait> = {}): Trait => ({
  id, name, statChanges: [], playerToggle: true, ...extra,
});
const G = (id: string, name: string, extra: Partial<TraitGroup> = {}): TraitGroup => ({
  id, name, parentId: null, ...extra,
});

/** Mount the right panel on the Traits tab, holding `held` of the world's traits. */
const renderTraits = (
  traits: Trait[],
  traitGroups: TraitGroup[],
  held: string[],
  options: PanelHarnessOptions = {},
) =>
  renderRightPanel({}, {
    turns: TURNS,
    stats: STATS,
    ...options,
    world: { traits, traitGroups, ...options.world },
    seed: (gameplay) => {
      gameplay.setPlayerTraits(traits.filter((t) => held.includes(t.id)));
      gameplay.setActiveTab('traits');
      options.seed?.(gameplay);
    },
  });

/** The traits with a control on screen right now, in render order. */
const shown = () =>
  screen.queryAllByRole('checkbox').concat(screen.queryAllByRole('radio'))
    .map((el) => el.getAttribute('aria-label') ?? '');
const section = (name: string) => screen.getByRole('group', { name });
const openDisabled = (name: string) =>
  fireEvent.click(within(section(name)).getByRole('button', { name: /^Disabled/ }));

describe('the traits tab groups traits the way the world was authored', () => {
  const GROUPS = [G('g-body', 'Physical'), G('g-mind', 'Mental')];
  const TRAITS = [
    T('t-loose', 'Wanderer'),
    T('t-strong', 'Strong Back', { groupId: 'g-body' }),
    T('t-fleet', 'Fleet Footed', { groupId: 'g-body' }),
    T('t-quick', 'Quick Study', { groupId: 'g-mind' }),
  ];

  it('gives every populated group its own section, ungrouped traits landing under General', () => {
    renderTraits(TRAITS, GROUPS, ['t-strong']);
    expect(screen.getAllByRole('group').map((el) => el.getAttribute('aria-label')))
      .toEqual(['General', 'Physical', 'Mental']);
  });

  it('drops the section chrome entirely for a world with no groups', () => {
    renderTraits([T('t-loose', 'Wanderer')], [], ['t-loose']);
    expect(screen.getAllByRole('group').map((el) => el.getAttribute('aria-label'))).toEqual(['Traits']);
    expect(screen.queryByRole('button', { name: /enabled/ })).toBeNull();
  });

  it('counts a section by its enabled traits, and opens only the sections that have some', () => {
    renderTraits(TRAITS, GROUPS, ['t-strong']);

    const body = screen.getByRole('button', { name: 'Physical, 1 enabled' });
    const mind = screen.getByRole('button', { name: 'Mental, 0 enabled' });
    expect(body).toHaveAttribute('aria-expanded', 'true');
    // Nothing enabled in Mental, so it starts out of the way rather than competing for the eye.
    expect(mind).toHaveAttribute('aria-expanded', 'false');
    expect(within(section('Mental')).queryByText('Quick Study')).toBeNull();

    fireEvent.click(mind);
    expect(within(section('Mental')).getByRole('button', { name: /^Disabled/ })).toBeInTheDocument();
  });

  it('shows enabled traits first and folds the rest into a collapsed Disabled block', () => {
    renderTraits(TRAITS, GROUPS, ['t-fleet']);

    expect(shown()).toEqual(['Switch off Fleet Footed']);
    expect(within(section('Physical')).getByRole('button', { name: 'Disabled (1)' }))
      .toHaveAttribute('aria-expanded', 'false');

    openDisabled('Physical');
    expect(shown()).toEqual(['Switch off Fleet Footed', 'Switch on Strong Back']);
  });

  it('keeps authored order inside the Disabled block, so acquirables stay where the author put them', () => {
    renderTraits(TRAITS, GROUPS, []);
    fireEvent.click(screen.getByRole('button', { name: 'Physical, 0 enabled' }));
    openDisabled('Physical');
    expect(within(section('Physical')).getAllByRole('checkbox').map((el) => el.getAttribute('aria-label')))
      .toEqual(['Switch on Strong Back', 'Switch on Fleet Footed']);
  });

  it('renders a nested subgroup as a subheader inside its top-level section', () => {
    const groups = [G('g-mut', 'Mutations'), G('g-major', 'Major', { parentId: 'g-mut' }),
      G('g-deep', 'Latent', { parentId: 'g-major' })];
    const traits = [T('t-heart', 'Second Heart', { groupId: 'g-major' }), T('t-seed', 'Seed', { groupId: 'g-deep' })];
    renderTraits(traits, groups, ['t-heart', 't-seed']);

    const panel = section('Mutations');
    expect(within(panel).getByText('Major')).toBeInTheDocument();
    expect(within(panel).getByText('Major › Latent')).toBeInTheDocument();
    // One section, not an accordion inside an accordion.
    expect(screen.getAllByRole('group')).toHaveLength(1);
  });
});

describe('the traits tab summarizes what is active', () => {
  const TRAITS = [T('t-a', 'Keen Eyes'), T('t-b', 'Strong Back'), T('t-c', 'Bad Knee')];

  it('names every active trait on one line', async () => {
    renderTraits(TRAITS, [], ['t-a', 't-b']);
    // The line truncates, so the full list lives on the hover tip as well as in the text.
    const line = screen.getByText(/2 active:/).closest('p')!;
    expect(line).toHaveTextContent('2 active: Keen Eyes, Strong Back');
    await userEvent.hover(line);
    expect(await screen.findByText('Keen Eyes, Strong Back', { selector: 'div' })).toBeVisible();
  });

  it('says nothing at all when no trait is active', () => {
    renderTraits(TRAITS, [], []);
    expect(screen.queryByText(/active:/)).toBeNull();
  });

  it('drops a trait from the line the moment it is switched off', () => {
    const view = renderTraits(TRAITS, [], ['t-a', 't-b']);
    act(() => { view.gameplay().setDisabledTraitIds(['t-a']); });
    expect(screen.getByText(/1 active:/).closest('p')).toHaveTextContent('1 active: Strong Back');
  });
});

describe('the traits tab filter', () => {
  const GROUPS = [G('g-body', 'Physical'), G('g-mind', 'Mental')];
  const TRAITS = [
    T('t-strong', 'Strong Back', { groupId: 'g-body' }),
    T('t-fleet', 'Fleet Footed', { groupId: 'g-body', playerDescription: 'Quick over any terrain.' }),
    T('t-quick', 'Quick Study', { groupId: 'g-mind' }),
  ];
  const filter = (text: string) =>
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter traits' }), { target: { value: text } });

  it('hides the traits and whole sections that do not match', () => {
    renderTraits(TRAITS, GROUPS, ['t-strong', 't-quick']);
    filter('strong');
    expect(shown()).toEqual(['Switch off Strong Back']);
    expect(screen.queryByRole('group', { name: 'Mental' })).toBeNull();
  });

  it('opens a collapsed section holding a match, so a result is never hidden behind a header', () => {
    renderTraits(TRAITS, GROUPS, ['t-strong']);
    expect(screen.getByRole('button', { name: 'Mental, 0 enabled' })).toHaveAttribute('aria-expanded', 'false');

    filter('quick study');
    expect(shown()).toEqual(['Switch on Quick Study']);
  });

  it('opens the Disabled block holding a match', () => {
    renderTraits(TRAITS, GROUPS, ['t-strong']);
    filter('fleet');
    expect(shown()).toEqual(['Switch on Fleet Footed']);
  });

  it('finds a trait by its player description, not only its name', () => {
    renderTraits(TRAITS, GROUPS, ['t-fleet']);
    filter('terrain');
    expect(shown()).toEqual(['Switch off Fleet Footed']);
  });

  it('counts only the matches in a section badge while the filter is on', () => {
    renderTraits(TRAITS, GROUPS, ['t-strong', 't-fleet']);
    expect(screen.getByRole('button', { name: 'Physical, 2 enabled' })).toBeInTheDocument();
    filter('strong');
    expect(screen.getByRole('button', { name: 'Physical, 1 enabled' })).toBeInTheDocument();
  });

  it('holds the collapse controls while a filter is on, rather than flipping a state nothing shows', () => {
    renderTraits(TRAITS, GROUPS, ['t-strong']);
    filter('fleet');
    const header = screen.getByRole('button', { name: /^Physical/ });
    fireEvent.click(header);
    // Still open, and clearing the filter must not spring a collapse the player never saw take effect.
    expect(shown()).toEqual(['Switch on Fleet Footed']);
    filter('');
    expect(header).toHaveAttribute('aria-expanded', 'true');
  });

  it('says so when nothing matches at all', () => {
    renderTraits(TRAITS, GROUPS, ['t-strong']);
    filter('gribbly');
    expect(shown()).toEqual([]);
    expect(screen.getByText(/No traits match/)).toBeInTheDocument();
  });
});

describe('the traits tab keeps how the player left it', () => {
  const GROUPS = [G('g-body', 'Physical'), G('g-mind', 'Mental')];
  const TRAITS = [
    T('t-strong', 'Strong Back', { groupId: 'g-body', statChanges: [{ statId: 'vigor', value: 10, type: 'starting' }] }),
    T('t-fleet', 'Fleet Footed', { groupId: 'g-body' }),
    T('t-quick', 'Quick Study', { groupId: 'g-mind' }),
  ];
  /** Leave the tab, then come back — the panel is unmounted in between, as Radix does it. */
  const leaveAndReturn = (view: ReturnType<typeof renderTraits>) => {
    act(() => { view.gameplay().setActiveTab('stats'); });
    expect(screen.queryByRole('textbox', { name: 'Filter traits' })).toBeNull();
    act(() => { view.gameplay().setActiveTab('traits'); });
  };

  it('still holds the filter text after a look at another tab', () => {
    const view = renderTraits(TRAITS, GROUPS, ['t-strong']);
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter traits' }), { target: { value: 'quick' } });
    leaveAndReturn(view);

    expect(screen.getByRole('textbox', { name: 'Filter traits' })).toHaveValue('quick');
    expect(shown()).toEqual(['Switch on Quick Study']);
  });

  it('keeps the sections and Disabled blocks the player folded open or shut', () => {
    const view = renderTraits(TRAITS, GROUPS, ['t-strong']);
    fireEvent.click(screen.getByRole('button', { name: /^Physical/ }));      // shut a section that opened
    fireEvent.click(screen.getByRole('button', { name: 'Mental, 0 enabled' })); // open one that started shut
    openDisabled('Mental');
    leaveAndReturn(view);

    expect(screen.getByRole('button', { name: /^Physical/ })).toHaveAttribute('aria-expanded', 'false');
    expect(shown()).toEqual(['Switch on Quick Study']);
  });

  it('keeps both folds when two land in the same batch', () => {
    renderTraits(TRAITS, GROUPS, ['t-strong']);
    // React batches within one act, so a flip reading this render's copy would lose the earlier one.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Physical/ }));
      fireEvent.click(screen.getByRole('button', { name: /^Mental/ }));
    });
    expect(screen.getByRole('button', { name: /^Physical/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /^Mental/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps a revealed stat-change list open', () => {
    const view = renderTraits(TRAITS, GROUPS, ['t-strong']);
    fireEvent.click(screen.getByRole('button', { name: /Strong Back/ }));
    expect(screen.getByText(/Vigor/)).toHaveTextContent('Vigor: +10');

    leaveAndReturn(view);
    expect(screen.getByText(/Vigor/)).toHaveTextContent('Vigor: +10');
  });

  it('re-seeds the folds when the trait list itself changes, rather than carrying another turn\'s', () => {
    const held = [T('t-strong', 'Strong Back', { groupId: 'g-body' })];
    const view = renderRightPanel({}, {
      turns: [
        { action: 'walk', narration: 'The dock creaks.', turnId: 't1', traits: held },
        { action: 'walk on', narration: 'The dock holds.', turnId: 't2', traits: held },
      ],
      stats: STATS,
      world: { traits: TRAITS, traitGroups: GROUPS },
      seed: (gameplay) => {
        gameplay.setPlayerTraits(held);
        gameplay.setActiveTab('traits');
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Physical/ }));
    expect(screen.getByRole('button', { name: /^Physical/ })).toHaveAttribute('aria-expanded', 'false');

    // Paging back drops the acquirable traits, so Mental disappears and the section list is a different one.
    act(() => {
      const gameplay = view.gameplay();
      gameplay.setUserPage(1);
      gameplay.setDisplayedMessages(gameplay.fullMessageHistory.slice(0, 2));
    });
    expect(screen.getByRole('button', { name: /^Physical/ })).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('a gated trait in play', () => {
  const TRAITS = [
    T('t-paladin', 'Paladin'),
    T('t-plate', 'Plate Armor', { requires: [{ kind: 'trait', id: 't-paladin' }] }),
    T('t-crown', 'Royal Crown', { requires: [{ kind: 'playingAs', id: 'e-aldric' }] }),
  ];
  const aldric = { id: 'e-aldric', name: 'Sir Aldric', persona: true };

  it('stays in place, locked, saying what it requires', () => {
    renderTraits(TRAITS, [], []);
    openDisabled('Traits');
    expect(screen.getByRole('checkbox', { name: 'Switch on Plate Armor' })).toBeDisabled();
    expect(screen.getByText('Requires Paladin')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Switch on Paladin' })).toBeEnabled();
  });

  it('opens once its requirement is held, saying what unlocked it', () => {
    renderTraits(TRAITS, [], ['t-paladin']);
    openDisabled('Traits');
    expect(screen.getByRole('checkbox', { name: 'Switch on Plate Armor' })).toBeEnabled();
    expect(screen.getByText('Unlocked by Paladin')).toBeTruthy();
  });

  it('opens a playing-as trait while the player plays that world persona', () => {
    renderTraits(TRAITS, [], [], {
      world: { entities: [aldric] },
      seed: (gameplay) => gameplay.setPersonaRef({ source: 'world', entityId: 'e-aldric' }),
    });
    openDisabled('Traits');
    expect(screen.getByRole('checkbox', { name: 'Switch on Royal Crown' })).toBeEnabled();
    expect(screen.getByText('Unlocked by playing as Sir Aldric')).toBeTruthy();
  });

  it('shows the cascade banner until the player dismisses it', async () => {
    const onDismissTraitCascade = vi.fn();
    renderRightPanel({ traitCascade: { off: ['Plate Armor'], because: 'Paladin' }, onDismissTraitCascade }, {
      turns: TURNS, stats: STATS, world: { traits: TRAITS, traitGroups: [] },
      seed: (gameplay) => gameplay.setActiveTab('traits'),
    });
    expect(screen.getByRole('status').textContent).toBe('Turned off Plate Armor, because of Paladin.Dismiss');
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismissTraitCascade).toHaveBeenCalledOnce();
  });
});

describe('entity nodes in the traits tab', () => {
  // Ash owns Tamed (held), Wild (toggleable, not held), Gruff (not toggleable, not held), and Loyal, which
  // needs the player's Paladin.
  const ash = {
    id: 'e-ash', name: 'Ash', persona: true,
    traits: [
      T('t-tamed', 'Tamed'), T('t-wild', 'Wild'), T('t-gruff', 'Gruff', { playerToggle: false }),
      T('t-loyal', 'Loyal', { requires: [{ kind: 'trait' as const, id: 't-paladin' }] }),
    ],
  };
  const PALADIN = T('t-paladin', 'Paladin');
  const withAsh = (options: PanelHarnessOptions = {}) => renderTraits([PALADIN], [], [], {
    ...options,
    world: { entities: [ash] },
    seed: (gameplay) => {
      gameplay.setOwnedTraits({ 'e-ash': { chosen: ['t-tamed'] } });
      options.seed?.(gameplay);
    },
  });

  it('gives an entity that owns traits its own section, listing what it holds and what the player can switch', () => {
    withAsh();
    const ashSection = section('Ash');
    expect(within(ashSection).getByRole('checkbox', { name: 'Switch off Tamed' })).toBeEnabled();
    fireEvent.click(within(ashSection).getByRole('button', { name: /^Disabled/ }));
    expect(within(ashSection).getByRole('checkbox', { name: 'Switch on Wild' })).toBeEnabled();
    expect(within(ashSection).queryByText('Gruff')).toBeNull();
  });

  it('hands an owned trait’s switch to the runtime by id and bearer', () => {
    const view = withAsh();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Switch off Tamed' }));
    expect(view.props.onToggleTrait).toHaveBeenCalledWith('t-tamed', false, 'e-ash');
  });

  it('locks an owned trait whose requirement the player lacks', () => {
    withAsh();
    fireEvent.click(within(section('Ash')).getByRole('button', { name: /^Disabled/ }));
    expect(screen.getByRole('checkbox', { name: 'Switch on Loyal' })).toBeDisabled();
    expect(screen.getByText('Requires Paladin')).toBeTruthy();
  });

  it('marks the entity the player plays as You', () => {
    withAsh({ seed: (gameplay) => gameplay.setPersonaRef({ source: 'world', entityId: 'e-ash' }) });
    expect(screen.getByRole('button', { name: 'Ash, You, 1 enabled' })).toBeTruthy();
  });

  it("reads an owned trait's Character Name as its owner", () => {
    renderTraits([PALADIN], [], [], {
      world: { entities: [{ ...ash, traits: [T('t-tamed', 'Tamed', { playerDescription: '{{char}} heels at a word.' })] }] },
      seed: (gameplay) => gameplay.setOwnedTraits({ 'e-ash': { chosen: ['t-tamed'] } }),
    });
    expect(within(section('Ash')).getByText('Ash heels at a word.')).toBeTruthy();
  });
});

describe('linked traits in the traits tab', () => {
  // Blueprints › Classes holds Paladin and Wizard. Ash links Classes, Bo links Paladin, and the Custom Persona
  // entity links Wizard for a player with no persona.
  const GROUPS = [
    G('g-blueprints', 'Blueprints', { system: 'blueprints', order: 0 }),
    G('g-classes', 'Classes', { parentId: 'g-blueprints', maxPicks: 1 }),
  ];
  const PALADIN = T('t-paladin', 'Paladin', { groupId: 'g-classes', order: 0, isDefault: true });
  const WIZARD = T('t-wizard', 'Wizard', { groupId: 'g-classes', order: 1, playerDescription: '{{char}} studies.' });
  const link = (id: string, originalId: string, kind: 'trait' | 'group') =>
    ({ id, originalId, kind, originalName: originalId, groupId: null, order: 0 });
  const ash = { id: 'e-ash', name: 'Ash', persona: true, traitLinks: [link('l-ash', 'g-classes', 'group')] };
  const bo = { id: 'e-bo', name: 'Bo', traitLinks: [link('l-bo', 't-paladin', 'trait')] };
  const you = { id: 'e-you', name: 'Wanderer', customPersona: true, traitLinks: [link('l-you', 't-wizard', 'trait')] };
  const withLinks = (options: PanelHarnessOptions = {}) => renderTraits([PALADIN, WIZARD], GROUPS, [], {
    ...options,
    world: { entities: [ash, bo, you], ...options.world },
    seed: (gameplay) => {
      gameplay.setOwnedTraits({ 'e-ash': { chosen: ['t-paladin'] } });
      options.seed?.(gameplay);
    },
  });

  // A section with nothing switched on starts folded, so its rows need the header and the Disabled fold opened.
  const unfold = (name: string) => {
    fireEvent.click(within(section(name)).getByRole('button', { name: new RegExp(`^${name},`) }));
    openDisabled(name);
  };

  it('lists a linked original once per bearer, under each bearer’s node, and never at the top level', () => {
    withLinks();
    expect(within(section('Ash')).getByRole('radio', { name: 'Switch off Paladin' })).toBeEnabled();
    unfold('Bo');
    expect(within(section('Bo')).getByRole('checkbox', { name: 'Switch on Paladin' })).toBeEnabled();
    expect(screen.getAllByText('Paladin')).toHaveLength(2);
    expect(screen.queryByRole('group', { name: 'Blueprints' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Classes' })).toBeNull();
  });

  it('hands a linked trait’s switch to the runtime with the bearer whose row it is', () => {
    const view = withLinks();
    fireEvent.click(within(section('Ash')).getByRole('radio', { name: 'Switch off Paladin' }));
    expect(view.props.onToggleTrait).toHaveBeenCalledWith('t-paladin', false, 'e-ash');
  });

  it("lists the Custom Persona entity's links under its own node as the player under None, marked You", () => {
    withLinks();
    expect(screen.queryByRole('group', { name: 'General' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Wanderer, You, 0 enabled' })).toBeTruthy();
    unfold('Wanderer');
    expect(within(section('Wanderer')).getByRole('checkbox', { name: 'Switch on Wizard' })).toBeEnabled();
    // The Character Name chip resolves to the marked entity, never to another bearer.
    expect(within(section('Wanderer')).getByText(/studies\.$/).textContent).toBe('Wanderer studies.');
    expect(screen.getByText("Ash's Paladin")).toBeTruthy();
  });

  it("names the Custom Persona entity's node and its Character Name after the player's entered name", () => {
    withLinks({ seed: (gameplay) => {
      gameplay.setPersonaRef({ source: 'none', name: 'Ash Vale' });
      gameplay.setOwnedTraits({ 'e-ash': { chosen: ['t-paladin'] }, 'e-you': { chosen: ['t-wizard'] } });
    } });
    expect(screen.queryByRole('group', { name: 'Wanderer' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ash Vale, You, 1 enabled' })).toBeTruthy();
    expect(within(section('Ash Vale')).getByText(/studies\.$/).textContent).toBe('Ash Vale studies.');
    // The player's own trait reads bare in the active list; a cast entity's carries its name.
    expect(screen.getByText(/2 active:/).parentElement).toHaveTextContent("Ash's Paladin");
    expect(screen.getByText(/2 active:/).parentElement).not.toHaveTextContent("Ash Vale's Wizard");
  });

  it('drops the Custom Persona entity under a world persona, and marks that persona You on its node of links', () => {
    withLinks({ seed: (gameplay) => gameplay.setPersonaRef({ source: 'world', entityId: 'e-ash' }) });
    expect(screen.queryByRole('group', { name: 'General' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Wanderer' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ash, You, 1 enabled' })).toBeTruthy();
    expect(screen.getByText(/1 active:/).parentElement).toHaveTextContent('Paladin');
    expect(screen.queryByText("Ash's Paladin")).toBeNull();
    // Ash's section stands where the marked entity's stood: after Bo's, once.
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Bo', 'Ash']);
  });

  it("reads a linked trait's Character Name as its bearer", () => {
    withLinks({ seed: (gameplay) => gameplay.setOwnedTraits({ 'e-ash': { chosen: ['t-wizard'] } }) });
    expect(within(section('Ash')).getByText('Ash studies.')).toBeTruthy();
  });
});

describe('a full group with a max above one', () => {
  const GROUPS = [G('g-skill', 'Skills', { maxPicks: 2 })];
  const TRAITS = [
    T('t-bow', 'Archery', { groupId: 'g-skill' }),
    T('t-hide', 'Stealth', { groupId: 'g-skill' }),
    T('t-lore', 'Lore', { groupId: 'g-skill' }),
  ];

  it('disables its switched-off rows and keeps the switched-on ones switchable', () => {
    renderTraits(TRAITS, GROUPS, ['t-bow', 't-hide']);
    expect(screen.getByRole('checkbox', { name: 'Switch off Archery' })).toBeEnabled();
    openDisabled('Skills');
    expect(screen.getByRole('checkbox', { name: 'Switch on Lore' })).toBeDisabled();
  });

  it('keeps every row open below the max', () => {
    renderTraits(TRAITS, GROUPS, ['t-bow']);
    openDisabled('Skills');
    expect(screen.getByRole('checkbox', { name: 'Switch on Lore' })).toBeEnabled();
  });
});

describe('a group at its minimum', () => {
  const GROUPS = [G('g-skill', 'Skills', { minPicks: 2 }), G('g-class', 'Class', { minPicks: 1, maxPicks: 1 })];
  const TRAITS = [
    T('t-bow', 'Archery', { groupId: 'g-skill' }),
    T('t-hide', 'Stealth', { groupId: 'g-skill' }),
    T('t-lore', 'Lore', { groupId: 'g-skill' }),
    T('t-pal', 'Paladin', { groupId: 'g-class' }),
    T('t-rog', 'Rogue', { groupId: 'g-class' }),
  ];

  it('disables the switch-off of a pick the minimum needs, and keeps switch-ons open', () => {
    renderTraits(TRAITS, GROUPS, ['t-bow', 't-hide', 't-pal']);
    expect(screen.getByRole('checkbox', { name: 'Switch off Archery' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Switch off Paladin' })).toBeDisabled();
    openDisabled('Skills');
    expect(screen.getByRole('checkbox', { name: 'Switch on Lore' })).toBeEnabled();
    openDisabled('Class');
    expect(screen.getByRole('radio', { name: 'Switch on Rogue' })).toBeEnabled();
  });

  it('keeps the switch-off open above the minimum', () => {
    renderTraits(TRAITS, GROUPS, ['t-bow', 't-hide', 't-lore']);
    expect(screen.getByRole('checkbox', { name: 'Switch off Archery' })).toBeEnabled();
  });
});

describe('an Always On trait', () => {
  const GROUPS = [G('g-oath', 'Oath', { maxPicks: 1 })];
  const TRAITS = [
    T('t-ring', 'Cursed Ring'),
    T('t-curse', 'Curse', { mode: 'alwaysOn', requires: [{ kind: 'trait', id: 't-ring' }] }),
    T('t-sworn', 'Sworn', { mode: 'alwaysOn', groupId: 'g-oath' }),
    T('t-free', 'Free', { groupId: 'g-oath' }),
  ];

  it('does not show while dormant and never taken', () => {
    renderTraits(TRAITS, GROUPS, ['t-sworn']);
    fireEvent.click(screen.getByRole('button', { name: 'General, 0 enabled' }));
    openDisabled('General');
    expect(within(section('General')).getByText('Cursed Ring')).toBeInTheDocument();
    expect(screen.queryByText('Curse')).toBeNull();
  });

  it('does not show once lifted, though the player still holds it', () => {
    renderTraits(TRAITS, GROUPS, ['t-sworn', 't-curse'], {
      seed: (gameplay) => gameplay.setDisabledTraitIds(['t-curse']),
    });
    fireEvent.click(screen.getByRole('button', { name: 'General, 0 enabled' }));
    openDisabled('General');
    expect(within(section('General')).getByText('Cursed Ring')).toBeInTheDocument();
    expect(screen.queryByText('Curse')).toBeNull();
  });

  it('shows checked with no control while active, and blocks the max-one group’s other picks', () => {
    renderTraits(TRAITS, GROUPS, ['t-ring', 't-curse', 't-sworn']);
    expect(screen.getByText('Curse')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Curse$/ })).toBeNull();
    expect(screen.queryByRole('radio', { name: /Sworn$/ })).toBeNull();
    openDisabled('Oath');
    expect(screen.getByRole('radio', { name: 'Switch on Free' })).toBeDisabled();
  });
});

describe('a Hidden trait', () => {
  const GROUPS = [G('g-oath', 'Oath', { maxPicks: 1 }), G('g-secret', 'Secrets')];
  const TRAITS = [
    T('t-paladin', 'Paladin'),
    T('t-bond', 'Blood Bond', { mode: 'hidden', groupId: 'g-oath' }),
    T('t-free', 'Free', { groupId: 'g-oath' }),
    T('t-omen', 'Omen', { mode: 'hidden', groupId: 'g-secret' }),
    T('t-rite', 'Rite', { requires: [{ kind: 'trait', id: 't-lost' }, { kind: 'trait', id: 't-paladin' }] }),
    T('t-lost', 'Lost Name', { mode: 'hidden', requires: [{ kind: 'trait', id: 't-paladin' }] }),
    T('t-veil', 'Veil', { requires: [{ kind: 'trait', id: 't-lost' }] }),
  ];

  it('never shows while active, in its row, its section or the active summary', () => {
    renderTraits(TRAITS, GROUPS, ['t-bond', 't-omen']);
    expect(screen.queryByText(/Blood Bond|Omen/)).toBeNull();
    expect(screen.queryByRole('group', { name: 'Secrets' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Oath, 0 enabled' }));
    openDisabled('Oath');
    expect(screen.getByRole('radio', { name: 'Switch on Free' })).toBeDisabled();
  });

  it('leaves its name out of a gate line, and reads "Locked" when nothing else is listed', () => {
    renderTraits(TRAITS, GROUPS, ['t-bond', 't-omen']);
    fireEvent.click(screen.getByRole('button', { name: 'General, 0 enabled' }));
    openDisabled('General');
    expect(screen.getByText('Requires Paladin')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.queryByText(/Lost Name/)).toBeNull();
  });

  it('opens a trait with no line when only a Hidden requirement holds', () => {
    renderTraits(TRAITS, GROUPS, ['t-paladin', 't-lost', 't-bond', 't-omen']);
    openDisabled('General');
    expect(screen.getByRole('checkbox', { name: 'Switch on Veil' })).toBeEnabled();
    expect(screen.getByText('Unlocked by Paladin')).toBeInTheDocument();
    expect(screen.queryByText(/Lost Name/)).toBeNull();
  });
});

describe('a max-one trait group reads as a set of alternatives', () => {
  const GROUPS = [G('g-past', 'Background', { maxPicks: 1 })];
  const TRAITS = [
    T('t-farm', 'Farmhand', { groupId: 'g-past' }),
    T('t-book', 'Scholar', { groupId: 'g-past' }),
  ];

  it('gives a max-one group radios and a plain group checkboxes', () => {
    renderTraits([...TRAITS, T('t-loose', 'Wanderer')], GROUPS, ['t-farm', 't-loose']);
    expect(screen.getByRole('radio', { name: 'Switch off Farmhand' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Switch off Wanderer' })).toBeInTheDocument();
  });

  it('switches the chosen alternative on, leaving the runtime to retire its sibling', () => {
    const view = renderTraits(TRAITS, GROUPS, ['t-farm']);
    openDisabled('Background');
    fireEvent.click(screen.getByRole('radio', { name: 'Switch on Scholar' }));
    expect(view.props.onToggleTrait).toHaveBeenCalledWith('t-book', true, 'world');
  });

  it('clears the selected alternative when it is clicked again, so none is a legal answer', () => {
    const view = renderTraits(TRAITS, GROUPS, ['t-farm']);
    fireEvent.click(screen.getByRole('radio', { name: 'Switch off Farmhand' }));
    expect(view.props.onToggleTrait).toHaveBeenCalledWith('t-farm', false, 'world');
  });

  it('marks the radios by what is actually held', () => {
    renderTraits(TRAITS, GROUPS, ['t-farm']);
    expect(screen.getByRole('radio', { name: 'Switch off Farmhand' })).toHaveAttribute('aria-checked', 'true');
    openDisabled('Background');
    expect(screen.getByRole('radio', { name: 'Switch on Scholar' })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('a trait row reveals what it does', () => {
  const CHIP = encodePlaceholderToken({ id: 'ph-town', mode: 'world', placementId: 'p1' });
  const TRAITS = [
    T('t-strong', 'Strong Back', {
      playerDescription: 'Heavy loads barely slow you.',
      statChanges: [{ statId: 'vigor', value: 10, type: 'starting' }, { statId: 'luck', value: -5, type: 'starting' }],
    }),
  ];

  it('keeps the stat changes hidden until the row is tapped', () => {
    renderTraits(TRAITS, [], ['t-strong']);
    expect(screen.queryByText(/\+10/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Strong Back/ }));
    expect(screen.getByText(/Vigor/)).toHaveTextContent('Vigor: +10');
  });

  it('leaves a hidden stat out of the list the player reads', () => {
    renderTraits(TRAITS, [], ['t-strong']);
    fireEvent.click(screen.getByRole('button', { name: /Strong Back/ }));
    expect(screen.queryByText(/Luck/)).toBeNull();
  });

  it('leaves out a change aimed at a stat the world no longer has, rather than printing its id', () => {
    const traits = [T('t-old', 'Relic', {
      statChanges: [{ statId: 'stat-deleted', value: 7, type: 'starting' }, { statId: 'vigor', value: 3, type: 'starting' }],
    })];
    renderTraits(traits, [], ['t-old']);
    fireEvent.click(screen.getByRole('button', { name: /Relic/ }));
    expect(screen.getByText(/Vigor/)).toHaveTextContent('Vigor: +3');
    expect(screen.queryByText(/stat-deleted/)).toBeNull();
  });

  it('names the facet a change targets when it is not the starting value', () => {
    const traits = [T('t-tough', 'Thick Skin', { statChanges: [{ statId: 'vigor', value: 5, type: 'max' }] })];
    renderTraits(traits, [], ['t-tough']);
    fireEvent.click(screen.getByRole('button', { name: /Thick Skin/ }));
    expect(screen.getByText(/Vigor/)).toHaveTextContent('Vigor: +5 (max)');
  });

  it("reads a stat name through the trait's own pin, so a pinning trait shows its own value", () => {
    const traits = [T('t-sworn', 'Sworn', {
      statChanges: [{ statId: 'standing', value: 5, type: 'starting' }],
      placeholderPins: [{ placeholderId: 'ph-town', value: 'Marrow' }],
    })];
    renderTraits(traits, [], ['t-sworn'], {
      stats: [statFixture(`${CHIP} Standing`, 50, { id: 'standing' })],
      world: { placeholders: [{ id: 'ph-town', name: 'Town', values: phValues(['Sedge', 'Marrow']) }] },
      seed: (gameplay) => gameplay.setPlaceholderRolls({ world: { 'ph-town': 'Sedge' }, unique: {} }),
    });
    fireEvent.click(screen.getByRole('button', { name: /Sworn/ }));
    expect(screen.getByText(/Standing/)).toHaveTextContent('Marrow Standing: +5');
  });

  it('offers no reveal for a trait that changes nothing', () => {
    renderTraits([T('t-plain', 'Wanderer', { playerDescription: 'No road is unfamiliar.' })], [], ['t-plain']);
    expect(screen.queryByRole('button', { name: /Wanderer/ })).toBeNull();
    expect(within(section('Traits')).getByText('Wanderer')).toBeInTheDocument();
  });
});
