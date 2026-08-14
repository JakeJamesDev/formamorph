import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Dictionary, Entity, GameLocation, Stat, Trait, WorldOverview } from '@/types';
import WorldDetailsManager from './WorldDetailsManager';

const worldOverview = {
  name: 'Sedge Landing',
  description: '',
  systemPrompt: 'A drowned coast where the tide keeps what it takes.',
  tags: [],
  promptOverrides: { systemPrompt: 'You are the narrator. <LENGTH GUIDANCE>', systemPromptEnabled: true },
} as unknown as WorldOverview;

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
    worldOverview, updateWorldOverview: vi.fn(),
    stats, locations, entities, traits, traitGroups: [], dictionaries, placeholders: [],
  }),
}));
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    paragraphLimit: 'single', maxTokens: 800, markdownOutput: true,
    activeSectionStyle: 'default', limitActiveCharacters: true, activeCharacterLimit: 5,
  }),
}));
vi.mock('@/lib/useDanbooruTags', () => ({ useDanbooruTags: () => [] }));
// The Lexical editor itself isn't under test — what matters is which props the manager hands it.
const fieldProps = vi.hoisted(() => ({ byLabel: {} as Record<string, Record<string, unknown>> }));
vi.mock('@/components/prompt/PromptField', () => ({
  default: (props: { ariaLabel?: string; previewValues?: Record<string, string> }) => {
    if (props.ariaLabel) fieldProps.byLabel[props.ariaLabel] = props;
    return <div data-testid={props.ariaLabel ?? 'prompt-field'} />;
  },
}));
vi.mock('@/components/prompt/PlaceholderField', () => ({ default: () => <div /> }));

const narrationProps = () => {
  render(<WorldDetailsManager />);
  return fieldProps.byLabel['World narration prompt'];
};
const previewValues = () => narrationProps().previewValues as Record<string, string>;

describe('the world narration prompt field', () => {
  it('gives the editor something to preview, so it offers Preview and the split view', () => {
    const props = narrationProps();

    // PromptField gates its Edit/Preview tabs — and the split view built on them — on having values to
    // resolve chips against. Without these the field is a bare textarea.
    expect(props).toBeDefined();
    expect(Object.keys(props.previewValues as Record<string, string>).length).toBeGreaterThan(0);
    expect(props.sampleData).toBe('Your world, sample turn');
  });

  it('previews the world being edited, not the shared sample world', () => {
    const values = previewValues();

    expect(values['<LOCATION>']).toContain('The Jetty');
    expect(values['<ENTITIES>']).toContain('Wren');
    expect(values['<WORLD DESCRIPTION>']).toContain('drowned coast');
    // The sample pool's own location must not show through where the world can answer.
    expect(values['<LOCATION>']).not.toContain('The Landing');
  });

  it('previews the stats and default traits the world actually starts with', () => {
    const values = previewValues();

    expect(values['<STATS DESCRIPTION>']).toContain('Warmth');
    expect(values['<TRAITS DESCRIPTION>']).toContain('Saltborn');
    // Not chosen at character creation, so it is not part of the opening the author is previewing.
    expect(values['<TRAITS DESCRIPTION>']).not.toContain('Landlocked');
  });

  it('carries every format variant, not just the plain one', () => {
    const values = previewValues();

    expect(values['<LOCATION|markdown>']).toContain('**name:**');
    expect(values['<LOCATION|xml>']).toContain('<name>');
    expect(values['<ENTITIES|name>']).toBe('Wren');
  });

  it('previews the world’s own lore, split into the two blocks the game fills', () => {
    const values = previewValues();

    // Nothing has been typed, so no keyword has fired — the preview shows what this world could inject.
    expect(values['<DICTIONARY>']).toContain('It takes and does not give back.');
    expect(values['<DICTIONARY|before>']).toContain('No lamps after dusk.');
    // Position decides the block; an entry must not appear in both.
    expect(values['<DICTIONARY>']).not.toContain('No lamps after dusk.');
    // A disabled entry never reaches a prompt, so it must not reach the preview either.
    expect(values['<DICTIONARY>']).not.toContain('Never injected.');
    expect(values['<DICTIONARY|before>']).not.toContain('Never injected.');
  });

  it('falls back to the samples for what only a turn can answer', () => {
    const values = previewValues();

    // No playthrough exists, so these have no authored answer — they must still resolve to something
    // rather than rendering as a raw token in the preview.
    expect(values['<PLAYER ACTION>']).toBeTruthy();
    expect(values['<NARRATION>']).toBeTruthy();
  });

  it('previews the guidance built from the player’s own settings, not a stand-in', () => {
    const values = previewValues();

    // The mocked setting above is 'single'; a hardcoded sample would not track it.
    expect(values['<LENGTH GUIDANCE>']).toBe('Write a single paragraph.');
  });

  it('does not render the editor at all when the override is switched off', () => {
    worldOverview.promptOverrides = { systemPrompt: 'kept', systemPromptEnabled: false };
    render(<WorldDetailsManager />);

    expect(screen.queryByTestId('World narration prompt')).not.toBeInTheDocument();
    expect(screen.getByText(/Your prompt is kept/)).toBeInTheDocument();
    worldOverview.promptOverrides = { systemPrompt: 'You are the narrator.', systemPromptEnabled: true };
  });
});
