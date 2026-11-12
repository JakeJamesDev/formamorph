import { useState } from 'react';
import { readValue, type TokenValues } from '@/lib/promptValues';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Dictionary, Entity, FocusFieldHint, GameLocation, Placeholder, Stat, StatGroup, Trait, WorldOverview } from '@/types';
import { EditorModeContext } from '@/lib/editorMode';
import WorldDetailsManager from './WorldDetailsManager';
import { overviewPanelTabsFor, type OverviewPlace } from '@/views/overviewPanelTabs';

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
  id: 's1', name: 'Warmth', type: 'number', value: 7, min: 0, max: 10, groupId: 'g1',
  descriptors: [{ threshold: 40, description: 'chilled' }, { threshold: 100, description: 'warm' }],
}] as unknown as Stat[];
const statGroups: StatGroup[] = [{ id: 'g1', name: 'Body', aiDescription: 'What the cold takes.', parentId: null }];
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
    stats, statGroups, traits, traitGroups: [], dictionaries, placeholders,
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
  default: (props: { ariaLabel?: string; previewValues?: TokenValues }) => {
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
const Harness = ({ advanced, focusField }: { advanced: boolean; focusField?: FocusField }) => {
  const [, setTick] = useState(0);
  // The World Editor holds the shown tab and prompt kind in the app.
  const [place, setPlace] = useState<OverviewPlace>({ tab: 'details', kind: 'narration' });
  world.rerender = () => setTick((n) => n + 1);
  return (
    <WorldDetailsManager
      focusField={focusField} place={place} onPlaceChange={setPlace} tabs={overviewPanelTabsFor(advanced)}
    />
  );
};

const renderManager = (advanced = true, focusField?: FocusField) => render(
  <EditorModeContext.Provider value={{ mode: advanced ? 'advanced' : 'simple', advanced, setMode: () => {} }}>
    <Harness advanced={advanced} focusField={focusField} />
  </EditorModeContext.Provider>,
);

/** The props the field of the open kind was last given. Only the open kind's editor is mounted. */
const field = (label: string) => fieldProps.byLabel[label];
/** The prompt-variable half of a custom prompt field: its toolbar chips and what they preview as. */
const promptChips = (label: string) => field(label).promptChips as {
  variables: Array<{ token: string }>; previewValues: TokenValues; sampleData?: boolean | string;
};
const edit = (label: string, text: string) =>
  act(() => (field(label).onChange as (v: string) => void)(text));

const overviewTab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'Overview Fields' })).getByRole('tab', { name });
const kindList = () => within(screen.getByRole('list', { name: 'Custom Prompt Kinds' }));
/** A kind's status row; its name reads "<Kind>, Custom" or "<Kind>, Default". */
const kindRow = (name: string) => kindList().getByRole('button', { name: new RegExp(`^${name},`) });
const KIND_LABELS: Record<string, string> = { narration: 'Narration', choices: 'Choices', stats: 'Stats' };
const openPrompts = () => {
  // Radix tabs switch on mouseDown, which a userEvent click also sends.
  if (overviewTab('Custom Prompts').getAttribute('aria-selected') !== 'true') fireEvent.mouseDown(overviewTab('Custom Prompts'));
};
/** The row that selects a prompt kind, with the Custom Prompts tab opened on the way. */
const picker = (name: string) => {
  openPrompts();
  return kindRow(name);
};
const openKind = () => kindList().getAllByRole('button')
  .filter((b) => b.getAttribute('aria-current') === 'true').map((b) => b.getAttribute('aria-label')?.split(',')[0]);
/** A kind's checkbox in its status row; every row shows one, selected or not. */
const checkbox = (kind: string) => {
  openPrompts();
  return screen.getByRole('checkbox', { name: `Use ${KIND_LABELS[kind]} Prompt` });
};

beforeEach(() => {
  world.overview = { ...baseOverview, promptOverrides: { ...baseOverview.promptOverrides } };
  world.entities = entities;
  world.locations = locations;
  fieldProps.byLabel = {};
});

