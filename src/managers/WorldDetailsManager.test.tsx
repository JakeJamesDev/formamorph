import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Dictionary, Entity, FocusFieldHint, GameLocation, Placeholder, Stat, Trait, WorldOverview } from '@/types';
import { EditorModeContext } from '@/lib/editorMode';
import { OPENING_SCENE_CUE } from '@/components/game/GamePrompts';
import { openingFieldKey } from '@/lib/openings';
import WorldDetailsManager from './WorldDetailsManager';

const PRESET_NARRATION = 'PRESET narration prompt';
const PRESET_CHOICES = 'PRESET choices prompt';
const PRESET_STATS = 'PRESET stat prompt';

const baseOverview = {
  name: 'Sedge Landing',
  description: '',
  systemPrompt: 'A drowned coast where the tide keeps what it takes.',
  tags: [],
  promptOverrides: { systemPrompt: 'You are the narrator. <LENGTH GUIDANCE>', systemPromptEnabled: true },
} as unknown as WorldOverview;

// The world under edit, mutated by the manager's own writes so a test can assert what ends up stored.
const world: { overview: WorldOverview; entities: Entity[]; locations: GameLocation[]; rerender: () => void } = {
  overview: baseOverview,
  entities: [],
  locations: [],
  rerender: () => {},
};

// A small but real authored world: the preview is supposed to read THIS, so the fixture has to be a world
// an author could plausibly have open, not an empty shell.
const locations = [
  { id: 'loc1', name: 'The Jetty', aiDescription: 'Rotting boards over black water.' },
] as unknown as GameLocation[];
const entities = [
  { id: 'ent1', name: 'Wren', aiDescription: 'A lamp-keeper who does not sleep.', locations: ['loc1'] },
] as unknown as Entity[];
const stats = [{
  id: 's1', name: 'Warmth', type: 'number', value: 7, min: 0, max: 10,
  descriptors: [{ threshold: 40, description: 'chilled' }, { threshold: 100, description: 'warm' }],
}] as unknown as Stat[];
const traits = [
  { id: 't1', name: 'Saltborn', aiDescription: 'The tide reads you as its own.', isDefault: true },
  { id: 't2', name: 'Landlocked', aiDescription: 'You have never seen the sea.', isDefault: false },
] as unknown as Trait[];

const placeholders = [{ id: 'p1', name: 'Hair Color', values: ['ash', 'copper'] }] as unknown as Placeholder[];

const dictionaries = [{
  id: 'b1', name: 'Lore', enabled: true,
  entries: [
    { id: 'd1', name: 'The Tide', key: ['tide'], value: 'It takes and does not give back.' },
    { id: 'd2', name: 'Old Law', key: ['law'], value: 'No lamps after dusk.', position: 'before' },
    { id: 'd3', name: 'Muted', key: ['muted'], value: 'Never injected.', enabled: false },
  ],
}] as unknown as Dictionary[];

vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({
    worldOverview: world.overview,
    updateWorldOverview: (patch: Partial<WorldOverview>) => {
      world.overview = { ...world.overview, ...patch };
      world.rerender();
    },
    updateEntity: (next: Entity) => {
      world.entities = world.entities.map((e) => (e.id === next.id ? next : e));
      world.rerender();
    },
    updateLocation: (next: GameLocation) => {
      world.locations = world.locations.map((l) => (l.id === next.id ? next : l));
      world.rerender();
    },
    entities: world.entities, locations: world.locations,
    stats, traits, traitGroups: [], dictionaries, placeholders,
  }),
}));
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    paragraphLimit: 'single', maxTokens: 800, markdownOutput: true,
    activeSectionStyle: 'default', limitActiveCharacters: true, activeCharacterLimit: 5,
    // Non-English on purpose: the language chip renders nothing at all for English, so an English fixture
    // could not tell the narration and choices wordings apart.
    language: 'French',
    systemPrompt: PRESET_NARRATION, choicesPrompt: PRESET_CHOICES, statUpdatesPrompt: PRESET_STATS,
  }),
}));
vi.mock('@/lib/useDanbooruTags', () => ({ useDanbooruTags: () => [] }));
// The Lexical editor itself isn't under test — what matters is which props the manager hands it, and that
// a test can drive an edit through the same `onChange` the real field fires.
const fieldProps = vi.hoisted(() => ({ byLabel: {} as Record<string, Record<string, unknown>> }));
vi.mock('@/components/prompt/PromptField', () => ({
  default: (props: { ariaLabel?: string; previewValues?: Record<string, string> }) => {
    if (props.ariaLabel) fieldProps.byLabel[props.ariaLabel] = props;
    return <div data-testid={props.ariaLabel ?? 'prompt-field'} />;
  },
}));
vi.mock('@/components/prompt/PlaceholderField', () => ({
  default: (props: { ariaLabel?: string }) => {
    if (props.ariaLabel) fieldProps.byLabel[props.ariaLabel] = props;
    return <div data-testid={props.ariaLabel ?? 'placeholder-field'} />;
  },
}));

type FocusField = FocusFieldHint | null;

/** Renders the manager against the live `world`, re-rendering whenever the manager writes to it. */
type OpenItem = (id: string) => void;
const Harness = ({ focusField, onOpenEntity, onOpenLocation }: {
  focusField?: FocusField; onOpenEntity?: OpenItem; onOpenLocation?: OpenItem;
}) => {
  const [, setTick] = useState(0);
  world.rerender = () => setTick((n) => n + 1);
  return <WorldDetailsManager focusField={focusField} onOpenEntity={onOpenEntity} onOpenLocation={onOpenLocation} />;
};

