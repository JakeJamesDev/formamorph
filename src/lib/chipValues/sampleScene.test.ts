import { describe, it, expect } from 'vitest';
import { sampleChipScene } from './sampleScene';
import { chipValues } from './chipValues';
import { NONE_PLACEHOLDER } from '../promptFallbacks';
import { spelledTokens } from '@/test/chipTokens';
import { renderPromptTemplate } from '../promptTemplate';
import { defaultStatUpdatesPrompt } from '@/components/game/GamePrompts';

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
    const tokens = ['<WORLD DESCRIPTION>', '<STATS DESCRIPTION>', '<TRAITS DESCRIPTION>', '<PERSONA>', '<LOCATION>',
      '<ENTITIES>', '<NOTES>', '<TIME>', '<DICTIONARY>'].flatMap(spelledTokens);
    const empty = tokens.filter((token) => !values(token)?.trim() || values(token) === NONE_PLACEHOLDER);
    expect(empty).toEqual([]);
  });

  it('renders the sample clock as the old preview did', () => {
    expect(chipValues(sampleChipScene())('<TIME>')).toBe('Day 3, evening');
  });

  it('shows grouped and top-level global stats and traits', () => {
    const values = chipValues(sampleChipScene());
    expect(values('<STATS DESCRIPTION>')).toBe('Resolve\nStanding\nBody:\n  What the coast has done to the traveler.\n  Health');
    expect(values('<TRAITS DESCRIPTION>')).toMatch(/^Salvager's Eye: .*\nHabits:\n {2}Ways the traveler cannot help\.\n {2}Light Sleeper: /);
  });

  it('sends Global Trait names alone under their group heading, per format', () => {
    const values = chipValues(sampleChipScene());
    expect(values('<TRAITS DESCRIPTION|name>')).toBe("Salvager's Eye\nHabits:\n  Ways the traveler cannot help.\n  Light Sleeper");
    expect(values('<TRAITS DESCRIPTION|name.markdown>')).toBe(
      "- **Salvager's Eye**\n- **Habits:** Ways the traveler cannot help.\n  - **Light Sleeper**",
    );
    const xml = values('<TRAITS DESCRIPTION|name.xml>');
    expect(xml).toContain("<name>Salvager's Eye</name>");
    expect(xml).toContain('<description>Ways the traveler cannot help.</description>');
    expect(xml).toContain('<name>Light Sleeper</name>');
    expect(xml).not.toMatch(/Spots the worth|Wakes at the smallest/);
  });

  it('fills both owner blocks of the default stat prompt in the Settings preview', () => {
    const prompt = renderPromptTemplate(defaultStatUpdatesPrompt, chipValues(sampleChipScene()));
    expect(prompt).toMatch(/## Player Character\n- \*\*Traveler\*\*[^#]*- \*\*Nerve:\*\* 55\/100/);
    expect(prompt).toMatch(/## In Scene\n- \*\*Wren\*\*[^#]*- \*\*Patience:\*\* 70\/100/);
  });
});
