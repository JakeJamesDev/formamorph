import { describe, it, expect } from 'vitest';
import { sampleChipScene } from './sampleScene';
import { chipValues } from './chipValues';
import { NONE_PLACEHOLDER } from '../promptFallbacks';

describe('sampleChipScene', () => {
  it('opens on the Landing with the sample cast, as a player mid-scene would see it', () => {
    const scene = sampleChipScene();
    const names = (ids: string[]) => ids.map((id) => scene.entities.find((e) => e.id === id)?.name);
    expect(scene.location?.name).toBe('The Landing');
    expect(names(scene.presentIds)).toEqual(['Wren', 'a gull']);
    expect(names(scene.inSceneIds)).toEqual(['Wren']);
    expect(scene.persona?.entity.name).toBe('Traveler');
  });

  it('gives every scene-derived chip real sample content, never the empty placeholder', () => {
    // A preview that showed N/A for a chip would tell the player nothing about what the chip carries.
    const values = chipValues(sampleChipScene());
    const empty = Object.keys(values).filter((token) => !values[token].trim() || values[token] === NONE_PLACEHOLDER);
    expect(empty).toEqual([]);
  });

  it('renders the sample clock and notes', () => {
    const values = chipValues(sampleChipScene());
    expect(values['<TIME>']).toBe('Day 3, evening');
    expect(values['<NOTES>']).toBe('Traveler is looking for the person who sold them a false map.');
  });
});