const renderManager = (advanced = true, focusField?: FocusField, onOpenEntity?: OpenItem, onOpenLocation?: OpenItem) => render(
  <EditorModeContext.Provider value={{ mode: advanced ? 'advanced' : 'simple', advanced, setMode: () => {} }}>
    <Harness focusField={focusField} onOpenEntity={onOpenEntity} onOpenLocation={onOpenLocation} />
  </EditorModeContext.Provider>,
);

/** The props the field of the open kind was last given. Only the open kind's editor is mounted. */
const field = (label: string) => fieldProps.byLabel[label];
/** The prompt-variable half of a custom prompt field: its toolbar chips and what they preview as. */
const promptChips = (label: string) => field(label).promptChips as {
  variables: Array<{ token: string }>; previewValues: Record<string, string>; sampleData?: boolean | string;
};
const edit = (label: string, text: string) =>
  act(() => (field(label).onChange as (v: string) => void)(text));
const checkbox = (kind: string) => screen.getByRole('checkbox', { name: `Use this world's ${kind} prompt` });
/** The segmented control's items are radios, not tabs — this picker clears on re-selection. */
const picker = (name: string) => screen.getByRole('radio', { name });
const openKind = () => screen.getAllByRole('radio').filter((r) => r.getAttribute('data-state') === 'on')
  .map((r) => r.textContent);

beforeEach(() => {
  world.overview = { ...baseOverview, promptOverrides: { ...baseOverview.promptOverrides } };
  world.entities = entities;
  world.locations = locations;
  fieldProps.byLabel = {};
});

describe('the custom prompts section', () => {
  it('is hidden in Simple mode, prompts or not', () => {
    renderManager(false);
    expect(screen.queryByText('Custom Prompts')).not.toBeInTheDocument();
    expect(screen.queryByTestId('World narration prompt')).not.toBeInTheDocument();
  });

  it('opens with nothing selected, so an author not writing prompts sees no editor', () => {
    renderManager();

    expect(screen.getByText('Custom Prompts')).toBeInTheDocument();
    expect(openKind()).toEqual([]);
    expect(screen.queryByTestId('World narration prompt')).not.toBeInTheDocument();
  });

  it('shows every kind’s enabled state without opening any of them', () => {
    world.overview.promptOverrides = {
      systemPrompt: 'authored', systemPromptEnabled: true,
      choicesPrompt: 'authored but off', choicesPromptEnabled: false,
    };
    renderManager();

    // Nothing is open, so the chrome is the only place these states can be read.
    expect(checkbox('narration')).toBeChecked();
    expect(checkbox('choices')).not.toBeChecked();
    expect(checkbox('stats')).not.toBeChecked();
  });

  it('closes the open kind when it is picked again', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(picker('Choices'));
    expect(screen.getByTestId('World choices prompt')).toBeInTheDocument();

    await user.click(picker('Choices'));
    expect(screen.queryByTestId('World choices prompt')).not.toBeInTheDocument();
    expect(openKind()).toEqual([]);
  });

  it('opens the kind whose checkbox is switched on, and switches it on', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(checkbox('choices'));

    expect(world.overview.promptOverrides?.choicesPromptEnabled).toBe(true);
    expect(screen.getByTestId('World choices prompt')).toBeInTheDocument();
  });

  it('does not open a kind whose checkbox is switched off', async () => {
    const user = userEvent.setup();
    world.overview.promptOverrides = { choicesPrompt: 'authored', choicesPromptEnabled: true };
    renderManager();
    await user.click(checkbox('choices'));

    // Switching something off is not a request to look at it — the panel must not grow under the click.
    expect(world.overview.promptOverrides?.choicesPromptEnabled).toBe(false);
    expect(openKind()).toEqual([]);
    expect(screen.queryByTestId('World choices prompt')).not.toBeInTheDocument();
  });

  it('leaves the open kind open when a different one is switched off', async () => {
    const user = userEvent.setup();
    world.overview.promptOverrides = { statUpdatesPrompt: 'authored', statUpdatesPromptEnabled: true };
    renderManager();
    await user.click(picker('Choices'));
    await user.click(checkbox('stats'));

    expect(screen.getByTestId('World choices prompt')).toBeInTheDocument();
  });

  it('only opens when the picker itself is clicked', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(picker('Stats'));

    expect(screen.getByTestId('World stats prompt')).toBeInTheDocument();
    // Browsing must never enable anything, and must not write to the world at all.
    expect(checkbox('stats')).not.toBeChecked();
    expect(world.overview.promptOverrides?.statUpdatesPromptEnabled).toBeUndefined();
  });

  it('keeps a switched-off kind editable, and says it is not applied', async () => {
    const user = userEvent.setup();
    world.overview.promptOverrides = { choicesPrompt: 'drafted', choicesPromptEnabled: false };
    renderManager();
    await user.click(picker('Choices'));

    expect(field('World choices prompt').value).toBe('drafted');
    expect(screen.getByText(/Not applied until you switch this one on/)).toBeInTheDocument();
  });

  it('switching a kind off keeps the text it holds', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(checkbox('narration'));

    expect(world.overview.promptOverrides?.systemPromptEnabled).toBe(false);
    expect(world.overview.promptOverrides?.systemPrompt).toBe('You are the narrator. <LENGTH GUIDANCE>');
  });
});

