import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Dictionary, Entity, GameLocation, Stat, Trait, WorldOverview } from '@/types';
import { EditorModeContext } from '@/lib/editorMode';
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
const world: { overview: WorldOverview; rerender: () => void } = {
  overview: baseOverview,
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
    stats, locations, entities, traits, traitGroups: [], dictionaries, placeholders: [],
  }),
}));
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    paragraphLimit: 'single', maxTokens: 800, markdownOutput: true,
    activeSectionStyle: 'default', limitActiveCharacters: true, activeCharacterLimit: 5,
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
vi.mock('@/components/prompt/PlaceholderField', () => ({ default: () => <div /> }));

/** Renders the manager against the live `world`, re-rendering whenever the manager writes to it. */
const Harness = () => {
  const [, setTick] = useState(0);
  world.rerender = () => setTick((n) => n + 1);
  return <WorldDetailsManager />;
};

const renderManager = (advanced = true) => render(
  <EditorModeContext.Provider value={{ mode: advanced ? 'advanced' : 'simple', advanced, setMode: () => {} }}>
    <Harness />
  </EditorModeContext.Provider>,
);

/** The props the field of the open kind was last given. Only the open kind's editor is mounted. */
const field = (label: string) => fieldProps.byLabel[label];
const edit = (label: string, text: string) =>
  act(() => (field(label).onChange as (v: string) => void)(text));
const checkbox = (kind: string) => screen.getByRole('checkbox', { name: `Use this world's ${kind} prompt` });
/** The segmented control's items are radios, not tabs — this picker clears on re-selection. */
const picker = (name: string) => screen.getByRole('radio', { name });
const openKind = () => screen.getAllByRole('radio').filter((r) => r.getAttribute('data-state') === 'on')
  .map((r) => r.textContent);

beforeEach(() => {
  world.overview = { ...baseOverview, promptOverrides: { ...baseOverview.promptOverrides } };
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
    expect(screen.getByText(/This is your current choices prompt/)).toBeInTheDocument();
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

  it('asks first, and a cancel keeps the authored text', async () => {
    const user = await openNarration();
    await user.click(screen.getByRole('button', { name: 'Reset' }));
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
  return field('World narration prompt').previewValues as Record<string, string>;
};

describe('the world narration prompt field', () => {
  it('gives the editor something to preview, so it offers Preview and the split view', async () => {
    await openNarration();
    const props = field('World narration prompt');

    // PromptField gates its Edit/Preview tabs — and the split view built on them — on having values to
    // resolve chips against. Without these the field is a bare textarea.
    expect(props).toBeDefined();
    expect(Object.keys(props.previewValues as Record<string, string>).length).toBeGreaterThan(0);
    expect(props.sampleData).toBe('Your world, sample turn');
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

  it('gives each kind its own chip palette', async () => {
    const user = await openNarration();
    const narrationVars = field('World narration prompt').variables as Array<{ token: string }>;
    await user.click(picker('Choices'));
    const choicesVars = field('World choices prompt').variables as Array<{ token: string }>;

    // Length and markdown guidance are narration-only: the choices pass has nowhere to put them.
    expect(narrationVars.map((v) => v.token)).toContain('<LENGTH GUIDANCE>');
    expect(choicesVars.map((v) => v.token)).not.toContain('<LENGTH GUIDANCE>');
  });
});
