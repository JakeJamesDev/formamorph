import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, act, within } from '@testing-library/react';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { renderRightPanel, statFixture, type PanelHarnessOptions } from '@/test/gamePanels';
import type { Trait, TraitGroup } from '@/types';

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

  it('names every active trait on one line', () => {
    renderTraits(TRAITS, [], ['t-a', 't-b']);
    // The line truncates, so the full list lives on the hover title as well as in the text.
    expect(screen.getByTitle('Keen Eyes, Strong Back')).toHaveTextContent('2 active: Keen Eyes, Strong Back');
  });

  it('says nothing at all when no trait is active', () => {
    renderTraits(TRAITS, [], []);
    expect(screen.queryByText(/active:/)).toBeNull();
  });

  it('drops a trait from the line the moment it is switched off', () => {
    const view = renderTraits(TRAITS, [], ['t-a', 't-b']);
    act(() => { view.gameplay().setDisabledTraitIds(['t-a']); });
    expect(screen.getByTitle('Strong Back')).toHaveTextContent('1 active: Strong Back');
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

describe('an exclusive trait group reads as a set of alternatives', () => {
  const GROUPS = [G('g-past', 'Background', { exclusive: true })];
  const TRAITS = [
    T('t-farm', 'Farmhand', { groupId: 'g-past' }),
    T('t-book', 'Scholar', { groupId: 'g-past' }),
  ];

  it('gives an exclusive group radios and a plain group checkboxes', () => {
    renderTraits([...TRAITS, T('t-loose', 'Wanderer')], GROUPS, ['t-farm', 't-loose']);
    expect(screen.getByRole('radio', { name: 'Switch off Farmhand' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Switch off Wanderer' })).toBeInTheDocument();
  });

  it('switches the chosen alternative on, leaving the runtime to retire its sibling', () => {
    const view = renderTraits(TRAITS, GROUPS, ['t-farm']);
    openDisabled('Background');
    fireEvent.click(screen.getByRole('radio', { name: 'Switch on Scholar' }));
    expect(view.props.onToggleTrait).toHaveBeenCalledWith('t-book', true);
  });

  it('clears the selected alternative when it is clicked again, so none is a legal answer', () => {
    const view = renderTraits(TRAITS, GROUPS, ['t-farm']);
    fireEvent.click(screen.getByRole('radio', { name: 'Switch off Farmhand' }));
    expect(view.props.onToggleTrait).toHaveBeenCalledWith('t-farm', false);
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
      world: { placeholders: [{ id: 'ph-town', name: 'Town', values: ['Sedge', 'Marrow'] }] },
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