describe('the live template and the freeze', () => {
  it('opens an unwritten kind on the prompt the game runs right now, storing nothing', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(picker('Choices'));

    expect(field('World choices prompt').value).toBe(PRESET_CHOICES);
    expect(screen.getByText(/Shows your current choices prompt/)).toBeInTheDocument();
    expect(world.overview.promptOverrides?.choicesPrompt).toBeUndefined();
  });

  it('stores the text on the first edit that diverges from the template', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(picker('Choices'));
    edit('World choices prompt', `${PRESET_CHOICES} — but colder`);

    expect(world.overview.promptOverrides?.choicesPrompt).toBe(`${PRESET_CHOICES} — but colder`);
    // Not switched on by writing it: enabling is the checkbox's job, and drafting is allowed.
    expect(world.overview.promptOverrides?.choicesPromptEnabled).toBe(false);
  });

  it('does not freeze a template that came back unchanged', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(picker('Stats'));
    edit('World stats prompt', PRESET_STATS);

    // The field echoes its value on mount and on any no-op edit; that must not become an authored prompt.
    expect(world.overview.promptOverrides?.statUpdatesPrompt).toBeUndefined();
  });

  it('keeps an edited kind on its own text as the preset moves on', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(picker('Choices'));
    edit('World choices prompt', 'my own choices prompt');

    expect(field('World choices prompt').value).toBe('my own choices prompt');
  });
});

/** Renders and opens Narration, the one kind the fixture world has authored. */
const openNarration = async () => {
  const user = userEvent.setup();
  renderManager();
  await user.click(picker('Narration'));
  return user;
};

describe('resetting a kind', () => {
  it('offers Reset only for a kind the author actually wrote', async () => {
    const user = await openNarration();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument(); // narration is stored

    await user.click(picker('Choices'));
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
  });

  it('asks first, in that kind’s own words, and a cancel keeps the authored text', async () => {
    const user = await openNarration();
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    // One dialog serves every panel, the cue included — it has to name the one being discarded.
    expect(screen.getByText("Discard this world's narration prompt?")).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(world.overview.promptOverrides?.systemPrompt).toBe('You are the narrator. <LENGTH GUIDANCE>');
  });

  it('drops the stored text and returns it to the live prompt', async () => {
    const user = await openNarration();
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(world.overview.promptOverrides?.systemPrompt).toBeUndefined();
    expect(field('World narration prompt').value).toBe(PRESET_NARRATION);
    // The switch itself is untouched — reset discards authored text, it does not decline the feature.
    expect(world.overview.promptOverrides?.systemPromptEnabled).toBe(true);
  });
});

const previewValues = async () => {
  await openNarration();
  return promptChips('World narration prompt').previewValues;
};

describe('the world narration prompt field', () => {
  it('gives the editor something to preview, so it offers Preview and the split view', async () => {
    await openNarration();
    const props = field('World narration prompt');

    // PromptField gates its Edit/Preview tabs — and the split view built on them — on having values to
    // resolve chips against. Without these the field is a bare textarea.
    expect(props).toBeDefined();
    const chips = promptChips('World narration prompt');
    expect(Object.keys(chips.previewValues).length).toBeGreaterThan(0);
    expect(chips.sampleData).toBe('Your world, sample turn');
  });

  it('previews the world being edited, not the shared sample world', async () => {
    const values = await previewValues();

    expect(values['<LOCATION>']).toContain('The Jetty');
    expect(values['<ENTITIES>']).toContain('Wren');
    expect(values['<WORLD DESCRIPTION>']).toContain('drowned coast');
    // The sample pool's own location must not show through where the world can answer.
    expect(values['<LOCATION>']).not.toContain('The Landing');
  });

  it('previews the stats and default traits the world actually starts with', async () => {
    const values = await previewValues();

    expect(values['<STATS DESCRIPTION>']).toContain('Warmth');
    expect(values['<TRAITS DESCRIPTION>']).toContain('Saltborn');
    // Not chosen at character creation, so it is not part of the opening the author is previewing.
    expect(values['<TRAITS DESCRIPTION>']).not.toContain('Landlocked');
  });

  it('carries every format variant, not just the plain one', async () => {
    const values = await previewValues();

    expect(values['<LOCATION|markdown>']).toContain('**name:**');
    expect(values['<LOCATION|xml>']).toContain('<name>');
    expect(values['<ENTITIES|name>']).toBe('Wren');
  });

  it('previews the world’s own lore, split into the two blocks the game fills', async () => {
    const values = await previewValues();

    // Nothing has been typed, so no keyword has fired — the preview shows what this world could inject.
    expect(values['<DICTIONARY>']).toContain('It takes and does not give back.');
    expect(values['<DICTIONARY|before>']).toContain('No lamps after dusk.');
    // Position decides the block; an entry must not appear in both.
    expect(values['<DICTIONARY>']).not.toContain('No lamps after dusk.');
    // A disabled entry never reaches a prompt, so it must not reach the preview either.
    expect(values['<DICTIONARY>']).not.toContain('Never injected.');
    expect(values['<DICTIONARY|before>']).not.toContain('Never injected.');
  });

  it('falls back to the samples for what only a turn can answer', async () => {
    const values = await previewValues();

    // No playthrough exists, so these have no authored answer — they must still resolve to something
    // rather than rendering as a raw token in the preview.
    expect(values['<PLAYER ACTION>']).toBeTruthy();
    expect(values['<NARRATION>']).toBeTruthy();
  });

  it('previews the guidance built from the player’s own settings, not a stand-in', async () => {
    const values = await previewValues();

    // The mocked setting above is 'single'; a hardcoded sample would not track it.
    expect(values['<LENGTH GUIDANCE>']).toBe('Write a single paragraph.');
  });

  it('hands the field the world’s placeholders, so their chips work in a custom prompt', async () => {
    await openNarration();
    expect(field('World narration prompt').placeholders).toBe(placeholders);
  });

  it('gives each kind its own chip palette', async () => {
    const user = await openNarration();
    const narrationVars = promptChips('World narration prompt').variables;
    await user.click(picker('Choices'));
    const choicesVars = promptChips('World choices prompt').variables;

    // Length and markdown guidance are narration-only: the choices pass has nowhere to put them.
    expect(narrationVars.map((v) => v.token)).toContain('<LENGTH GUIDANCE>');
    expect(choicesVars.map((v) => v.token)).not.toContain('<LENGTH GUIDANCE>');
    // The language chip is offered on both, since both are prompts the player reads the output of.
    expect(narrationVars.map((v) => v.token)).toContain('<LANGUAGE>');
    expect(choicesVars.map((v) => v.token)).toContain('<LANGUAGE>');
  });

  it('previews the language chip in the wording the open kind will actually send', async () => {
    const languageOf = (label: string) =>
      promptChips(label).previewValues['<LANGUAGE>'];
    const user = await openNarration();
    expect(languageOf('World narration prompt')).toBe('Write all narration in French.');
    await user.click(picker('Choices'));
    expect(languageOf('World choices prompt')).toBe('Write all choices in French.');
  });
});

