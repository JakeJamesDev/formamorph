import { describe, it, expect } from 'vitest';
import { PROMPT_GROUPS, visibleGroups, allGroupedTabs } from './promptGroups';
import { computePromptTabAvailability } from './promptTabAvailability';

const everyFeature = {
  choicesEnabled: true, statUpdatesEnabled: true, locationChangeEnabled: true,
  memoryDigests: true, characterDiaries: true, aiClock: true, sceneImages: true,
};

/**
 * Every prompt that can exist in any configuration. No single Thinking mode reaches them all — `precall`
 * has Planning, `staged` has Director/Character/Storyboard — so the full set is the union across modes.
 */
const allOn = (['off', 'inline', 'precall', 'staged'] as const).reduce<Record<string, boolean>>(
  (acc, thinkingMode) => {
    const avail = computePromptTabAvailability({ ...everyFeature, thinkingMode });
    for (const [tab, ok] of Object.entries(avail)) if (ok) acc[tab] = true;
    return acc;
  },
  {},
);

/** A single realistic configuration, for the cases about hiding rather than coverage. */
const staged = computePromptTabAvailability({ ...everyFeature, thinkingMode: 'staged' });

describe('PROMPT_GROUPS', () => {
  it('groups every prompt the panel can show, and invents none', () => {
    // The drift guard: a prompt added to the panel but not to a group would be unreachable from the rail,
    // and a group naming a prompt that does not exist would render a dead entry.
    const groupable = Object.keys(allOn).filter((t) => allOn[t]);
    const grouped = allGroupedTabs();
    expect([...grouped].sort()).toEqual([...groupable].sort());
  });

  it('lists each prompt exactly once', () => {
    const grouped = allGroupedTabs();
    expect(grouped.length).toBe(new Set(grouped).size);
  });

  it('opens on Narration, the prompt that carries the story', () => {
    expect(PROMPT_GROUPS[0].tabs[0]).toBe('narration');
  });
});

describe('visibleGroups', () => {
  it('drops prompts whose feature is off', () => {
    const groups = visibleGroups({ ...staged, summary: false, diary: false });
    expect(groups.flatMap((g) => g.tabs)).not.toContain('summary');
    expect(groups.flatMap((g) => g.tabs)).not.toContain('diary');
  });

  it('drops a group left with nothing rather than heading an empty list', () => {
    const groups = visibleGroups({ ...staged, scenetags: false });
    expect(groups.map((g) => g.label)).not.toContain('Images');
  });

  it('keeps every group when everything is on', () => {
    expect(visibleGroups(staged).map((g) => g.label)).toEqual(['Story', 'Trackers', 'Memory', 'Images']);
  });

  it('survives an availability map that knows nothing', () => {
    expect(visibleGroups({})).toEqual([]);
  });
});
