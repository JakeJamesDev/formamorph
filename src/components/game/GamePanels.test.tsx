import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getGameplayText } from '@/lib/gameplayTextStore';
import { CONTINUE_CHOICE } from '@/lib/choices';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { readTurn, renderLeftPanel, renderMiddlePanel, renderRightPanel, statFixture, type PanelHarness, type TurnFixture } from '@/test/gamePanels';
import { resetTtsPlayback, setTtsPlayback } from '@/test/stubs/ttsPlayback';
import { lastVrmViewerProps, resetVrmViewerStub } from '@/test/stubs/vrmViewer';

import { phValues } from '@/test/placeholderValues';
// three.js needs a WebGL context and the TTS engine a Web Audio graph; jsdom has neither.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));
// Stubbed for the same reason as the VRM view: it is a Lexical editor whose caret jsdom cannot drive, and
// these cases are about panel state per turn. The field itself: prompt/TagChipField.test.tsx.
// Same reason, for the Edit Text modal's editor: these cases are about what saving an edit does to the
// turn, not about the field. Its own behavior: prompt/PromptField.markdown.test.tsx.
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock('@/components/prompt/TagChipField', () => ({
  default: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

afterEach(() => {
  resetTtsPlayback();
  resetVrmViewerStub();
});

const TURNS = [
  { action: 'walk the dock', narration: 'The dock creaks.', turnId: 't1', choices: ['Keep walking'] },
];

const STATS = [statFixture('Vigor', 50)];

/** Open the caret flyout beside Re-generate and return its two partial-regenerate items. */
const openRegenFlyout = () => {
  fireEvent.click(screen.getByRole('button', { name: 'More re-generate options' }));
  return {
    stats: screen.getByRole('button', { name: 'Re-generate Stats' }),
    choices: screen.getByRole('button', { name: 'Re-generate Choices' }),
  };
};

describe('MiddlePanel — partial re-generate against a scene render', () => {
  it('holds both partial re-generates while a scene image is being drawn', () => {
    const view = renderMiddlePanel({ sceneImageJob: 'image' }, { turns: TURNS, stats: STATS });
    const items = openRegenFlyout();

    // One graphics card can't write and draw at once.
    expect(items.stats).toBeDisabled();
    expect(items.choices).toBeDisabled();

    fireEvent.click(items.stats);
    fireEvent.click(items.choices);
    expect(view.props.handleRegenerateStats).not.toHaveBeenCalled();
    expect(view.props.handleRegenerateChoices).not.toHaveBeenCalled();
    // These two keep the turn, so the picture being drawn is still the right one for it — holding them must
    // not mean killing the render, the way rollback and a full re-generate do.
    expect(view.props.onCancelSceneImage).not.toHaveBeenCalled();
    expect(view.props.abortGeneration).not.toHaveBeenCalled();
  });

  it('holds them while the tag pass runs too', () => {
    renderMiddlePanel({ sceneImageJob: 'tags' }, { turns: TURNS, stats: STATS });
    const items = openRegenFlyout();
    expect(items.stats).toBeDisabled();
    expect(items.choices).toBeDisabled();
  });

  it('offers only the partial re-generates their aux requests are switched on for', () => {
    renderMiddlePanel({}, { turns: TURNS, stats: STATS, settings: (s) => s.setChoicesEnabled(false) });
    fireEvent.click(screen.getByRole('button', { name: 'More re-generate options' }));

    expect(screen.getByRole('button', { name: 'Re-generate Stats' })).toBeInTheDocument();
    // Re-generating choices that are switched off would fire a request whose result nothing displays.
    expect(screen.queryByRole('button', { name: 'Re-generate Choices' })).toBeNull();
  });

  it('drops the flyout entirely when neither is available', () => {
    // No stats in this world and choices off — a caret opening an empty menu.
    renderMiddlePanel({}, { turns: TURNS, settings: (s) => s.setChoicesEnabled(false) });
    expect(screen.queryByRole('button', { name: 'More re-generate options' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Re-generate' })).toBeInTheDocument();
  });

  it('offers them again with nothing in flight', () => {
    // The other half of the guard: the hold has to be the job's doing, not a permanently dead menu.
    const view = renderMiddlePanel({ sceneImageJob: null }, { turns: TURNS, stats: STATS });
    const items = openRegenFlyout();

    expect(items.stats).toBeEnabled();
    expect(items.choices).toBeEnabled();

    fireEvent.click(items.stats);
    expect(view.props.handleRegenerateStats).toHaveBeenCalled();
  });
});

/** Page from the live turn to `page`, as GameViewer does: the viewed turn's scene props change with it. */
const pageBackTo = (
  view: PanelHarness<ReturnType<typeof renderMiddlePanel>['props']>,
  page: number,
  scene: { sceneTurnId: string; sceneTags: string },
) => {
  act(() => { view.gameplay().setUserPage(page); });
  view.setProps({ ...scene, sceneImages: [] });
};

describe('MiddlePanel — scene panel state per turn', () => {
  const TWO_TURNS = [
    { narration: 'Rain on the forest road.', turnId: 't3', sceneTags: '1boy, forest' },
    { narration: 'The dock creaks.', turnId: 't5', sceneTags: '1girl, dock' },
  ];

  it('leaves an edited tag draft behind when the player pages to another turn', () => {
    const view = renderMiddlePanel({}, { turns: TWO_TURNS, stats: STATS });

    // On turn 5, open the tag row and start rewriting the line.
    fireEvent.click(screen.getByRole('button', { name: /^Tags$/ }));
    fireEvent.change(screen.getByLabelText('Scene tags'), { target: { value: 'nsfw, wrong turn' } });

    pageBackTo(view, 1, { sceneTurnId: 't3', sceneTags: '1boy, forest' });

    // A fresh turn arrives with its editor closed — the draft, the open row and the image index all went
    // with turn 5.
    expect(screen.queryByLabelText('Scene tags')).toBeNull();

    // And the leaked line can't be drawn onto this turn: an untouched tag row re-reads this turn's own
    // narration (undefined) rather than sending turn 5's edit.
    fireEvent.click(screen.getByRole('button', { name: /^Tags$/ }));
    expect((screen.getByLabelText('Scene tags') as HTMLTextAreaElement).value).toBe('1boy, forest');
    fireEvent.click(screen.getByRole('button', { name: /Draw again/ }));
    expect(view.props.onSceneImage).toHaveBeenCalledWith(undefined);
    expect(view.props.onSceneImage).not.toHaveBeenCalledWith('nsfw, wrong turn');
  });
});

describe('MiddlePanel — the audio row', () => {
  it('freezes the seek bar and its buttons above the narration once audio exists', () => {
    setTtsPlayback({ duration: 12 });
    const view = renderMiddlePanel({ ttsLoaded: true }, { turns: TURNS, stats: STATS });

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate audio for current text' }));
    expect(view.props.onRegenerateTTS).toHaveBeenCalled();
    // With audio in hand the narration menu offers neither of the two entries that produce it.
    fireEvent.click(screen.getByRole('button', { name: 'More narration options' }));
    expect(screen.queryByRole('button', { name: /Regenerate Audio/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Text to Speech/ })).toBeNull();
  });
});

describe('LeftPanel', () => {
  it('draws the player model for a world that has one', () => {
    renderLeftPanel({}, {
      seed: (gameplay) => gameplay.setCharacterData({
        bodyMorphs: { Belly: 0.25 }, currentHairStyle: 'long', hairLength: 0.5,
      }),
    });

    expect(screen.getByTestId('vrm-viewer')).toBeInTheDocument();
    expect(lastVrmViewerProps()?.bodyMorphValues).toMatchObject({ Belly: 0.25 });
  });

  it('keeps the notes the player types for the turn', () => {
    const view = renderLeftPanel();
    fireEvent.change(screen.getByPlaceholderText(/Add notes here/), { target: { value: 'the dock is rotten' } });
    expect(view.gameplay().playerNotes).toBe('the dock is rotten');
  });

  // The Avatar/Entities swap picks which view shows; it never switched a tab panel, so it's a radio group.
  // Re-clicking the active one must be a no-op — a single toggle group otherwise clears its own value.
  it('swaps between the avatar and the entity list without ever clearing the choice', () => {
    renderLeftPanel({}, { seed: (gameplay) => gameplay.setCharacterData({ bodyMorphs: {}, currentHairStyle: 'long', hairLength: 0.5 }) });

    const swap = screen.getByRole('radiogroup');
    const player = within(swap).getByRole('radio', { name: 'Avatar' });
    const entities = within(swap).getByRole('radio', { name: 'Entities' });
    expect(player).toHaveAttribute('data-state', 'on');

    fireEvent.click(entities);
    expect(entities).toHaveAttribute('data-state', 'on');
    expect(player).toHaveAttribute('data-state', 'off');

    fireEvent.click(entities);
    expect(entities).toHaveAttribute('data-state', 'on');
  });

  // The bug this guards: the list resolved a scene name to an entity by bare substring, either way round,
  // so "Wolf" and "Direwolf" were interchangeable — the row label came from whichever was authored first.
  it('labels two present entities whose names share a word with their own names', () => {
    const cast = [{ id: 'e1', name: 'Wolf' }, { id: 'e2', name: 'Direwolf' }];
    renderLeftPanel({ entities: cast as never }, {
      world: { entities: cast } as never,
      seed: (gameplay) => gameplay.setVisibleEntities([
        { name: 'Wolf', revealed: true },
        { name: 'Direwolf', revealed: true },
      ]),
    });

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Entities/i }));
    expect(screen.getByText('Wolf')).toBeInTheDocument();
    expect(screen.getByText('Direwolf')).toBeInTheDocument();
  });

  it('labels a lone longer-named entity as itself, not as the shorter name it contains', () => {
    const cast = [{ id: 'e1', name: 'Wolf' }, { id: 'e2', name: 'Direwolf' }];
    renderLeftPanel({ entities: cast as never }, {
      world: { entities: cast } as never,
      seed: (gameplay) => gameplay.setVisibleEntities([{ name: 'Direwolf', revealed: true }]),
    });

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Entities/i }));
    expect(screen.getByText('Direwolf')).toBeInTheDocument();
    expect(screen.queryByText('Wolf')).not.toBeInTheDocument();
  });
});