const openingsCheckbox = () => screen.getByRole('checkbox', { name: "Use this world's openings" });
const ROWS = [
  { id: 'o1', text: 'You wake in the reed-beds.', kind: 'action' as const },
  { id: 'o2', text: 'The ferry bell rings twice.', kind: 'action' as const },
];

describe('the openings panel', () => {
  /** Opens the panel by picking it — browsing, which must leave the world untouched. */
  const browse = async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(picker('Openings'));
    return user;
  };

  it('is hidden in Simple mode', () => {
    renderManager(false);
    expect(screen.queryByRole('radio', { name: 'Openings' })).not.toBeInTheDocument();
  });

  it('reads off and takes no click while the world has no opening, and browsing writes nothing', async () => {
    const before = world.overview;
    await browse();
    // Nothing to switch: a click would write a flag that derives off again, so the box is disabled.
    expect(openingsCheckbox()).not.toBeChecked();
    expect(openingsCheckbox()).toBeDisabled();
    expect(world.overview).toBe(before);
  });

  it('shows the default opening text read-only at a lone start where nothing can come up', async () => {
    await browse();
    expect(screen.getByText('No opening can come up at The Jetty, so a game there starts on the text below')).toBeInTheDocument();
    expect(screen.getByRole('note', { name: 'Default Opening' })).toHaveTextContent(OPENING_SCENE_CUE);
    expect(screen.queryByTestId('Opening 1')).not.toBeInTheDocument();
  });

  it('shows the default opening unnamed in a world with no locations', async () => {
    world.locations = [];
    await browse();
    expect(screen.getByText('No opening can come up, so every game starts on the text below')).toBeInTheDocument();
    expect(screen.getByRole('note', { name: 'Default Opening' })).toHaveTextContent(OPENING_SCENE_CUE);
  });

  it('switches on and takes clicks as soon as the author writes an opening', async () => {
    const user = await browse();
    await user.click(screen.getByRole('button', { name: /Add Opening/ }));
    edit('Opening 1', 'You wake in the reed-beds.');

    expect(openingsCheckbox()).toBeChecked();
    expect(openingsCheckbox()).toBeEnabled();
    await user.click(openingsCheckbox());
    expect(world.overview.openingsEnabled).toBe(false);
    expect(openingsCheckbox()).not.toBeChecked();
  });

  it('adds a row and writes its text, chips palette and all', async () => {
    const user = await browse();
    await user.click(screen.getByRole('button', { name: /Add Opening/ }));
    expect(world.overview.openings).toEqual([{ id: expect.any(String), text: '', kind: 'action' }]);
    expect(field('Opening 1').placeholders).toEqual(placeholders);

    edit('Opening 1', 'You wake in the reed-beds.');
    expect(world.overview.openings?.[0].text).toBe('You wake in the reed-beds.');
    expect(screen.queryByRole('note', { name: 'Default Opening' })).not.toBeInTheDocument();
  });

  it('shows each row’s chance from its weight, and keeps a weight 0 row', async () => {
    world.overview.openings = ROWS;
    const user = await browse();
    expect(screen.getByLabelText('Chance for Opening 1')).toHaveTextContent('50%');

    const weight2 = screen.getByLabelText('Draw weight for Opening 2');
    await user.clear(weight2);
    await user.type(weight2, '3');
    expect(world.overview.openingWeights).toEqual({ o2: 3 });
    expect(screen.getByLabelText('Chance for Opening 1')).toHaveTextContent('25%');
    expect(screen.getByLabelText('Chance for Opening 2')).toHaveTextContent('75%');

    await user.clear(screen.getByLabelText('Draw weight for Opening 1'));
    expect(world.overview.openingWeights).toEqual({ o1: 0, o2: 3 });
    expect(screen.getByLabelText('Chance for Opening 1')).toHaveTextContent('0%');
    expect(screen.getAllByTestId('opening-row')).toHaveLength(2);
  });

  it('sets how a row opens with a two-value toggle, not tabs', async () => {
    world.overview.openings = ROWS;
    const user = await browse();
    const opensAs = within(screen.getByRole('radiogroup', { name: 'Opens As, Opening 2' }));
    expect(opensAs.getByRole('radio', { name: 'Player Action' })).toBeChecked();
    expect(screen.queryByRole('tab', { name: 'Narration' })).not.toBeInTheDocument();

    await user.click(opensAs.getByRole('radio', { name: 'Narration' }));
    expect(world.overview.openings).toEqual([ROWS[0], { ...ROWS[1], kind: 'narration' }]);
    expect(opensAs.getByRole('radio', { name: 'Narration' })).toBeChecked();

    // Pressing the value already set keeps it: a row always has a kind.
    await user.click(opensAs.getByRole('radio', { name: 'Narration' }));
    expect(world.overview.openings?.[1].kind).toBe('narration');
  });

  it('drops a removed row together with its weight', async () => {
    world.overview.openings = ROWS;
    world.overview.openingWeights = { o1: 2, o2: 5 };
    const user = await browse();
    await user.click(screen.getByRole('button', { name: 'Remove Opening 2' }));
    expect(world.overview.openings).toEqual([ROWS[0]]);
    expect(world.overview.openingWeights).toEqual({ o1: 2 });
  });

  it('switching the list off keeps the rows, and leaves the panel open', async () => {
    world.overview.openings = ROWS;
    const user = await browse();
    await user.click(openingsCheckbox());
    expect(world.overview.openingsEnabled).toBe(false);
    expect(world.overview.openings).toEqual(ROWS);
    expect(screen.getAllByTestId('opening-row')).toHaveLength(2);
    expect(screen.getByText(/Switched off, so players start on the default opening/)).toBeInTheDocument();

    await user.click(openingsCheckbox());
    expect(world.overview.openingsEnabled).toBeUndefined();
  });

  it('opens the panel when the find bar navigates to a row', () => {
    world.overview.openings = ROWS;
    // The find bar is the only way to reach a panel that is not showing.
    renderManager(true, { fieldKey: openingFieldKey('o2'), itemId: null });
    expect(field('Opening 2').value).toBe('The ferry bell rings twice.');
  });

  describe('collapsing', () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({
      id: `c${i + 1}`, text: `Line ${i + 1}\nSecond line ${i + 1}`, kind: 'action' as const,
    }));
    const textBoxes = () => screen.queryAllByTestId(/^Opening \d+$/);
    const collapseAll = () => screen.getByRole('button', { name: /^(Collapse|Expand) all openings$/ });

    it('opens a list of two rows expanded', async () => {
      world.overview.openings = rows(2);
      await browse();
      expect(textBoxes()).toHaveLength(2);
    });

    it('opens a list of three rows collapsed, each on its first line with an ellipsis', async () => {
      world.overview.openings = rows(3);
      await browse();
      expect(textBoxes()).toHaveLength(0);
      expect(screen.getByRole('button', { name: 'Expand Opening 2' })).toHaveTextContent('Opening 2Line 2 …');
    });

    it('opens a row added to a collapsed list expanded', async () => {
      world.overview.openings = rows(3);
      const user = await browse();
      await user.click(screen.getByRole('button', { name: /Add Opening/ }));
      expect(textBoxes().map((b) => b.dataset.testid)).toEqual(['Opening 4']);
    });

    it('takes every card down and back up in one press', async () => {
      world.overview.openings = rows(2);
      const user = await browse();
      await user.click(collapseAll());
      expect(textBoxes()).toHaveLength(0);
      await user.click(collapseAll()); // now reading 'Expand all openings'
      expect(textBoxes()).toHaveLength(2);
    });

    it('is not offered for a lone opening', async () => {
      world.overview.openings = rows(1);
      await browse();
      expect(screen.queryByRole('button', { name: /all openings$/ })).not.toBeInTheDocument();
    });

    it('keeps the kind, weight and remove live on a collapsed card', async () => {
      world.overview.openings = rows(3);
      const user = await browse();
      const opensAs = within(screen.getByRole('radiogroup', { name: 'Opens As, Opening 2' }));
      await user.click(opensAs.getByRole('radio', { name: 'Narration' }));
      expect(world.overview.openings?.[1].kind).toBe('narration');

      const weight = screen.getByLabelText('Draw weight for Opening 2');
      await user.clear(weight);
      await user.type(weight, '3');
      expect(world.overview.openingWeights).toEqual({ c2: 3 });
      expect(screen.getByLabelText('Chance for Opening 2')).toHaveTextContent('60%');

      await user.click(screen.getByRole('button', { name: 'Remove Opening 3' }));
      expect(world.overview.openings?.map((o) => o.id)).toEqual(['c1', 'c2']);
      expect(textBoxes()).toHaveLength(0);
    });

    it('reorders collapsed cards by keyboard drag', async () => {
      world.overview.openings = rows(3);
      // jsdom lays nothing out; stack the rows 40px apart so the keyboard sensor can find a neighbor.
      const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        const row = this.closest<HTMLElement>('[data-testid="opening-row"]');
        const i = row ? [...row.parentElement!.children].indexOf(row) : 0;
        return DOMRect.fromRect({ x: 0, y: i * 40, width: 300, height: 36 });
      });
      const user = await browse();
      screen.getByRole('button', { name: 'Reorder Opening 3' }).focus();
      await user.keyboard('[Space]');
      await user.keyboard('[ArrowUp]');
      await user.keyboard('[Space]');
      rect.mockRestore();
      expect(world.overview.openings?.map((o) => o.id)).toEqual(['c1', 'c3', 'c2']);
    });
  });
});

