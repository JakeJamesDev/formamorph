import { describe, it, expect } from 'vitest';
import raw from '@/defaultworlds/open-chat.json?raw';
import { migrateWorld } from './version';
import { DEFAULT_WORLDS } from './defaultWorlds';
import { runRules } from './testBench/rules';
import { planTurn, planHasPass } from './turnPipeline/planTurn';
import { HIDDEN_SETTING_DEFAULTS } from './settingsAdvancedData';
import { testInput } from './turnPipeline/turnTestInputs';
import type { TurnSettings } from './turnPipeline/turnPlan';
import { buildEnterFlow } from './enterFlow';
import { collectPins } from './placeholderPins';
import { readPlaceholders, resolvePlaceholders } from './placeholders';
import { parsePromptTemplate } from './promptTemplate';
import { splitToken } from './promptVariables';
import { buildNarrationPrompt } from './turnPipeline/narrationPrompt';
import { lengthGuidance } from './outputLength';
import {
  SHIPPED_PROMPT_DEFAULTS, customizedPromptKinds, resolveWorldPrompt, worldPrompt, worldPromptChipValues,
  worldPromptEnabled,
} from './worldPrompt';
import { defaultSystemPrompt } from '@/components/game/GamePrompts';
import { SETTINGS_COPY } from '@/components/modals/settingsCopy';
import { SETTINGS_TABS } from '@/components/modals/settingsTabs';
import { NARRATION_LAYOUTS } from '@/contexts/settingsDefaults';
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
    ]);
  });

  // Setup guidance and play guidance stay apart: each readme shows at its own moment.
  it('explains setup in the intro readme: one entity from the library, the persona, and every tone group', () => {
    const intro = world.worldOverview.introReadme ?? '';
    for (const label of ['Library Additions', 'Persona', ...(world.traitGroups ?? []).map((g) => g.name)]) {
      expect(intro, label).toContain(`**${label}**`);
    }
    // Group chats are a smoke case only, so the readme asks for one entity.
    expect(intro).toMatch(/\bone entity\b/);
    expect(intro).not.toContain(SETTINGS_COPY.narrationLayout.label);
  });

  it('opens setup on the intro readme, before the trait picks', () => {
    const steps = buildEnterFlow({
      introReadme: world.worldOverview.introReadme, traitCount: world.traits.length,
      startingLocationCount: world.locations.length, hasLibraryAdditions: false, hasWorldPersonas: false, use3DModel: false,
    }, 'newGame');
    expect(steps).toEqual(['intro', 'workspace']);
  });

  it('names each setting in the gameplay readme by its live label', () => {
    const readme = world.worldOverview.readme ?? '';
    const tab = (value: string) => SETTINGS_TABS.find((t) => t.value === value)?.label;
    const chat = NARRATION_LAYOUTS.find((o) => o.value === 'chat')?.label;
    for (const label of [
      tab('display'), SETTINGS_COPY.narrationLayout.label, chat,
      tab('output'), SETTINGS_COPY.systemPrompts.label, 'Choices', 'Traits',
    ]) {
      expect(readme, label).toContain(`**${label}**`);
    }
    expect(readme).not.toContain('Library Additions');
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

  const chipKeys = (template: string) => new Set(parsePromptTemplate(template).flatMap((s) =>
    s.type === 'variable' ? [splitToken(s.token)?.key ?? s.token] : []));

  // The Reply Length chip is the one length control of a message, so the built-in length chip stays out.
  it.each(['narration', 'choices'] as const)('keeps every context chip of the built-in %s prompt in its own', (kind) => {
    const own = chipKeys(worldPrompt(world.worldOverview, kind) ?? '');
    for (const key of chipKeys(SHIPPED_PROMPT_DEFAULTS[kind])) {
      if (kind === 'narration' && key === '<LENGTH GUIDANCE>') expect(own, key).not.toContain(key);
      else expect(own, key).toContain(key);
    }
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

  it('offers three exclusive tone groups of three traits, the middle one the default', () => {
    const groups = world.traitGroups ?? [];
    expect(groups.map((g) => g.name)).toEqual(['Reply Length', 'Prose Style', 'Pacing']);
    for (const group of groups) {
      expect(group.exclusive, group.name).toBe(true);
      const members = world.traits.filter((t) => t.groupId === group.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      expect(members, group.name).toHaveLength(3);
      expect(members.map((t) => t.isDefault === true), group.name).toEqual([false, true, false]);
      for (const trait of members) {
        expect(trait.playerToggle, trait.name).toBe(true);
        expect(trait.statChanges, trait.name).toEqual([]);
        expect(trait.placeholderPins, trait.name).toHaveLength(1);
      }
    }
    expect(world.traits).toHaveLength(9);
  });

  it('pins every trait to a value its placeholder lists, by value id', () => {
    const byId = new Map((world.placeholders ?? []).map((ph) => [ph.id, ph]));
    for (const trait of world.traits) {
      const pin = trait.placeholderPins![0];
      const listed = byId.get(pin.placeholderId)?.values.map((v) => v.id) ?? [];
      expect(listed, trait.name).toContain(pin.valueId);
    }
  });
});

describe('the Open Chat tone traits', () => {
  const placeholders = world.placeholders ?? [];
  const groupTraits = (world.traitGroups ?? []).map((group) =>
    world.traits.filter((t) => t.groupId === group.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  const target = (trait: Trait): string => trait.placeholderPins![0].placeholderId;
  const defaultTraits = world.traits.filter((t) => t.isDefault);

  // Play's path: the active traits' pins, collected and laid over a playthrough with no rolls yet.
  const pinsFor = (active: Trait[], phs = placeholders) => collectPins({ traits: active, placeholders: phs });
  const valuesById = (active: Trait[], phs = placeholders): Record<string, string> =>
    Object.fromEntries(readPlaceholders({ placeholders: phs, rolls: {}, pins: pinsFor(active, phs) })
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

  const defaults = valuesById(defaultTraits);

  it('backs each group with its own placeholder listing all three values', () => {
    expect(placeholders).toHaveLength(3);
    for (const ph of placeholders) expect(ph.values, ph.name).toHaveLength(3);
    const targets = groupTraits.map((traits) => new Set(traits.map(target)));
    for (const set of targets) expect(set.size).toBe(1);
    expect(new Set(targets.map((set) => [...set][0])).size).toBe(3);
  });

  it('reads a listed, non-empty value for every placeholder when no trait is picked', () => {
    for (const ph of placeholders) {
      const value = valuesById([])[ph.id];
      expect(value.trim(), ph.name).not.toBe('');
      expect(ph.values.map((v) => v.text), ph.name).toContain(value);
    }
    expect(resolvedText([])).not.toContain('{{ph:');
  });

  it('reads the middle value of every placeholder under the default traits', () => {
    for (const ph of placeholders) expect(defaults[ph.id], ph.name).toBe(ph.values[1].text);
    const text = resolvedText(defaultTraits);
    for (const value of Object.values(defaults)) expect(text).toContain(value);
    expect(text).not.toContain('{{ph:');
  });

  // The prompt as play sends it carries one length instruction: the Reply Length value.
  it('sends the player length guidance nowhere in the narration prompt', () => {
    const text = resolvedText(defaultTraits);
    for (const mode of ['auto', 'single'] as const) expect(text).not.toContain(lengthGuidance(mode, 1024));
  });

  // Picking a trait replaces its group's default, as the exclusive picker does.
  it.each(groupTraits.flat().map((t) => [t.name, t] as const))('%s changes only its own placeholder', (_name, trait) => {
    const active = [...defaultTraits.filter((t) => t.groupId !== trait.groupId), trait];
    const pinned = valuesById(active);
    for (const ph of placeholders) {
      const value = pinned[ph.id];
      expect(value.trim(), ph.name).not.toBe('');
      if (ph.id !== target(trait)) expect(value, ph.name).toBe(defaults[ph.id]);
      else if (!trait.isDefault) expect(value, ph.name).not.toBe(defaults[ph.id]);
    }
    const text = resolvedText(active);
    expect(text).toContain(pinned[target(trait)]);
    expect(text).not.toContain('{{ph:');
  });

  it('follows an author edit of the pinned value text', () => {
    for (const trait of groupTraits.flat()) {
      const pin = trait.placeholderPins![0];
      const edited = placeholders.map((ph) => (ph.id !== pin.placeholderId ? ph : {
        ...ph, values: ph.values.map((v) => (v.id === pin.valueId ? { ...v, text: 'An edited value.' } : v)),
      }));
      expect(valuesById([trait], edited)[pin.placeholderId], trait.name).toBe('An edited value.');
    }
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
