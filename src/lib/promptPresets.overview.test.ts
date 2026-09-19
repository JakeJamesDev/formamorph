import { describe, it, expect } from 'vitest';
import {
  activeOverview, updateOverview, addPreset, presetStoreCodec, EMPTY_OVERVIEW,
  type PromptPresetStore, type PromptValues,
} from './promptPresets';

const V = { systemPrompt: 'S' } as PromptValues;
const builtin: PromptPresetStore = { activeId: 'default', presets: [{ id: 'u1', name: 'U1', values: V }] };
const user: PromptPresetStore = { activeId: 'u1', presets: [{ id: 'u1', name: 'U1', values: V }] };

describe('preset Overview', () => {
  it('a built-in has no Overview, and the setter leaves the store untouched', () => {
    expect(activeOverview(builtin)).toBeNull();
    expect(updateOverview(builtin, { author: 'Someone' })).toBe(builtin);
  });

  it('a user preset without one reads as empty fields', () => {
    expect(activeOverview(user)).toEqual(EMPTY_OVERVIEW);
  });

  it('patches one field and keeps the others', () => {
    const s = updateOverview(updateOverview(user, { author: 'Ann' }), { description: '**Bold** text' });
    expect(activeOverview(s)).toEqual({ ...EMPTY_OVERVIEW, author: 'Ann', description: '**Bold** text' });
  });

  it('stores tags trimmed, lowercased and de-duplicated', () => {
    const s = updateOverview(user, { tags: ['  Slow Burn ', 'slow burn', 'SFW', '', '   ', 'sfw'] });
    expect(activeOverview(s)?.tags).toEqual(['slow burn', 'sfw']);
  });

  it('stores models trimmed and de-duplicated, keeping the first casing', () => {
    const s = updateOverview(user, { models: [' Cydonia-24B ', 'cydonia-24b', 'Mistral-Nemo', ''] });
    expect(activeOverview(s)?.models).toEqual(['Cydonia-24B', 'Mistral-Nemo']);
  });

  it('keeps the author and description as typed', () => {
    const s = updateOverview(user, { author: '  Ann  ', description: '  line\n' });
    expect(activeOverview(s)).toMatchObject({ author: '  Ann  ', description: '  line\n' });
  });

  it('a preset added from another carries the given Overview', () => {
    const overview = { author: 'Ann', description: 'D', tags: ['t'], models: ['M'] };
    const s = addPreset(user, 'u2', 'Copy', V, 'markdown', overview);
    expect(activeOverview(s)).toEqual(overview);
    // A copy, not a shared reference: editing the new preset leaves the source alone.
    const edited = updateOverview(s, { tags: ['other'] });
    expect(overview.tags).toEqual(['t']);
    expect(edited.presets[1].overview?.tags).toEqual(['other']);
  });

  it('a preset added without an Overview stores none', () => {
    expect(addPreset(user, 'u2', 'New', V, 'markdown').presets[1]).not.toHaveProperty('overview');
  });

  it('an old stored preset with no Overview loads unchanged', () => {
    const preset = { id: 'u1', name: 'U1', values: { systemPrompt: 'S' }, style: 'labels' };
    expect(presetStoreCodec.parse(JSON.stringify({ activeId: 'u1', presets: [preset] })).presets[0]).toEqual(preset);
  });

  it('a stored Overview survives a round trip through the codec', () => {
    const s = updateOverview(user, { author: 'Ann', tags: ['a'], models: ['M'] });
    expect(activeOverview(presetStoreCodec.parse(presetStoreCodec.serialize(s)))).toEqual(activeOverview(s));
  });
});