describe('the custom prompts tab', () => {
  it('is hidden in Simple mode, prompts or not', () => {
    renderManager(false);
    expect(screen.queryByRole('tablist', { name: 'Overview Fields' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('World narration prompt')).not.toBeInTheDocument();
  });

  it('opens on Details, and its own tab opens on Narration', () => {
    renderManager();
    expect(overviewTab('Details')).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('World narration prompt')).not.toBeInTheDocument();

    fireEvent.mouseDown(overviewTab('Custom Prompts'));
    expect(openKind()).toEqual(['Narration']);
    expect(screen.getByTestId('World narration prompt')).toBeInTheDocument();
  });

  it('shows every kind’s state in its row at once: Custom when on, Default when off', () => {
    world.overview.promptOverrides = {
      systemPrompt: 'authored', systemPromptEnabled: true,
      choicesPrompt: 'authored but off', choicesPromptEnabled: false,
    };
    renderManager();

    expect(checkbox('narration')).toBeChecked();
    expect(checkbox('choices')).not.toBeChecked();
    expect(checkbox('stats')).not.toBeChecked();
    expect(kindRow('Narration')).toHaveAccessibleName('Narration, Custom');
    // Kept text does not make an off prompt Custom.
    expect(kindRow('Choices')).toHaveAccessibleName('Choices, Default');
    expect(kindRow('Stats')).toHaveAccessibleName('Stats, Default');
  });

  it('switches another row’s kind without changing the open prompt', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(checkbox('stats'));

    expect(world.overview.promptOverrides?.statUpdatesPromptEnabled).toBe(true);
    expect(kindRow('Stats')).toHaveAccessibleName('Stats, Custom');
    expect(openKind()).toEqual(['Narration']);
    expect(screen.getByTestId('World narration prompt')).toBeInTheDocument();
  });

  it('keeps the open kind open when it is picked again', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(picker('Choices'));
    await user.click(picker('Choices'));
    expect(openKind()).toEqual(['Choices']);
    expect(screen.getByTestId('World choices prompt')).toBeInTheDocument();
  });

  it('switches a kind on and stays on its panel', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(picker('Choices'));
    await user.click(checkbox('choices'));

    expect(world.overview.promptOverrides?.choicesPromptEnabled).toBe(true);
    expect(openKind()).toEqual(['Choices']);
    expect(screen.getByTestId('World choices prompt')).toBeInTheDocument();
  });

  it('switches a kind off and leaves its field in place', async () => {
    const user = userEvent.setup();
    world.overview.promptOverrides = { choicesPrompt: 'authored', choicesPromptEnabled: true };
    renderManager();
    await user.click(picker('Choices'));
    await user.click(checkbox('choices'));

    expect(world.overview.promptOverrides?.choicesPromptEnabled).toBe(false);
    expect(openKind()).toEqual(['Choices']);
    expect(field('World choices prompt').value).toBe('authored');
  });

  it('writes nothing when the author only browses the kinds', async () => {
    const user = userEvent.setup();
    const before = world.overview;
    renderManager();
    await user.click(picker('Stats'));

    expect(screen.getByTestId('World stats prompt')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Use Stats Prompt' })).not.toBeChecked();
    expect(world.overview).toBe(before);
  });

  it('keeps a switched-off kind editable, and says it is not applied', async () => {
    const user = userEvent.setup();
    world.overview.promptOverrides = { choicesPrompt: 'drafted', choicesPromptEnabled: false };
    renderManager();
    await user.click(picker('Choices'));

    expect(field('World choices prompt').value).toBe('drafted');
    expect(screen.getByText(/Not applied until you check Choices above/)).toBeInTheDocument();
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

/** What the open narration field previews each token as. */
const previewValues = async () => {
  await openNarration();
  const values = promptChips('World narration prompt').previewValues;
  return (token: string) => readValue(values, token);
};

describe('the world narration prompt field', () => {
  it('gives the editor something to preview, so it offers Preview and the split view', async () => {
    await openNarration();
    const props = field('World narration prompt');

    // PromptField gates its Edit/Preview tabs — and the split view built on them — on having values to
    // resolve chips against. Without these the field is a bare textarea.
    expect(props).toBeDefined();
    const chips = promptChips('World narration prompt');
    expect(readValue(chips.previewValues, '<LOCATION>')).toBeTruthy();
    expect(chips.sampleData).toBe('Your world, sample turn');
  });

  it('previews the world being edited, not the shared sample world', async () => {
    const values = await previewValues();

    expect(values('<LOCATION>')).toContain('The Jetty');
    expect(values('<ENTITIES>')).toContain('Wren');
    expect(values('<WORLD DESCRIPTION>')).toContain('drowned coast');
    // The sample pool's own location must not show through where the world can answer.
    expect(values('<LOCATION>')).not.toContain('The Landing');
  });

  it('previews the stats and default traits the world actually starts with', async () => {
    const values = await previewValues();

    expect(values('<STATS DESCRIPTION>')).toContain('Warmth');
    expect(values('<TRAITS DESCRIPTION>')).toContain('Saltborn');
    // Not chosen at character creation, so it is not part of the opening the author is previewing.
    expect(values('<TRAITS DESCRIPTION>')).not.toContain('Landlocked');
  });

  it('previews the stats under their stat groups', async () => {
    expect((await previewValues())('<STATS DESCRIPTION|numbers>')).toBe('Body:\n  What the cold takes.\n  Warmth: 7/10');
  });

  it('carries every format variant, not just the plain one', async () => {
    const values = await previewValues();

    expect(values('<LOCATION|markdown>')).toContain('**name:**');
    expect(values('<LOCATION|xml>')).toContain('<name>');
    expect(values('<ENTITIES|name>')).toBe('Wren');
  });

  it('previews the world’s own lore, split into the two blocks the game fills', async () => {
    const values = await previewValues();

    // Nothing has been typed, so no keyword has fired — the preview shows what this world could inject.
    expect(values('<DICTIONARY>')).toContain('It takes and does not give back.');
    expect(values('<DICTIONARY|before>')).toContain('No lamps after dusk.');
    // Position decides the block; an entry must not appear in both.
    expect(values('<DICTIONARY>')).not.toContain('No lamps after dusk.');
    // A disabled entry never reaches a prompt, so it must not reach the preview either.
    expect(values('<DICTIONARY>')).not.toContain('Never injected.');
    expect(values('<DICTIONARY|before>')).not.toContain('Never injected.');
  });

  it('falls back to the samples for what only a turn can answer', async () => {
    const values = await previewValues();

    // No playthrough exists, so these have no authored answer — they must still resolve to something
    // rather than rendering as a raw token in the preview.
    expect(values('<PLAYER ACTION>')).toBeTruthy();
    expect(values('<NARRATION>')).toBeTruthy();
  });

  it('previews the sample clock in every Time format, not just the plain one', async () => {
    const values = await previewValues();

    expect(values('<TIME>')).toBe('Day 3, evening');
    expect(values('<TIME|hours>')).toBe('Day 3, 18:00');
    expect(values('<TIME|ampm>')).toBe('Day 3, 6:00 PM');
    expect(values('<TIME|noday>')).toBe('evening');
  });

  it('previews the guidance built from the player’s own settings, not a stand-in', async () => {
    const values = await previewValues();

    // The mocked setting above is 'single'; a hardcoded sample would not track it.
    expect(values('<LENGTH GUIDANCE>')).toBe('Write a single paragraph.');
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
      readValue(promptChips(label).previewValues, '<LANGUAGE>');
    const user = await openNarration();
    expect(languageOf('World narration prompt')).toBe('Write all narration in French.');
    await user.click(picker('Choices'));
    expect(languageOf('World choices prompt')).toBe('Write all choices in French.');
  });
});