describe('MiddlePanel — editing a turn\'s narration', () => {
  // Both characters are authored, so who took part in a turn is re-derivable from whatever text is saved.
  const WORLD = { entities: [{ id: 'e1', name: 'Sedge' }, { id: 'e2', name: 'Marrow' }] };

  const EDITED_TURNS: TurnFixture[] = [
    {
      narration: 'Sedge waits at the dock.', turnId: 't1', choices: ['Wait'],
      entities: ['Sedge'], summary: 'Sedge waited.', diaries: { Sedge: 'I waited.' },
    },
    {
      narration: 'Marrow follows the path.', turnId: 't2', choices: ['Follow', 'Turn back'],
      entities: ['Marrow'], summary: 'Marrow followed.', diaries: { Marrow: 'I followed.' },
    },
  ];

  const setup = (page?: number) => renderMiddlePanel({}, {
    turns: EDITED_TURNS,
    page,
    world: WORLD as never,
    gameplayText: 'Marrow follows the path.',
    seed: (gameplay) => gameplay.setMemoryEdits({
      t1: { text: 'my own memory of turn one', source: 'player' },
      t2: { text: 'my own memory of turn two', source: 'player' },
    }),
  });

  /** Rewrite the viewed turn through the Edit Text modal and save. */
  const rewriteAs = async (text: string) => {
    fireEvent.click(screen.getByRole('button', { name: 'Edit text' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: text } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
  };

  it('replaces the narration and leaves the rest of the turn alone', async () => {
    const view = setup();
    await rewriteAs('Marrow stops dead at the treeline.');

    const turn = readTurn(view.gameplay().fullMessageHistory, 2);
    expect(turn.narration).toBe('Marrow stops dead at the treeline.');
    // The turn's identity and its choices are not the player's edit to make.
    expect(turn.turnId).toBe('t2');
    expect(turn.choices).toEqual(['Follow', 'Turn back']);
    // The latest page is the one that drives TTS and the live reveal.
    expect(getGameplayText()).toBe('Marrow stops dead at the treeline.');
  });

  it('re-derives who took part from the edited text', async () => {
    const view = setup();
    await rewriteAs('Sedge waits alone; the path stays empty.');

    // Stale participants drive the choices filter and rehydration — a character edited out of the prose
    // would otherwise keep being treated as present.
    expect(readTurn(view.gameplay().fullMessageHistory, 2).entities).toEqual(['Sedge']);
  });

  it("drops the turn's digest and diaries so they rebuild from the edit", async () => {
    const view = setup();
    await rewriteAs('Marrow turns back before the bridge.');

    const history = view.gameplay().fullMessageHistory;
    const edited = readTurn(history, 2);
    // Both were written from prose that no longer exists.
    expect(edited.summary).toBeUndefined();
    expect(edited.diaries).toBeUndefined();
    // And only that turn's: the neighbor's memory of its own text is still true.
    expect(readTurn(history, 1)).toMatchObject({
      summary: 'Sedge waited.', diaries: { Sedge: 'I waited.' },
    });
  });

  it("drops the player's own rewrite of that turn's memory", async () => {
    const view = setup();
    await rewriteAs('Marrow turns back before the bridge.');

    // A player rewrite describes the old prose, and it outranks the rebuilt digest — left in place it
    // would mask the new one forever.
    expect(view.gameplay().memoryEdits.t2).toBeUndefined();
    expect(view.gameplay().memoryEdits.t1).toMatchObject({ text: 'my own memory of turn one' });
  });

  it('edits the turn being viewed, not the newest one', async () => {
    const view = setup(1);
    await rewriteAs('Sedge is already gone when you arrive.');

    const history = view.gameplay().fullMessageHistory;
    expect(readTurn(history, 1).narration).toBe('Sedge is already gone when you arrive.');
    expect(readTurn(history, 2).narration).toBe('Marrow follows the path.');
    // Only the latest page feeds the live reveal text, so editing history must not touch it.
    expect(getGameplayText()).toBe('Marrow follows the path.');
  });
});

describe('RightPanel', () => {
  it('says which turn is being viewed while paging back through history', () => {
    const turns = [{ narration: 'One.' }, { narration: 'Two.' }];
    renderRightPanel({}, { turns, page: 1, stats: STATS });
    expect(screen.getByText(/Viewing turn 1 of 2/)).toBeInTheDocument();
  });

  it('says nothing on the live turn', () => {
    renderRightPanel({}, { turns: TURNS, stats: STATS });
    expect(screen.queryByText(/Viewing turn/)).toBeNull();
  });

  // A hidden stat has no row at all, which is also what keeps its delta chip, bar band and
  // history deltas off-screen — they only render inside the row.
  it('renders no row for a hidden stat', () => {
    renderRightPanel({}, {
      turns: TURNS,
      stats: [statFixture('Vigor', 50), statFixture('Luck', 30, { hidden: true })],
    });
    expect(screen.getByText('Vigor')).toBeInTheDocument();
    expect(screen.queryByText('Luck')).toBeNull();
  });
});

/** Vigor's authored bands: ≤30 Winded, ≤70 Steady. Above 70 the stat is in no band at all. */
const BANDS = [
  { id: 'b-low', threshold: 30, description: 'Winded' },
  { id: 'b-mid', threshold: 70, description: 'Steady' },
];
/** Vigor at `value`, banded. */
const banded = (value: number) => statFixture('Vigor', value, { descriptors: BANDS });
/** The row a stat's name sits in — the descriptor line and the readout are siblings of that name. */
const statRow = (name: string) => {
  const row = screen.getByText(name).closest('div.mb-2');
  if (!row) throw new Error(`no stat row for ${name}`);
  return row as HTMLElement;
};
/** The descriptor line under a stat's bar, or null when the row doesn't carry one. */
const descriptorLine = (name: string) => statRow(name).querySelector('p');

describe('RightPanel — the stat descriptor line', () => {
  it('names the band the current value falls in', () => {
    renderRightPanel({}, { turns: TURNS, stats: [banded(20)] });
    expect(descriptorLine('Vigor')).toHaveTextContent('Winded');
  });

  it('names the band a higher value falls in instead', () => {
    renderRightPanel({}, { turns: TURNS, stats: [banded(50)] });
    expect(descriptorLine('Vigor')).toHaveTextContent('Steady');
  });

  // An authoring gap is the author's business, not something to present to the player as "no status".
  it('writes nothing when the value sits above every band', () => {
    renderRightPanel({}, { turns: TURNS, stats: [banded(90)] });
    expect(screen.queryByText('Steady')).toBeNull();
    expect(descriptorLine('Vigor')).toHaveTextContent('');
  });

  it('keeps the line in a bandless stat of a world that has descriptors, so rows stay level', () => {
    renderRightPanel({}, { turns: TURNS, stats: [banded(20), statFixture('Coin', 25)] });
    expect(descriptorLine('Coin')).not.toBeNull();
  });

  it('costs a world with no descriptors at all nothing', () => {
    renderRightPanel({}, { turns: TURNS, stats: [statFixture('Vigor', 20), statFixture('Coin', 25)] });
    expect(descriptorLine('Vigor')).toBeNull();
    expect(descriptorLine('Coin')).toBeNull();
  });

  // A hidden stat has no row, so it can't be what puts the line on everyone else's.
  it('does not let a hidden stat reserve the line for the ones the player can see', () => {
    renderRightPanel({}, {
      turns: TURNS,
      stats: [statFixture('Vigor', 20), statFixture('Luck', 30, { hidden: true, descriptors: BANDS })],
    });
    expect(descriptorLine('Vigor')).toBeNull();
  });

  it('offers the full text on hover, so a paragraph-long band can be read without being shown', async () => {
    const long = 'Comfortable enough to stop counting every coin twice over';
    renderRightPanel({}, {
      turns: TURNS,
      stats: [statFixture('Vigor', 20, { descriptors: [{ id: 'b-long', threshold: 30, description: long }] })],
    });

    await userEvent.hover(descriptorLine('Vigor')!);

    expect(await screen.findByText(long, { selector: 'div' })).toBeVisible();
  });
});

describe('RightPanel — the band-change flash', () => {
  const PAGED_TURNS = [
    { action: 'rest', narration: 'You rest.', turnId: 't1', stats: [banded(50)] },
    { action: 'run', narration: 'You run.', turnId: 't2' },
  ];

  /** The span the flash class lands on, inside a stat's descriptor line. */
  const flashSpan = (name: string) => descriptorLine(name)?.querySelector('span');

  it('does not flash a band that was simply there when the panel opened', () => {
    renderRightPanel({}, { turns: TURNS, stats: [banded(20)] });
    expect(flashSpan('Vigor')).not.toHaveClass('stat-band-flash');
  });

  it('flashes when paging back lands on a turn in a different band', () => {
    const view = renderRightPanel({}, { turns: PAGED_TURNS, stats: [banded(20)] });
    expect(flashSpan('Vigor')).toHaveTextContent('Winded');

    act(() => {
      const gameplay = view.gameplay();
      gameplay.setUserPage(1);
      gameplay.setDisplayedMessages(gameplay.fullMessageHistory.slice(0, 2));
    });

    expect(flashSpan('Vigor')).toHaveTextContent('Steady');
    expect(flashSpan('Vigor')).toHaveClass('stat-band-flash');
  });

  it('shows the new band but skips the flash when the player asked for less motion', () => {
    const real = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'), media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      const view = renderRightPanel({}, { turns: PAGED_TURNS, stats: [banded(20)] });
      act(() => {
        const gameplay = view.gameplay();
        gameplay.setUserPage(1);
        gameplay.setDisplayedMessages(gameplay.fullMessageHistory.slice(0, 2));
      });

      expect(flashSpan('Vigor')).toHaveTextContent('Steady');
      expect(flashSpan('Vigor')).not.toHaveClass('stat-band-flash');
    } finally {
      window.matchMedia = real;
    }
  });

  it('leaves a band the player typed themselves alone', () => {
    renderRightPanel({}, { turns: TURNS, stats: [banded(20)] });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Stats' }));

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Vigor' }), { target: { value: '50' } });

    expect(flashSpan('Vigor')).toHaveTextContent('Steady');
    expect(flashSpan('Vigor')).not.toHaveClass('stat-band-flash');
  });
});

describe('RightPanel — typing a stat value', () => {
  /** Edit mode, on the live turn, over one banded Vigor. */
  const renderEditing = (stat = banded(20)) => {
    const view = renderRightPanel({}, { turns: TURNS, stats: [stat] });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Stats' }));
    return view;
  };
  const field = () => screen.getByRole('spinbutton', { name: 'Vigor' });
  const value = (view: PanelHarness<unknown>) => view.gameplay().playerStats[0].value;

  it('leaves the readout as plain text until edit mode is on', () => {
    renderRightPanel({}, { turns: TURNS, stats: [banded(20)] });
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(statRow('Vigor')).toHaveTextContent('20 / 100');
  });

  it('replaces the readout numeral with a field, keeping the range suffix beside it', () => {
    renderEditing();
    expect(field()).toHaveValue(20);
    expect(screen.getByText('/ 100')).toBeInTheDocument();
  });

  it('commits every keystroke, so the bar and the descriptor track the typing', () => {
    const view = renderEditing();
    fireEvent.change(field(), { target: { value: '5' } });
    expect(value(view)).toBe(5);

    fireEvent.change(field(), { target: { value: '55' } });
    expect(value(view)).toBe(55);
    expect(descriptorLine('Vigor')).toHaveTextContent('Steady');
  });

  it('clamps a value typed over the max as it is typed', () => {
    const view = renderEditing();
    fireEvent.change(field(), { target: { value: '9999' } });
    expect(value(view)).toBe(100);
    expect(field()).toHaveValue(100);
  });

  it('clamps a value typed under the min of a stat whose floor is above zero', () => {
    const view = renderEditing(statFixture('Vigor', 33, { min: 10, max: 50, descriptors: BANDS }));
    fireEvent.change(field(), { target: { value: '3' } });
    expect(value(view)).toBe(10);
    expect(field()).toHaveValue(10);
  });

  it('holds the stat while the field is empty, and snaps the text back on blur', () => {
    const view = renderEditing();
    fireEvent.change(field(), { target: { value: '' } });
    expect(value(view)).toBe(20);
    expect(field()).toHaveValue(null);

    fireEvent.blur(field());
    expect(field()).toHaveValue(20);
  });

  it('follows the slider, which is still there for coarse adjustment', () => {
    const view = renderEditing();
    expect(screen.getByRole('slider')).toBeInTheDocument();

    act(() => { view.gameplay().setPlayerStats([banded(80)]); });
    expect(field()).toHaveValue(80);
  });

  it('offers no field or slider on a past turn', () => {
    const view = renderRightPanel({}, {
      turns: [
        { action: 'rest', narration: 'You rest.', turnId: 't1' },
        { action: 'run', narration: 'You run.', turnId: 't2' },
      ],
      stats: [banded(20)],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Stats' }));

    act(() => {
      const gameplay = view.gameplay();
      gameplay.setUserPage(1);
      gameplay.setDisplayedMessages(gameplay.fullMessageHistory.slice(0, 2));
    });

    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Stats' })).toBeDisabled();
  });
});

describe('RightPanel — the traits tab against an edited world', () => {
  /** A save whose frozen trait predates the author marking it switchable — the shape the bug lived in. */
  const renderTraits = (authoredToggle: boolean) => {
    const view = renderRightPanel({}, {
      turns: TURNS,
      world: { traits: [{ id: 't-brave', name: 'Brave', statChanges: [], playerToggle: authoredToggle }] },
      seed: (gameplay) => {
        gameplay.setPlayerTraits([{ id: 't-brave', name: 'Brave', statChanges: [] }]);
        gameplay.setActiveTab('traits');
      },
    });
    return view;
  };

  it('offers the switch a playthrough started before the trait was switchable', () => {
    const view = renderTraits(true);

    const box = screen.getByRole('checkbox', { name: 'Switch off Brave' });
    expect(box).toBeEnabled();

    fireEvent.click(box);
    expect(view.props.onToggleTrait).toHaveBeenCalledWith('t-brave', false);
  });

  it('offers no switch when the author has not marked it switchable', () => {
    // The other half: the control has to follow the world, not appear for every trait.
    renderTraits(false);
    expect(screen.queryByRole('checkbox')).toBeNull();
    // Scoped to the list itself, since the active-traits summary line names it too.
    expect(within(screen.getByRole('group', { name: 'Traits' })).getByText(/Brave/)).toBeInTheDocument();
  });
});

describe('RightPanel — acquirable traits in the traits tab', () => {
  // Authored order is what puts related traits together, so an acquirable trait has to land in its authored
  // slot rather than after everything the player already holds.
  const AUTHORED = [
    { id: 't-first', name: 'Feral', statChanges: [], playerToggle: true },
    { id: 't-fixed', name: 'Cursed', statChanges: [] },
    { id: 't-mid', name: 'Wary', statChanges: [], playerToggle: true },
    { id: 't-last', name: 'Brave', statChanges: [], playerToggle: true },
  ];

  const HELD = [{ id: 't-last', name: 'Brave', statChanges: [], playerToggle: true }];
  const PAGED_TURNS = [
    { action: 'walk the dock', narration: 'The dock creaks.', turnId: 't1', choices: ['Keep walking'], traits: HELD },
    { action: 'walk on', narration: 'The dock holds.', turnId: 't2', choices: ['Keep walking'], traits: HELD },
  ];

  const renderPanel = (turns = TURNS) =>
    renderRightPanel({}, {
      turns,
      world: { traits: AUTHORED },
      seed: (gameplay) => {
        gameplay.setPlayerTraits([{ id: 't-last', name: 'Brave', statChanges: [], playerToggle: true }]);
        gameplay.setActiveTab('traits');
      },
    });

  const listedNames = () =>
    screen.getAllByRole('checkbox').map((box) => box.getAttribute('aria-label') ?? '');
  /** The panel folds every switched-off trait — acquirables included — behind one collapsed block. */
  const openDisabled = () => fireEvent.click(screen.getByRole('button', { name: /^Disabled/ }));

  it('lists the traits the player never chose under the one they hold, in authored order', () => {
    renderPanel();
    expect(listedNames()).toEqual(['Switch off Brave']);

    openDisabled();
    expect(listedNames()).toEqual(['Switch off Brave', 'Switch on Feral', 'Switch on Wary']);
  });

  it('switches on a trait the player does not hold', () => {
    const view = renderPanel();
    openDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Switch on Feral' }));
    expect(view.props.onToggleTrait).toHaveBeenCalledWith('t-first', true);
  });

  it('leaves a trait the author never marked switchable out of the panel entirely', () => {
    renderPanel();
    expect(screen.queryByText(/Cursed/)).toBeNull();
  });

  it('shows only the traits held on a past turn, with the switches disabled', () => {
    const view = renderPanel(PAGED_TURNS);
    act(() => {
      const gameplay = view.gameplay();
      gameplay.setUserPage(1);
      gameplay.setDisplayedMessages(gameplay.fullMessageHistory.slice(0, 2));
    });
    expect(listedNames()).toEqual(['Switch off Brave']);
    expect(screen.getByRole('checkbox', { name: 'Switch off Brave' })).toBeDisabled();
  });
});

describe('MiddlePanel — paging repaints the narration', () => {
  // Both turns are the SAME markdown shape and length, so every mdast node lands at an identical source
  // position. Streamdown memoizes its element components on that position rather than on the text, so a
  // swap like this is the exact case that silently kept the previous turn's words on screen.
  const PAGED = [
    // Identical length as well as shape — the memo compares end column, so equal-length text is what
    // actually collides.
    { action: 'go left', narration: 'The lantern gutters once in the hall.', choices: ['Left'] },
    { action: 'go right', narration: 'The lantern steadies then dims again.', choices: ['Right'] },
  ];

  /** Page the panel to `page` the way GameViewer does: pin the page, then re-slice displayedMessages. */
  const goToPage = (view: PanelHarness<unknown>, page: number) => {
    act(() => {
      const gameplay = view.gameplay();
      gameplay.setUserPage(page >= PAGED.length ? null : page);
      gameplay.setDisplayedMessages(gameplay.fullMessageHistory.slice((page - 1) * 2, page * 2));
    });
  };

  const narrationText = () => screen.getByTestId('narration').textContent ?? '';

  it('shows the paged turn narration, not the one it was already displaying', () => {
    const view = renderMiddlePanel({}, { turns: PAGED, stats: STATS });
    expect(narrationText()).toContain('steadies');

    goToPage(view as PanelHarness<unknown>, 1);
    expect(narrationText()).toContain('gutters once');
    expect(narrationText()).not.toContain('steadies');

    goToPage(view as PanelHarness<unknown>, 2);
    expect(narrationText()).toContain('steadies');
    expect(narrationText()).not.toContain('gutters once');
  });

  it('keeps the narration and the choices on the same turn', () => {
    const view = renderMiddlePanel({}, { turns: PAGED, stats: STATS });
    goToPage(view as PanelHarness<unknown>, 1);

    expect(narrationText()).toContain('gutters once');
    expect(screen.getByRole('button', { name: 'Left' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Right' })).toBeNull();
  });
});

describe('MiddlePanel — the player\'s own action', () => {
  it('renders as markdown, like the narration it sits among', () => {
    renderMiddlePanel({}, { turns: [{ action: 'I shout **stop** and _step back_', narration: 'The dock creaks.' }] });

    // Streamdown renders bold as a marked span rather than a <strong>, so match on its own marker.
    const you = screen.getByText('You:').parentElement!;
    expect(within(you).getByText('stop').closest('[data-streamdown="strong"]')).not.toBeNull();
    expect(within(you).getByText('step back').closest('em')).not.toBeNull();
  });

  it('keeps a typed line break', () => {
    renderMiddlePanel({}, { turns: [{ action: 'I wait.\nThen I knock.', narration: 'The dock creaks.' }] });

    const you = screen.getByText('You:').parentElement!;
    expect(you.querySelector('br')).not.toBeNull();
  });
});

describe('MiddlePanel — the continue pseudo-choice', () => {
  const continueButton = () => screen.queryByRole('button', { name: CONTINUE_CHOICE });

  it('stages its own text in the action box instead of asking the AI for anything', () => {
    const view = renderMiddlePanel({}, { turns: TURNS });

    fireEvent.click(continueButton()!);
    expect(view.gameplay().playerInput).toBe(CONTINUE_CHOICE);
    // The whole point is that it costs no request — sending stays the player's move.
    expect(view.props.handleSendAction).not.toHaveBeenCalled();
    expect(view.props.handleRegenerateChoices).not.toHaveBeenCalled();
  });

  it('appends after a typed action on ctrl+click, the way a generated choice does', () => {
    const view = renderMiddlePanel({}, { turns: TURNS });
    act(() => { view.gameplay().setPlayerInput('I check the rope'); });

    fireEvent.click(continueButton()!, { ctrlKey: true });
    expect(view.gameplay().playerInput).toBe(`I check the rope. ${CONTINUE_CHOICE}`);
  });

  it('is offered on a turn that came back with no choices at all', () => {
    // The case it exists for: nothing to click and no idea what to type.
    renderMiddlePanel({}, { turns: [{ action: 'wait', narration: 'The dock creaks.', choices: [] }] });
    expect(continueButton()).toBeInTheDocument();
  });

  it('goes away when the player switches it off', () => {
    renderMiddlePanel({}, { turns: TURNS, settings: (s) => s.setContinueChoiceMode('off') });
    expect(continueButton()).toBeNull();
    expect(screen.getByRole('button', { name: 'Keep walking' })).toBeInTheDocument();
  });

  it('goes away with the rest of the choices when choices are switched off', () => {
    renderMiddlePanel({}, { turns: TURNS, settings: (s) => s.setChoicesEnabled(false) });
    expect(continueButton()).toBeNull();
  });

  it('stays on its own with choices switched off when set to Always', () => {
    // The whole point of the third setting: no choices request, but still a way to take a turn without typing.
    // No choices come back at all with the request off, so it's the only button the panel has.
    renderMiddlePanel({}, { turns: [{ ...TURNS[0], choices: [] }], settings: (s) => { s.setChoicesEnabled(false); s.setContinueChoiceMode('always'); } });
    expect(continueButton()).toBeInTheDocument();
  });

  it('is withheld before the opening scene has landed', () => {
    // Nothing has happened yet, so there is nothing to continue.
    renderMiddlePanel({}, { turns: [] });
    expect(continueButton()).toBeNull();
  });

  it('is withheld while a turn is still being generated', () => {
    // Staging an action mid-request would submit into a turn that hasn't landed.
    renderMiddlePanel({ disabled: true }, { turns: TURNS });
    expect(continueButton()).toBeNull();
  });

  it('shows on a past page only when it was the action that turn took', () => {
    // Each turn's `action` is what was sent *from the previous page*, so page 1 is the one answered
    // with the continue and page 2 is the one answered by typing.
    const PAST = [
      { action: 'walk the dock', narration: 'The tide comes in.', choices: ['Wait'] },
      { action: CONTINUE_CHOICE, narration: 'The dock creaks.', choices: ['Keep walking'] },
      { action: 'wait', narration: 'Gulls settle on the piling.', choices: ['Watch'] },
    ];
    const view = renderMiddlePanel({}, { turns: PAST });

    // Page 1's action was the continue — it reads back as the picked option.
    act(() => { view.gameplay().setUserPage(1); });
    expect(continueButton()).toBeInTheDocument();

    // Page 2's was a typed action, so a live-only affordance has no business appearing there.
    act(() => { view.gameplay().setUserPage(2); });
    expect(continueButton()).toBeNull();
  });
});

describe('placeholder names reach the panels resolved', () => {
  // A one-value placeholder is a Variable: it resolves from its own value with no roll, so the assertion is
  // deterministic without seeding a save's rolls. The chip is the real stored token, not a stand-in.
  const TOWN = { id: 'ph-town', name: 'Town', values: phValues(['Sedge']) };
  const CHIP = encodePlaceholderToken({ id: 'ph-town', mode: 'world', placementId: 'p1' });

  it('renders a stat whose name holds a chip by its value, never the raw token', () => {
    const { container } = renderRightPanel({}, {
      turns: TURNS,
      stats: [statFixture(`${CHIP} Standing`, 50, { id: 'standing' })],
      world: { placeholders: [TOWN] },
    });

    // The panel reads the world through its own hook, so this is what catches it reaching past resolution.
    expect(screen.getByText('Sedge Standing')).toBeInTheDocument();
    expect(container.textContent).not.toContain('{{ph:');
  });

  it('renders a descriptor that holds a chip by its value under the stat bar', () => {
    const { container } = renderRightPanel({}, {
      turns: TURNS,
      stats: [statFixture('Standing', 20, {
        descriptors: [{ id: 'b-low', threshold: 30, description: `Shunned in ${CHIP}` }],
      })],
      world: { placeholders: [TOWN] },
    });

    expect(descriptorLine('Standing')).toHaveTextContent('Shunned in Sedge');
    expect(container.textContent).not.toContain('{{ph:');
  });

  it('renders a trait whose name holds a chip by its value', () => {
    const { container } = renderRightPanel({}, {
      turns: TURNS,
      stats: STATS,
      world: {
        placeholders: [TOWN],
        traits: [{ id: 't-native', name: `${CHIP} Native`, statChanges: [] }],
      },
      seed: (gameplay) => {
        gameplay.setPlayerTraits([{ id: 't-native', name: `${CHIP} Native`, statChanges: [] }]);
        gameplay.setActiveTab('traits'); // traits live behind their own tab, as in the app
      },
    });

    expect(within(screen.getByRole('group', { name: 'Traits' })).getByText(/Sedge Native/)).toBeInTheDocument();
    expect(container.textContent).not.toContain('{{ph:');
  });

  // A pin has to reach the panels, not just the pre-game pickers: stat deltas are matched by resolved name,
  // so a stat bar showing the roll while the AI is told the pinned name would silently stop matching.
  it('renders a stat name under the pin an active trait imposes, not the rolled value', () => {
    const WILD = { id: 'ph-town', name: 'Town', values: phValues(['Sedge', 'Marrow']) };
    const PINNER = {
      id: 't-sworn', name: 'Sworn', statChanges: [],
      placeholderPins: [{ placeholderId: 'ph-town', value: 'Marrow' }],
    };
    const { container } = renderRightPanel({}, {
      turns: TURNS,
      stats: [statFixture(`${CHIP} Standing`, 50, { id: 'standing' })],
      world: { placeholders: [WILD], traits: [PINNER] },
      seed: (gameplay) => {
        gameplay.setPlaceholderRolls({ world: { 'ph-town': 'Sedge' }, unique: {} });
        gameplay.setPlayerTraits([PINNER]);
      },
    });

    expect(screen.getByText('Marrow Standing')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Sedge');
  });

  // The self-pin display rule: a pinning trait's OWN text reads its own pin, while everything outside the
  // card (here the stat bar) follows the winning active pin. This is the confusion it exists to remove —
  // "Native of X" flipping to the other trait's town the moment that one was ticked.
  it("keeps each pinning trait's own text on its own pin while the stat bar follows the winner", () => {
    const WILD = { id: 'ph-town', name: 'Town', values: phValues(['Sedge', 'Marrow']) };
    const NATIVE = {
      id: 't-native', name: `Native of ${CHIP}`, statChanges: [],
      playerDescription: `Home is ${encodePlaceholderToken({ id: 'ph-town', mode: 'world', placementId: 'p2' })}.`,
      placeholderPins: [{ placeholderId: 'ph-town', value: 'Sedge' }],
    };
    const SWORN = {
      id: 't-sworn', name: `Sworn to ${encodePlaceholderToken({ id: 'ph-town', mode: 'world', placementId: 'p3' })}`,
      statChanges: [], order: 1,
      placeholderPins: [{ placeholderId: 'ph-town', value: 'Marrow' }],
    };
    const view = renderRightPanel({}, {
      turns: TURNS,
      stats: [statFixture(`${encodePlaceholderToken({ id: 'ph-town', mode: 'world', placementId: 'p4' })} Standing`, 50, { id: 'standing' })],
      world: { placeholders: [WILD], traits: [NATIVE, SWORN] },
      seed: (gameplay) => {
        // Freeze the roll, as a real session would have: the toggle-off step below reads it.
        gameplay.setPlaceholderRolls({ world: { 'ph-town': 'Sedge' }, unique: {} });
        gameplay.setPlayerTraits([NATIVE, SWORN]);
      },
    });

    // Both active, Sworn later in authored order → the world's town is Marrow (the stat tab is the default)…
    expect(screen.getByText('Marrow Standing')).toBeInTheDocument();
    // …but on the Traits tab each card still names its own pin, name and description alike.
    act(() => { view.gameplay().setActiveTab('traits'); });
    const list = within(screen.getByRole('group', { name: 'Traits' }));
    expect(list.getByText(/Native of Sedge/)).toBeInTheDocument();
    expect(list.getByText(/Home is Sedge\./)).toBeInTheDocument();
    expect(list.getByText(/Sworn to Marrow/)).toBeInTheDocument();

    // Switching both pinning traits off mid-game releases their pins: the stat bar falls back to the
    // frozen roll (Sedge here — sourced from the roll, since no pin is left active).
    act(() => { view.gameplay().setDisabledTraitIds(['t-sworn', 't-native']); view.gameplay().setActiveTab('stats'); });
    expect(screen.getByText('Sedge Standing')).toBeInTheDocument();
    // And back on brings the winning pin back — the roll underneath was never overwritten.
    act(() => { view.gameplay().setDisabledTraitIds([]); });
    expect(screen.getByText('Marrow Standing')).toBeInTheDocument();
  });

  // Gameplay stores the whole location object, so the copy it holds froze how the name read on arrival.
  // Reading it back out of the resolved world is what lets a pin switched on later move it.
  it('re-reads the current location, so a pin switched on after arrival moves its name', () => {
    const WILD = { id: 'ph-town', name: 'Town', values: phValues(['Sedge', 'Marrow']) };
    const tok = (p: string) => encodePlaceholderToken({ id: 'ph-town', mode: 'world', placementId: p });
    const SWORN = {
      id: 't-sworn', name: 'Sworn', statChanges: [], playerToggle: true,
      placeholderPins: [{ placeholderId: 'ph-town', value: 'Marrow' }],
    };
    const HERE = { id: 'l1', name: `${tok('p5')} Square`, isStarting: true };

    const view = renderRightPanel({}, {
      turns: TURNS,
      stats: STATS,
      world: { placeholders: [WILD], traits: [SWORN], locations: [HERE] },
      seed: (gameplay) => {
        gameplay.setPlaceholderRolls({ world: { 'ph-town': 'Sedge' }, unique: {} });
        // Arrived before the trait was on — this is the stale copy the panel used to render.
        gameplay.setCurrentLocation({ ...HERE, name: 'Sedge Square' });
        gameplay.setPlayerTraits([SWORN]);
        gameplay.setActiveTab('location');
      },
    });

    expect(screen.getByText(/Current Location: Marrow Square/)).toBeInTheDocument();

    // Switch the pin off and it follows back to the roll, rather than to the arrival snapshot.
    act(() => { view.gameplay().setDisabledTraitIds(['t-sworn']); });
    expect(screen.getByText(/Current Location: Sedge Square/)).toBeInTheDocument();
  });
});

describe('the action input grows in flow, not over the panel', () => {
  /** Fake the content height jsdom never computes, so the grow path has something to measure. */
  const withScrollHeight = (px: number, run: () => void) => {
    const proto = window.HTMLTextAreaElement.prototype;
    const original = Object.getOwnPropertyDescriptor(proto, 'scrollHeight');
    Object.defineProperty(proto, 'scrollHeight', { configurable: true, get: () => px });
    try { run(); } finally {
      if (original) Object.defineProperty(proto, 'scrollHeight', original);
      else delete (proto as unknown as Record<string, unknown>).scrollHeight;
    }
  };

  const focusAndType = (text: string) => {
    const box = screen.getByPlaceholderText(/Type your action/);
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: text } });
    return box;
  };

  it('lifts its wrapper to the grown height so the content above is pushed up', () => {
    renderMiddlePanel({}, { turns: TURNS, stats: STATS });
    const wrap = screen.getByTestId('action-input-wrap');
    expect(wrap.style.height).toBe('40px');

    // A multi-line action: the box grows, and the wrapper has to grow with it or the box just
    // overlays the narration and stays under the keyboard.
    withScrollHeight(120, () => { focusAndType('a\nb\nc'); });
    expect(wrap.style.height).toBe('120px');
  });

  it('caps the wrapper at the scroll ceiling instead of eating the panel', () => {
    renderMiddlePanel({}, { turns: TURNS, stats: STATS });
    withScrollHeight(900, () => { focusAndType('long'); });
    expect(screen.getByTestId('action-input-wrap').style.height).toBe('240px');
  });

  it('collapses back to one line on blur', () => {
    renderMiddlePanel({}, { turns: TURNS, stats: STATS });
    const wrap = screen.getByTestId('action-input-wrap');
    withScrollHeight(120, () => {
      const box = focusAndType('a\nb\nc');
      expect(wrap.style.height).toBe('120px');
      fireEvent.blur(box);
    });
    expect(wrap.style.height).toBe('40px');
  });
});

describe('a placeholder an entity carries resolves in play', () => {
  it('resolves a chip in a location at a placeholder that lives on an entity', () => {
    // A one-value placeholder is a Variable, so no roll is needed for the assertion to be deterministic.
    const EYES = { id: 'ph-eyes', name: 'Eyes', values: phValues(['amber']) };
    const chip = encodePlaceholderToken({ id: 'ph-eyes', mode: 'world', placementId: 'p9' });
    const HERE = { id: 'l1', name: `The ${chip} Room`, isStarting: true };
    const { container } = renderRightPanel({}, {
      turns: TURNS,
      stats: STATS,
      world: { entities: [{ id: 'molly', name: 'Molly', placeholders: [EYES] }], locations: [HERE] },
      seed: (gameplay) => {
        gameplay.setCurrentLocation(HERE);
        gameplay.setActiveTab('location');
      },
    });

    expect(screen.getByText(/Current Location: The amber Room/)).toBeInTheDocument();
    expect(container.textContent).not.toContain('{{ph:');
  });
});
