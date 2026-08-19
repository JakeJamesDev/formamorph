import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Dictionary, Entity, GameLocation, Placeholder, Stat, Trait, WorldOverview } from '@/types';
import { EditorModeContext } from '@/lib/editorMode';
import { OPENING_SCENE_CUE } from '@/components/game/GamePrompts';
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
    stats, locations, entities, traits, traitGroups: [], dictionaries, placeholders,
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

type FocusField = { fieldKey: string } | null;

/** Renders the manager against the live `world`, re-rendering whenever the manager writes to it. */
const Harness = ({ focusField }: { focusField?: FocusField }) => {
  const [, setTick] = useState(0);
  world.rerender = () => setTick((n) => n + 1);
  return <WorldDetailsManager focusField={focusField} />;
};

const renderManager = (advanced = true, focusField?: FocusField) => render(
  <EditorModeContext.Provider value={{ mode: advanced ? 'advanced' : 'simple', advanced, setMode: () => {} }}>
    <Harness focusField={focusField} />
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
    // The language chip is offered on both, since both are prompts the player reads the output of.
    expect(narrationVars.map((v) => v.token)).toContain('<LANGUAGE>');
    expect(choicesVars.map((v) => v.token)).toContain('<LANGUAGE>');
  });

  it('previews the language chip in the wording the open kind will actually send', async () => {
    const languageOf = (label: string) =>
      (field(label).previewValues as Record<string, string>)['<LANGUAGE>'];
    const user = await openNarration();
    expect(languageOf('World narration prompt')).toBe('Write all narration in French.');
    await user.click(picker('Choices'));
    expect(languageOf('World choices prompt')).toBe('Write all choices in French.');
  });
});

/** The one field the section shows, and the checkbox that applies it. */
const CUE_FIELD = 'World opening cue';
const cueCheckbox = () => screen.getByRole('checkbox', { name: "Use this world's opening cue" });

describe('the opening cue panel', () => {
  /** Opens the cue by picking it — browsing, which must leave the world untouched. */
  const browseCue = async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(picker('Opening'));
    return user;
  };

  /** Switches the cue on, which opens it the same way a prompt kind's checkbox does. */
  const enableCue = async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(cueCheckbox());
    return user;
  };

  it('is hidden in Simple mode', () => {
    renderManager(false);
    expect(screen.queryByRole('radio', { name: 'Opening' })).not.toBeInTheDocument();
    expect(screen.queryByTestId(CUE_FIELD)).not.toBeInTheDocument();
  });

  it('shows the cue’s enabled state without opening it', () => {
    world.overview.openingCue = 'You wake in the reed-beds.';
    world.overview.openingCueEnabled = false;
    renderManager();

    // Nothing is open, so the picker chrome is the only place this state can be read — and a cue that is
    // switched off still keeps its text.
    expect(cueCheckbox()).not.toBeChecked();
    expect(screen.queryByTestId(CUE_FIELD)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
    expect(world.overview.openingCue).toBe('You wake in the reed-beds.');
  });

  it('only opens when the picker itself is clicked', async () => {
    await browseCue();

    expect(screen.getByTestId(CUE_FIELD)).toBeInTheDocument();
    // Browsing must never enable anything, and must not write to the world at all.
    expect(cueCheckbox()).not.toBeChecked();
    expect(world.overview.openingCueEnabled).toBeUndefined();
    expect(screen.getByText(/Not applied until you switch this one on/)).toBeInTheDocument();
  });

  it('closes the cue when it is picked again', async () => {
    const user = await browseCue();
    await user.click(picker('Opening'));

    expect(screen.queryByTestId(CUE_FIELD)).not.toBeInTheDocument();
    expect(openKind()).toEqual([]);
  });

  it('opens on the shipped cue, storing nothing', async () => {
    await enableCue();

    expect(field(CUE_FIELD).value).toBe(OPENING_SCENE_CUE);
    expect(screen.getByText(/This is the standard cue/)).toBeInTheDocument();
    expect(world.overview.openingCue).toBeUndefined();
  });

  it('stores the text on the first edit that diverges from the shipped cue', async () => {
    await enableCue();
    edit(CUE_FIELD, `${OPENING_SCENE_CUE} And it is raining.`);

    expect(world.overview.openingCue).toBe(`${OPENING_SCENE_CUE} And it is raining.`);
    expect(world.overview.openingCueEnabled).toBe(true);
  });

  it('drafting a cue does not switch it on', async () => {
    await browseCue();
    edit(CUE_FIELD, 'You wake in the reed-beds.');

    // Enabling is the checkbox's job. The flag has to be written rather than left to default, since stored
    // text on its own reads as switched on.
    expect(world.overview.openingCue).toBe('You wake in the reed-beds.');
    expect(world.overview.openingCueEnabled).toBe(false);
    expect(cueCheckbox()).not.toBeChecked();
  });

  it('does not store a template that came back unchanged', async () => {
    await enableCue();
    edit(CUE_FIELD, OPENING_SCENE_CUE);

    // The field echoes its value on mount and on any no-op edit; that must not become an authored cue.
    expect(world.overview.openingCue).toBeUndefined();
  });

  it('switching the cue off keeps the text it holds, and leaves it open to edit', async () => {
    world.overview.openingCue = 'You wake in the reed-beds.';
    world.overview.openingCueEnabled = true;
    const user = await browseCue();

    await user.click(cueCheckbox());
    expect(world.overview.openingCueEnabled).toBe(false);
    expect(world.overview.openingCue).toBe('You wake in the reed-beds.');
    // Switching something off is not a request to stop looking at it — the panel must not shut under the click.
    expect(screen.getByTestId(CUE_FIELD)).toBeInTheDocument();
    expect(screen.getByText(/Not applied until you switch this one on/)).toBeInTheDocument();
  });

  it('offers Reset only for a cue the author actually wrote', async () => {
    const user = await enableCue();
    // Only one panel is open at a time, so the only Reset on screen is the cue's.
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();

    edit(CUE_FIELD, 'You wake in the reed-beds.');
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(world.overview.openingCue).toBe('You wake in the reed-beds.');
  });

  it('drops the stored cue and returns the field to the shipped one', async () => {
    world.overview.openingCue = 'You wake in the reed-beds.';
    world.overview.openingCueEnabled = true;
    const user = await browseCue();
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    // One dialog serves every panel now — asking about a "prompt" here would describe the wrong discard.
    expect(screen.getByText("Discard this world's opening cue?")).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(world.overview.openingCue).toBeUndefined();
    expect(field(CUE_FIELD).value).toBe(OPENING_SCENE_CUE);
    // Reset discards authored text; it does not decline the feature.
    expect(world.overview.openingCueEnabled).toBe(true);
  });

  it('opens the cue when the find bar navigates to it', () => {
    world.overview.openingCue = 'You wake in the reed-beds.';
    // The find bar is the only way to reach a panel that is not showing; a hit that leaves it closed lands
    // the author on a picker with nothing open and no visible match.
    renderManager(true, { fieldKey: 'openingCue' });

    expect(screen.getByTestId(CUE_FIELD)).toBeInTheDocument();
    expect(field(CUE_FIELD).value).toBe('You wake in the reed-beds.');
  });

  it('offers the world’s placeholders as chips', async () => {
    await enableCue();
    // A Wildcard in the cue is how a world opens differently each playthrough, so the field has to be the
    // chip-capable one with this world's own placeholders in its palette.
    expect(field(CUE_FIELD).placeholders).toEqual(placeholders);
  });
});
