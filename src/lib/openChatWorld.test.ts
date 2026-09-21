import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/open-chat.json?raw';
import { migrateWorld } from './version';
import { DEFAULT_WORLDS } from './defaultWorlds';
import { runRules } from './testBench/rules';
import { planTurn, planHasPass } from './turnPipeline/planTurn';
import { HIDDEN_SETTING_DEFAULTS } from './settingsAdvancedData';
import { testInput } from './turnPipeline/turnTestInputs';
import type { TurnSettings } from './turnPipeline/turnPlan';
import { collectPins } from './placeholderPins';
import { readPlaceholders, resolvePlaceholders } from './placeholders';
import { parsePromptTemplate } from './promptTemplate';
import { splitToken } from './promptVariables';
import { buildNarrationPrompt } from './turnPipeline/narrationPrompt';
import {
  SHIPPED_PROMPT_DEFAULTS, customizedPromptKinds, resolveWorldPrompt, worldPrompt, worldPromptChipValues,
  worldPromptEnabled,
} from './worldPrompt';
import { defaultSystemPrompt } from '@/components/game/GamePrompts';
import type { Trait } from '@/types';

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

  it('customizes the narration and choices prompts, and leaves the stats prompt alone', () => {
    expect(customizedPromptKinds(world.worldOverview)).toEqual(['narration', 'choices']);
  });

  it.each(['narration', 'choices'] as const)('supplies its own %s prompt, which the player can decline', (kind) => {
    const overview = world.worldOverview;
    expect(worldPromptEnabled(overview, kind)).toBe(true);
    const own = worldPrompt(overview, kind);
    expect(own).not.toBeNull();
    expect(own).not.toBe(SHIPPED_PROMPT_DEFAULTS[kind]);
    expect(resolveWorldPrompt(overview, kind, 'the preset', false)).toBe(own);
    expect(resolveWorldPrompt(overview, kind, 'the preset', true)).toBe('the preset');
  });

  it.each(['narration', 'choices'] as const)('keeps every chip of the built-in %s prompt in its own', (kind) => {
    const chipKeys = (template: string) => new Set(parsePromptTemplate(template).flatMap((s) =>
      s.type === 'variable' ? [splitToken(s.token)?.key ?? s.token] : []));
    const own = chipKeys(worldPrompt(world.worldOverview, kind) ?? '');
    for (const key of chipKeys(SHIPPED_PROMPT_DEFAULTS[kind])) expect(own, key).toContain(key);
  });

  // The tone chips live in the narration prompt, so the world text is one line that sets no scene.
  it('holds one chip-free line as its world system prompt', () => {
    const text = world.worldOverview.systemPrompt.trim();
    expect(text).not.toBe('');
    expect(text.split('\n')).toHaveLength(1);
    expect(text).not.toContain('{{ph:');
  });

  it('lets the player be anyone and opens on one editable Player Action', () => {
    expect(world.worldOverview.playerSetting).toBe('open');
    expect(world.worldOverview.openingsEnabled).not.toBe(false);
    const openings = world.worldOverview.openings ?? [];
    expect(openings).toHaveLength(1);
    expect(openings[0].kind).toBe('action');
    expect(openings[0].text.trim()).not.toBe('');
  });

  it('offers four exclusive tone groups of three traits, each trait switchable and pinning one placeholder', () => {
    const groups = world.traitGroups ?? [];
    expect(groups.map((g) => g.name)).toEqual(['Reply Length', 'Prose Style', 'Narration Share', 'Pacing']);
    for (const group of groups) {
      expect(group.exclusive, group.name).toBe(true);
      const members = world.traits.filter((t) => t.groupId === group.id);
      expect(members, group.name).toHaveLength(3);
      for (const trait of members) {
        expect(trait.playerToggle, trait.name).toBe(true);
        expect(trait.isDefault, trait.name).not.toBe(true);
        expect(trait.statChanges, trait.name).toEqual([]);
        expect(trait.placeholderPins, trait.name).toHaveLength(1);
      }
    }
  });
});

describe('the Open Chat tone traits', () => {
  const placeholders = world.placeholders ?? [];
  const groupTraits = (world.traitGroups ?? []).map((group) =>
    world.traits.filter((t) => t.groupId === group.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  const target = (trait: Trait): string => trait.placeholderPins![0].placeholderId;

  // Play's path: the active traits' pins, collected and laid over a playthrough with no rolls yet.
  const pinsFor = (active: Trait[], disabledTraitIds: string[] = []) =>
    collectPins({ traits: active, disabledTraitIds, placeholders });
  const valuesById = (active: Trait[], disabledTraitIds?: string[]): Record<string, string> =>
    Object.fromEntries(readPlaceholders({ placeholders, rolls: {}, pins: pinsFor(active, disabledTraitIds) })
      .map((r) => [r.id, r.value]));
  // The narration system prompt as play sends it: the world's own prompt, its tone chips keyed at the seam.
  const resolvedText = (active: Trait[]) => {
    const overview = world.worldOverview;
    const resolvePH = (text: string) => resolvePlaceholders(text, { placeholders, rolls: {}, pins: pinsFor(active) });
    return buildNarrationPrompt({
      template: resolveWorldPrompt(overview, 'narration', defaultSystemPrompt, false),
      ctx: { ...worldPromptChipValues(overview, false, resolvePH), '<WORLD DESCRIPTION>': resolvePH(overview.systemPrompt) },
      action: '', history: [], dictionary: [], actionVec: null, semanticLore: false, embedVectors: new Map(),
      language: 'English', paragraphLimit: 'auto', maxTokens: 1024, markdownOutput: true,
      sectionStyle: 'markdown', resolvePH,
    }).prompt;
  };

  const defaults = valuesById([]);

  it('backs each group with its own one-value placeholder', () => {
    expect(placeholders).toHaveLength(4);
    for (const ph of placeholders) expect(ph.values, ph.name).toHaveLength(1);
    const targets = groupTraits.map((traits) => new Set(traits.map(target)));
    for (const set of targets) expect(set.size).toBe(1);
    expect(new Set(targets.map((set) => [...set][0])).size).toBe(4);
  });

  it('reads the middle setting of every group when no trait is picked', () => {
    const middles = groupTraits.map((traits) => traits[1]);
    expect(resolvedText(middles)).toBe(resolvedText([]));
    for (const value of Object.values(defaults)) {
      expect(value.trim()).not.toBe('');
      expect(resolvedText([])).toContain(value);
    }
  });

  it.each(groupTraits.flat().map((t) => [t.name, t] as const))('%s changes only its own placeholder', (_name, trait) => {
    const pinned = valuesById([trait]);
    const middle = groupTraits.find((traits) => traits.includes(trait))![1];
    for (const ph of placeholders) {
      const value = pinned[ph.id];
      expect(value.trim(), ph.name).not.toBe('');
      if (ph.id !== target(trait)) expect(value, ph.name).toBe(defaults[ph.id]);
      else if (trait !== middle) expect(value, ph.name).not.toBe(defaults[ph.id]);
    }
    const text = resolvedText([trait]);
    expect(text).toContain(trait.placeholderPins![0].value);
    expect(text).not.toContain('{{ph:');
  });

  it('reads the default again once the trait is switched off', () => {
    for (const trait of groupTraits.flat()) expect(valuesById([trait], [trait.id]), trait.name).toEqual(defaults);
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