describe('the mirrored openings panel', () => {
  const dock = { id: 'dock', name: 'The Dock', isStarting: true } as unknown as GameLocation;
  const market = { id: 'market', name: 'The Market', isStarting: true } as unknown as GameLocation;
  const cave = { id: 'cave', name: 'The Cave' } as unknown as GameLocation;
  const guide = {
    id: 'guide', name: 'Guide', locations: ['dock'],
    openings: [{ id: 'g1', text: 'The guide waves.', kind: 'action' }, { id: 'g2', text: 'The guide sighs.', kind: 'narration' }],
  } as unknown as Entity;
  const hermit = {
    id: 'hermit', name: 'Hermit', locations: ['cave'],
    openings: [{ id: 'h1', text: 'A cough in the dark.', kind: 'action' }],
  } as unknown as Entity;
  const plain = { id: 'plain', name: 'Plain', locations: ['dock'] } as unknown as Entity;

  const open = async (onOpenEntity?: OpenItem, onOpenLocation?: OpenItem) => {
    const user = userEvent.setup();
    renderManager(true, undefined, onOpenEntity, onOpenLocation);
    await user.click(picker('Openings'));
    return user;
  };
  const groups = () => screen.queryAllByTestId('opening-group').map((g) => g.getAttribute('aria-label'));
  const chance = (label: string) => screen.getByLabelText(`Chance for ${label}`).textContent;
  const guideNow = () => world.entities.find((e) => e.id === 'guide')!;

  beforeEach(() => {
    world.overview = { ...world.overview, openings: [ROWS[0]] };
    world.entities = [guide, plain, hermit];
    world.locations = [dock, cave];
  });

  it('lists the world’s rows, then one group per entity with openings, and follows the entities', async () => {
    await open();
    expect(screen.getByRole('region', { name: 'This World' })).toBeInTheDocument();
    expect(groups()).toEqual(['Guide', 'Hermit']);
    expect(within(screen.getByRole('region', { name: 'Guide' })).getAllByTestId('opening-row')).toHaveLength(2);

    act(() => {
      world.entities = [hermit, { ...plain, openings: [{ id: 'p1', text: 'Hello.', kind: 'action' }] }];
      world.rerender();
    });
    expect(groups()).toEqual(['Hermit', 'Plain']);
  });

  it('writes an edit, a weight, an add and a remove in an entity’s group to that entity', async () => {
    const user = await open();
    const before = world.overview;

    edit('Guide Opening 1', 'The guide bows.');
    expect(guideNow().openings?.[0].text).toBe('The guide bows.');

    const weight = screen.getByLabelText('Draw weight for Guide Opening 2');
    await user.clear(weight);
    await user.type(weight, '3');
    expect(guideNow().openingWeights).toEqual({ g2: 3 });

    const addToGuide = screen.getByRole('button', { name: 'Add Opening to Guide' });
    expect(addToGuide).toHaveTextContent('Add Opening to Guide');
    await user.click(addToGuide);
    expect(guideNow().openings).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Remove Guide Opening 2' }));
    expect(guideNow().openings?.map((o) => o.id)).toEqual(['g1', expect.any(String)]);
    expect(guideNow().openingWeights).toBeUndefined();

    expect(world.overview.openings).toEqual(before.openings);
  });

  it('reorders an entity’s rows by keyboard drag, on that entity', async () => {
    // jsdom lays nothing out; stack the rows 100px apart so the keyboard sensor can find a neighbor.
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const row = this.closest<HTMLElement>('[data-testid="opening-row"]');
      const i = row ? [...row.parentElement!.children].indexOf(row) : 0;
      return DOMRect.fromRect({ x: 0, y: i * 100, width: 300, height: 90 });
    });
    const user = await open();
    screen.getByRole('button', { name: 'Reorder Guide Opening 2' }).focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowUp]');
    await user.keyboard('[Space]');
    rect.mockRestore();
    expect(guideNow().openings?.map((o) => o.id)).toEqual(['g2', 'g1']);
    expect(world.overview.openings).toEqual([ROWS[0]]);
  });

  it('shows each row’s share of the whole pool, and a dash for an entity elsewhere', async () => {
    await open();
    expect(chance('Opening 1')).toBe('33%');
    expect(chance('Guide Opening 1')).toBe('33%');
    expect(chance('Guide Opening 2')).toBe('33%');
    expect(chance('Hermit Opening 1')).toBe('—');
    expect(screen.queryByRole('combobox', { name: 'Starting Location' })).not.toBeInTheDocument();
  });

  it('marks an entity at no starting location with a named term, not color alone', async () => {
    await open();
    expect(within(screen.getByRole('region', { name: 'Hermit' })).getByText('No Starting Location')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Guide' })).queryByText('No Starting Location')).not.toBeInTheDocument();
  });

  describe('Self rows', () => {
    const warden = {
      id: 'warden', name: 'Warden', persona: true, locations: ['dock'],
      openings: [
        { id: 'w1', text: 'The warden nods.', kind: 'action' },
        { id: 's1', text: 'You take the lamp.', kind: 'narration', self: true },
        { id: 's2', text: 'You bar the gate.', kind: 'narration', self: true },
      ],
      openingWeights: { s2: 3 },
    } as unknown as Entity;
    const selfBadges = (region: string) => within(screen.getByRole('region', { name: region }))
      .queryAllByText('Self').filter((el) => !el.closest('[role="radio"]'));
    const drawnFor = (label: string) => screen.queryByRole('radiogroup', { name: `Drawn For, ${label}` });

    it('show in their persona’s group with a Self badge and their share of its Self rows', async () => {
      world.entities = [guide, warden];
      await open();
      expect(within(screen.getByRole('region', { name: 'Warden' })).getAllByTestId('opening-row')).toHaveLength(3);
      expect(selfBadges('Warden')).toHaveLength(2);
      expect(chance('Warden Opening 2')).toBe('25%');
      expect(chance('Warden Opening 3')).toBe('75%');
      // The Others row still shares the pool at the start with the world's and the guide's rows.
      expect(chance('Warden Opening 1')).toBe('25%');
      expect(chance('Guide Opening 1')).toBe('25%');
    });

    it('put the Others | Self switch on a persona’s rows only', async () => {
      world.entities = [guide, warden];
      await open();
      expect(drawnFor('Warden Opening 1')).toBeInTheDocument();
      expect(drawnFor('Guide Opening 1')).toBeNull();
      expect(drawnFor('Opening 1')).toBeNull();
    });

    it('write a flip to the persona, keeping the rest of the row', async () => {
      world.entities = [guide, warden];
      const user = await open();
      await user.click(within(drawnFor('Warden Opening 1')!).getByRole('radio', { name: 'Self' }));
      const next = world.entities.find((e) => e.id === 'warden')!;
      expect(next.openings?.[0]).toEqual({ id: 'w1', text: 'The warden nods.', kind: 'action', self: true });
      expect(next.openingWeights).toEqual({ s2: 3 });
    });

    it('hide on an entity without the Persona mark, with its group when they are all it has', async () => {
      world.entities = [guide, { ...warden, persona: undefined }, { ...warden, id: 'former', name: 'Former', persona: undefined, openings: warden.openings!.slice(1) }];
      await open();
      expect(groups()).toEqual(['Guide', 'Warden']);
      expect(within(screen.getByRole('region', { name: 'Warden' })).getAllByTestId('opening-row')).toHaveLength(1);
      expect(selfBadges('Warden')).toHaveLength(0);
    });

    it('take no No Starting Location badge when a persona has only Self rows', async () => {
      world.locations = [dock, market];
      world.entities = [guide, { ...warden, locations: ['cave'], openings: warden.openings!.slice(1) }];
      await open();
      const group = within(screen.getByRole('region', { name: 'Warden' }));
      expect(group.queryByText('No Starting Location')).not.toBeInTheDocument();
      expect(chance('Warden Opening 1')).toBe('25%');
    });
  });

  describe('the Starting Location filter', () => {
    const dockRow = { id: 'd1', text: 'Gulls fight over the nets.', kind: 'narration' as const };
    const warden = {
      id: 'warden', name: 'Warden', persona: true, locations: ['market'],
      openings: [
        { id: 'w1', text: 'The warden nods.', kind: 'action' },
        { id: 's1', text: 'You take the lamp.', kind: 'narration', self: true },
        { id: 's2', text: 'You bar the gate.', kind: 'narration', self: true },
      ],
      openingWeights: { s2: 3 },
    } as unknown as Entity;
    const filter = () => screen.getByRole('combobox', { name: 'Starting Location' });
    const pick = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
      await user.click(filter());
      await user.click(screen.getByRole('option', { name }));
    };
    const regions = () => screen.getAllByRole('region').map((g) => g.getAttribute('aria-label'));
    const defaultCard = () => screen.queryByRole('note', { name: 'Default Opening' });

    beforeEach(() => {
      world.locations = [{ ...dock, openings: [dockRow] }, market];
      world.entities = [guide, { ...hermit, locations: ['market'] }, warden];
    });

    it('opens on All Locations, listed before each starting location by name', async () => {
      const user = await open();
      expect(filter()).toHaveTextContent('All Locations');
      await user.click(filter());
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['All Locations', 'The Dock', 'The Market']);
    });

    it('shows every group under All Locations, with a chance on Self rows only', async () => {
      await open();
      expect(regions()).toEqual(['This World', 'The Dock', 'Guide', 'Hermit', 'Warden']);
      for (const row of ['Opening 1', 'The Dock Opening 1', 'Guide Opening 1', 'Hermit Opening 1', 'Warden Opening 1']) {
        expect(chance(row)).toBe('—');
      }
      expect(chance('Warden Opening 2')).toBe('25%');
      expect(chance('Warden Opening 3')).toBe('75%');
      expect(screen.queryByText(/Not at/)).not.toBeInTheDocument();
    });

    it('keeps what can draw at a picked start, and an absent persona’s Self rows, with their chances', async () => {
      const user = await open();
      await pick(user, 'The Dock');
      expect(regions()).toEqual(['This World', 'The Dock', 'Guide', 'Warden']);
      expect(['Opening 1', 'The Dock Opening 1', 'Guide Opening 1', 'Guide Opening 2'].map(chance)).toEqual(['25%', '25%', '25%', '25%']);
      // The Warden stands elsewhere: its Others row leaves, and its Self rows keep their own shares.
      expect(within(screen.getByRole('region', { name: 'Warden' })).getAllByTestId('opening-row')).toHaveLength(2);
      expect(['Warden Opening 2', 'Warden Opening 3'].map(chance)).toEqual(['25%', '75%']);

      await pick(user, 'The Market');
      expect(regions()).toEqual(['This World', 'Hermit', 'Warden']);
      expect(['Opening 1', 'Hermit Opening 1', 'Warden Opening 1'].map(chance)).toEqual(['33%', '33%', '33%']);
      expect(['Warden Opening 2', 'Warden Opening 3'].map(chance)).toEqual(['25%', '75%']);

      await pick(user, 'All Locations');
      expect(regions()).toEqual(['This World', 'The Dock', 'Guide', 'Hermit', 'Warden']);
      expect(world.overview).not.toHaveProperty('startingLocationId');
    });

    it('shows the default opening at a picked start only when nothing can come up there', async () => {
      world.overview = { ...world.overview, openings: [] };
      world.locations = [dock, market];
      world.entities = [guide];
      const user = await open();
      await pick(user, 'The Dock');
      expect(defaultCard()).not.toBeInTheDocument();
      expect(within(screen.getByRole('region', { name: 'This World' })).getByText('No openings yet')).toBeInTheDocument();

      await pick(user, 'The Market');
      expect(defaultCard()).toHaveTextContent(OPENING_SCENE_CUE);
      expect(screen.getByText('No opening can come up at The Market, so a game there starts on the text below')).toBeInTheDocument();
    });

    it('names, under All Locations, every start that gets the default opening, and hides it when none does', async () => {
      world.overview = { ...world.overview, openings: [] };
      world.locations = [dock, market];
      world.entities = [];
      await open();
      expect(defaultCard()).toBeInTheDocument();
      expect(screen.getByText('No opening can come up at The Dock or The Market, so a game there starts on the text below'))
        .toBeInTheDocument();

      act(() => {
        world.entities = [guide];
        world.rerender();
      });
      expect(screen.getByText(/^No opening can come up at The Market,/)).toBeInTheDocument();

      act(() => {
        world.overview = { ...world.overview, openings: [ROWS[0]] };
        world.rerender();
      });
      expect(defaultCard()).not.toBeInTheDocument();
      expect(screen.queryByText(/No opening can come up/)).not.toBeInTheDocument();
    });
  });

  it('keeps the chances with the switch off, and says the list is off', async () => {
    world.overview = { ...world.overview, openingsEnabled: false };
    await open();
    expect(chance('Guide Opening 1')).toBe('33%');
    expect(screen.getByText(/Switched off, so players start on the default opening/)).toBeInTheDocument();
  });

  it('opens the entity’s Openings tab from its group header', async () => {
    const onOpenEntity = vi.fn();
    const user = await open(onOpenEntity);
    await user.click(screen.getByRole('button', { name: 'Guide' }));
    expect(onOpenEntity).toHaveBeenCalledWith('guide');
  });

  describe('location groups', () => {
    const dockRow = { id: 'd1', text: 'Gulls fight over the nets.', kind: 'narration' as const };
    const caveRow = { id: 'c1', text: 'Water drips in the dark.', kind: 'action' as const };
    const withRows = (loc: GameLocation, row: typeof dockRow | typeof caveRow) => ({ ...loc, openings: [row] });
    const dockNow = () => world.locations.find((l) => l.id === 'dock')!;

    beforeEach(() => {
      world.locations = [withRows(dock, dockRow), withRows(cave, caveRow)];
    });

    it('run World, then Locations in editor order, then Entities', async () => {
      await open();
      expect(screen.getAllByRole('region').map((g) => g.getAttribute('aria-label')))
        .toEqual(['This World', 'The Dock', 'The Cave', 'Guide', 'Hermit']);
    });

    it('show a location’s share of the pool at its own start, and a dash and the badge where it isn’t one', async () => {
      await open();
      expect(chance('The Dock Opening 1')).toBe('25%');
      expect(chance('Guide Opening 1')).toBe('25%');
      expect(chance('The Cave Opening 1')).toBe('—');
      expect(within(screen.getByRole('region', { name: 'The Cave' })).getByText('No Starting Location')).toBeInTheDocument();
      expect(within(screen.getByRole('region', { name: 'The Dock' })).queryByText('No Starting Location')).not.toBeInTheDocument();
    });

    it('write an edit, a weight and an add to that location, with no Others | Self switch', async () => {
      const user = await open();
      edit('The Dock Opening 1', 'The tide is out.');
      expect(dockNow().openings?.[0].text).toBe('The tide is out.');

      const weight = screen.getByLabelText('Draw weight for The Dock Opening 1');
      await user.clear(weight);
      await user.type(weight, '2');
      expect(dockNow().openingWeights).toEqual({ d1: 2 });

      await user.click(screen.getByRole('button', { name: 'Add Opening to The Dock' }));
      expect(dockNow().openings).toHaveLength(2);
      expect(screen.queryByRole('radiogroup', { name: /^Drawn For, The Dock/ })).toBeNull();
      expect(world.entities.find((e) => e.id === 'dock')).toBeUndefined();
    });

    it('open the location’s Openings tab from the group header', async () => {
      const onOpenLocation = vi.fn();
      const onOpenEntity = vi.fn();
      const user = await open(onOpenEntity, onOpenLocation);
      await user.click(screen.getByRole('button', { name: 'The Dock' }));
      expect(onOpenLocation).toHaveBeenCalledWith('dock');
      expect(onOpenEntity).not.toHaveBeenCalled();
    });

    it('are covered by the search', async () => {
      const user = await open();
      await user.type(screen.getByPlaceholderText('Search openings'), 'gulls');
      expect(screen.getAllByRole('region').map((g) => g.getAttribute('aria-label'))).toEqual(['The Dock']);
      expect(screen.getAllByTestId('opening-row')).toHaveLength(1);
    });

    it('switch the list on by themselves', async () => {
      world.overview = { ...world.overview, openings: [] };
      world.entities = [plain];
      await open();
      expect(openingsCheckbox()).toBeChecked();
    });
  });
});
