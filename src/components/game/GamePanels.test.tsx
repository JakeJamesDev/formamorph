import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, act, within } from '@testing-library/react';
import { getGameplayText } from '@/lib/gameplayTextStore';
import { readTurn, renderLeftPanel, renderMiddlePanel, renderRightPanel, statFixture, type PanelHarness, type TurnFixture } from '@/test/gamePanels';
import { resetTtsPlayback, setTtsPlayback } from '@/test/stubs/ttsPlayback';
import { lastVrmViewerProps, resetVrmViewerStub } from '@/test/stubs/vrmViewer';

// three.js needs a WebGL context and the TTS engine a Web Audio graph; jsdom has neither.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

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

    fireEvent.click(screen.getByTitle('Regenerate audio for current text'));
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

  // The Player/Entities swap picks which view shows; it never switched a tab panel, so it's a radio group.
  // Re-clicking the active one must be a no-op — a single toggle group otherwise clears its own value.
  it('swaps between the player model and the entity list without ever clearing the choice', () => {
    renderLeftPanel({}, { seed: (gameplay) => gameplay.setCharacterData({ bodyMorphs: {}, currentHairStyle: 'long', hairLength: 0.5 }) });

    const swap = screen.getByRole('radiogroup');
    const player = within(swap).getByRole('radio', { name: 'Player' });
    const entities = within(swap).getByRole('radio', { name: 'Entities' });
    expect(player).toHaveAttribute('data-state', 'on');

    fireEvent.click(entities);
    expect(entities).toHaveAttribute('data-state', 'on');
    expect(player).toHaveAttribute('data-state', 'off');

    fireEvent.click(entities);
    expect(entities).toHaveAttribute('data-state', 'on');
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
    fireEvent.click(screen.getByTitle('Edit text'));
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
