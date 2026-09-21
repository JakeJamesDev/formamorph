import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/open-chat.json?raw';
import { migrateWorld } from './version';
import { DEFAULT_WORLDS } from './defaultWorlds';
import { runRules } from './testBench/rules';
import { planTurn, planHasPass } from './turnPipeline/planTurn';
import { HIDDEN_SETTING_DEFAULTS } from './settingsAdvancedData';
import { testInput } from './turnPipeline/turnTestInputs';
import type { TurnSettings } from './turnPipeline/turnPlan';

// Loaded the way the seeder loads it: raw text through the world migration.
const world = migrateWorld(JSON.parse(raw));

describe('the Open Chat default world', () => {
  it('is listed as a bundled default under its stable id', () => {
    expect(DEFAULT_WORLDS).toContainEqual({ id: 'open-chat', defaultName: 'Open Chat' });
    expect(world.worldOverview.name).toBe('Open Chat');
  });

  // An exact set, so each fix must remove its row. The empty location stays: the picked entity fills it.
  it('raises exactly the expected Test Bench findings', () => {
    expect(runRules(world).map((f) => f.ruleId).sort()).toEqual([
      'location-no-entities',
      'world-empty-system-prompt',
      'world-no-readme',
    ]);
  });

  it('is a neutral harness: no stats, one unconnected location, no entities, no lore', () => {
    expect(world.stats).toEqual([]);
    expect(world.locations).toHaveLength(1);
    expect(world.connections ?? []).toEqual([]);
    expect(world.entities).toEqual([]);
    expect(world.dictionaries.flatMap((book) => book.entries)).toEqual([]);
  });

  it('lets the player be anyone and opens on one editable Player Action', () => {
    expect(world.worldOverview.playerSetting).toBe('open');
    expect(world.worldOverview.openingsEnabled).not.toBe(false);
    const openings = world.worldOverview.openings ?? [];
    expect(openings).toHaveLength(1);
    expect(openings[0].kind).toBe('action');
    expect(openings[0].text.trim()).not.toBe('');
  });
});

describe('an Open Chat turn under default settings', () => {
  // The shipped defaults, with the stat and location requests left on: the world alone must remove them.
  const settings: Partial<TurnSettings> = {
    thinkingMode: 'off',
    concurrentTurnRequests: HIDDEN_SETTING_DEFAULTS.concurrentTurnRequests,
    choicesEnabled: true,
    statUpdatesEnabled: true,
    statCount: world.stats.length,
    locationChangeEnabled: true,
    aiClock: HIDDEN_SETTING_DEFAULTS.aiClock,
    memoryDigests: HIDDEN_SETTING_DEFAULTS.memoryDigests,
    characterDiaries: HIDDEN_SETTING_DEFAULTS.characterDiaries,
    describeCharacters: HIDDEN_SETTING_DEFAULTS.describeCharacters,
    language: 'English',
  };
  const counts = { destinationCount: world.connections?.length ?? 0, locationCount: world.locations.length };

  it.each([false, true])('narrates and offers choices, with no stat or location pass (auto-apply %s)', (auto) => {
    const plan = planTurn(testInput(counts, { ...settings, locationAutoApply: auto }));
    expect(planHasPass(plan, 'narration')).toBe(true);
    expect(planHasPass(plan, 'choices')).toBe(true);
    for (const id of ['statUpdates', 'locationAuto', 'locationSuggest'] as const) {
      expect(planHasPass(plan, id), id).toBe(false);
    }
  });
});
