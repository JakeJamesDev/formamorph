import { describe, expect, it } from 'vitest';
import { DEFAULT_HELP_SETTINGS } from './helpSettings';
import { DEFAULT_MASCOT_RIG } from './mascot';
import { emptyRoomLine, fallbackLine, speakerName, stageLine, thinkingLine } from './helpSpeaker';

describe('who answers', () => {
  it('is the active mascot while the Mascot is on: Morphie by default, a custom card by its name', () => {
    expect(speakerName(DEFAULT_HELP_SETTINGS)).toBe('Morphie');
    const custom = { activeId: 'cap', mascots: [{ id: 'cap', name: 'Captain', rig: DEFAULT_MASCOT_RIG }] };
    expect(speakerName({ ...DEFAULT_HELP_SETTINGS, mascotPresets: custom })).toBe('Captain');
  });

  it('is nobody while the Mascot is off, so every line falls back to its generic text', () => {
    expect(speakerName({ ...DEFAULT_HELP_SETTINGS, mascot: false })).toBeNull();
  });
});

describe('the lines', () => {
  it('name her in each wait, but leave the guide search to the app', () => {
    expect(stageLine('checking', 'Morphie')).toBe('Checking on Morphie…');
    expect(stageLine('picking', 'Morphie')).toBe('Morphie is searching the guide…');
    expect(stageLine('waiting', 'Morphie')).toBe('Asking Morphie…');
    expect(stageLine('lookingUp', 'Morphie')).toBe('Morphie is looking it up…');
    expect(stageLine('searching', 'Morphie')).toBe('Searching the guide…');
    expect(stageLine('waiting', null)).toBe('Waiting for your AI…');
    expect(stageLine('checking', null)).toBe('Checking your AI…');
  });

  it('name her in a failed or short answer, never in a missing connection', () => {
    expect(fallbackLine('failed', false, true, 'Morphie')).toBe('Morphie did not answer. These guide sections match your question.');
    expect(fallbackLine('failed', true, false, 'Morphie')).toBe('Morphie did not finish, and no guide section matches your question');
    expect(fallbackLine('no-ai', false, false, 'Morphie')).toBe('No AI is connected, and no guide section matches your question');
    expect(fallbackLine('failed', false, false, null)).toBe('The AI did not answer, and no guide section matches your question');
    expect(fallbackLine('failed', true, true, null)).toBe('The answer did not finish. These guide sections match your question.');
  });

  it('invite a question of her, or of nobody', () => {
    expect(emptyRoomLine('Morphie')).toBe('Ask Morphie how to do something in Formamorph');
    expect(emptyRoomLine(null)).toBe('Ask how to do something in Formamorph');
  });

  it('head the reasoning with her, while it runs and after', () => {
    expect(thinkingLine(true, 0, 'Morphie')).toBe('Morphie is thinking…');
    expect(thinkingLine(false, 4400, 'Morphie')).toBe('Morphie thought for 4s');
    expect(thinkingLine(true, 0, null)).toBe('Thinking…');
    expect(thinkingLine(false, 200, null)).toBe('Thought for 1s');
  });
});
