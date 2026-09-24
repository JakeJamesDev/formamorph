import { describe, expect, it } from 'vitest';
import { defaultStatUpdatesPrompt, defaultSystemPrompt } from '@/components/game/GamePrompts';
import { computeInPlay, headedBlock, type TourPromptTemplates } from './inPlay';
import { TOUR_STEPS, type TourWorld } from './steps';

/** In Play's readers take each chip, and its Header, from the active preset's own templates. */

const WORLD_TEXT = 'Brinewell is a quiet fishing village.';

const world: TourWorld = {
  worldOverview: {
    name: 'Brinewell', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: WORLD_TEXT, use3DModel: false, tags: [],
  },
  stats: [{ id: 'sea', name: 'Sea Change', min: 0, max: 100, value: 10, description: 'How far the sea has claimed you.' }],
  locations: [{ id: 'well', name: 'The Tidewell', isStarting: true }],
  entities: [], placeholders: [], traits: [], statUpdates: [],
} as unknown as TourWorld;

const step = (id: string) => TOUR_STEPS.find((s) => s.id === id)!.inPlay;

const templates = (over: Partial<TourPromptTemplates>): TourPromptTemplates => ({
  'Narration Prompt': defaultSystemPrompt,
  'Location Change Prompt': '',
  'Stat Updates Prompt': defaultStatUpdatesPrompt,
  ...over,
});

const narration = (narrationTemplate: string, stepId = 'world-ai-description') =>
  computeInPlay(step(stepId), world, 'w1', { location: 'well', stat: 'sea' }, templates({ 'Narration Prompt': narrationTemplate }))
    .readers.find((r) => r.prompt === 'Narration Prompt')!;

describe('headedBlock', () => {
  it('frames the body in the Header style the chip carries, without the outer blank lines', () => {
    expect(headedBlock('<WORLD DESCRIPTION|format=markdown|header="Game World">', 'body')).toBe('## Game World\nbody');
    expect(headedBlock('<WORLD DESCRIPTION|header="Game World">', 'body')).toBe('GAME WORLD:\nbody');
    expect(headedBlock('<WORLD DESCRIPTION|format=xml|header="Game World">', 'body')).toBe('<game_world>\nbody\n</game_world>');
    // A scoped chip carries its style in its variant, as the renderer reads it.
    expect(headedBlock('<STATS DESCRIPTION|descriptions.markdown|header="Player Stats">', 'body')).toBe('## Player Stats\nbody');
    expect(headedBlock('<STATS DESCRIPTION|descriptions.xml|header="Player Stats">', 'body')).toBe('<player_stats>\nbody\n</player_stats>');
  });

  it('leaves a chip with no Header bare', () => {
    expect(headedBlock('<WORLD DESCRIPTION>', 'body')).toBe('body');
  });
});

describe('computeInPlay readers', () => {
  it('shows the shipped Narration prompt\'s Header over the world block, with the author text marked after it', () => {
    const reader = narration(defaultSystemPrompt);
    expect(reader.state).toBe('reads');
    expect(reader.text).toBe(`## Game World\n${WORLD_TEXT}`);
    expect(reader.marks).toEqual([{ start: '## Game World\n'.length, end: reader.text.length }]);
  });

  it('follows the active preset\'s own Header and style', () => {
    expect(narration('Narrate.\n<WORLD DESCRIPTION|header="Setting">').text).toBe(`SETTING:\n${WORLD_TEXT}`);
    expect(narration('<WORLD DESCRIPTION|format=xml|header="Setting">').text).toBe(`<setting>\n${WORLD_TEXT}\n</setting>`);
    expect(narration('<WORLD DESCRIPTION>').text).toBe(WORLD_TEXT);
  });

  it('says the prompt never reads a field when the active preset places no chip for it', () => {
    const reader = narration('Narrate with no world block.');
    expect(reader).toMatchObject({ state: 'neverReads', text: '', marks: [] });
  });

  it('reads the stat through whichever Stats chip each prompt places', () => {
    const readers = computeInPlay(step('stat-name'), world, 'w1', { location: 'well', stat: 'sea' }, templates({})).readers;
    const byPrompt = Object.fromEntries(readers.map((r) => [r.prompt, r]));
    expect(byPrompt['Narration Prompt'].text).toMatch(/^## Player Stats\n/);
    expect(byPrompt['Narration Prompt'].text).not.toMatch(/\d/);
    // The shipped Stat Updates prompt places its Stats chip with no Header.
    expect(byPrompt['Stat Updates Prompt'].text).toBe('- **Sea Change:** 10/100 — How far the sea has claimed you.');
    expect(byPrompt['Stat Updates Prompt'].marks).toEqual([{ start: 4, end: 14 }]);

    const none = computeInPlay(step('stat-name'), world, 'w1', { location: 'well', stat: 'sea' },
      templates({ 'Stat Updates Prompt': 'Track stats with no Stats chip.' })).readers;
    expect(none.find((r) => r.prompt === 'Stat Updates Prompt')?.state).toBe('neverReads');
  });
});
