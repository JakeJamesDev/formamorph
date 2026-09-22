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
import { directChipTargets, parsePlaceholderText, readPlaceholders, resolvePlaceholders } from './placeholders';
import { drawOpening, openingPool } from './openings';
import { choicesSystemPrompt } from './turnPipeline/turnPasses';
import { parsePromptTemplate } from './promptTemplate';
import { splitToken } from './promptVariables';
import { buildNarrationPrompt } from './turnPipeline/narrationPrompt';
import { lengthGuidance } from './outputLength';
import {
  SHIPPED_PROMPT_DEFAULTS, customizedPromptKinds, resolveWorldPrompt, worldPrompt, worldPromptChipValues,
  worldPromptEnabled,
} from './worldPrompt';
import { defaultChoicesPrompt, defaultSystemPrompt } from '@/components/game/GamePrompts';
import { SETTINGS_COPY } from '@/components/modals/settingsCopy';
import { SETTINGS_TABS } from '@/components/modals/settingsTabs';
import { NARRATION_LAYOUTS } from '@/contexts/settingsDefaults';
import type { Trait } from '@/types';

// Loaded the way the seeder loads it: raw text through the world migration.
const world = migrateWorld(JSON.parse(raw));
const chipIds = (text: string) => directChipTargets([text]);
const byName = (name: string) => (world.placeholders ?? []).find((ph) => ph.name === name)!.id;

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
    expect(groups.map((g) => g.name)).toEqual(['Reply Length', 'Style', 'Pacing']);
    for (const group of groups) {
      expect(group.exclusive, group.name).toBe(true);
      const members = world.traits.filter((t) => t.groupId === group.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      expect(members, group.name).toHaveLength(3);
      expect(members.map((t) => t.isDefault === true), group.name).toEqual([false, true, false]);
      for (const trait of members) {
        expect(trait.playerToggle, trait.name).toBe(true);
        expect(trait.statChanges, trait.name).toEqual([]);
        // A Style trait carries the frame: the voice block, the choice shape, and the opening.
        expect(trait.placeholderPins, trait.name).toHaveLength(group.name === 'Style' ? 3 : 1);
      }
    }
    expect(world.traits).toHaveLength(9);
  });

  it('pins every trait to a value its placeholder lists, by value id', () => {
    const byId = new Map((world.placeholders ?? []).map((ph) => [ph.id, ph]));
    for (const trait of world.traits) {
      for (const pin of trait.placeholderPins ?? []) {
        const listed = byId.get(pin.placeholderId)?.values.map((v) => v.id) ?? [];
        expect(listed, trait.name).toContain(pin.valueId);
      }
    }
  });

  // The Style trait carries the frame, so each surface reads its own chip and states no frame of its own.
  it('places each frame chip in its own surface, and neither prompt states a voice outside its chips', () => {
    const narration = worldPrompt(world.worldOverview, 'narration') ?? '';
    const choices = worldPrompt(world.worldOverview, 'choices') ?? '';
    expect(chipIds(narration)).toEqual(new Set([byName('reply length'), byName('voice block'), byName('pacing')]));
    expect(chipIds(choices)).toEqual(new Set([byName('choice shape')]));
    expect(world.worldOverview.openings!.map((o) => [...chipIds(o.text)])).toEqual([[byName('opening')]]);
    for (const [kind, text] of [['narration', narration], ['choices', choices]]) {
      const bare = parsePlaceholderText(text).map((s) => (s.type === 'text' ? s.value : '')).join('');
      expect(bare, kind).not.toMatch(/first person|second person|third person|quotation|asterisk|present tense|text message|narrat/i);
    }
  });
});

describe('the Open Chat tone traits', () => {
  const placeholders = world.placeholders ?? [];
  const groupTraits = (world.traitGroups ?? []).map((group) =>
    world.traits.filter((t) => t.groupId === group.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  const targets = (trait: Trait): Set<string> => new Set((trait.placeholderPins ?? []).map((p) => p.placeholderId));
  const defaultTraits = world.traits.filter((t) => t.isDefault);

  // Play's path: the active traits' pins, collected and laid over a playthrough with no rolls yet.
  const pinsFor = (active: Trait[], phs = placeholders) => collectPins({ traits: active, placeholders: phs });
  const valuesById = (active: Trait[], phs = placeholders): Record<string, string> =>
    Object.fromEntries(readPlaceholders({ placeholders: phs, rolls: {}, pins: pinsFor(active, phs) })
      .map((r) => [r.id, r.value]));
  // What play sends and shows: both system prompts with the world's chips keyed at the seam, and the drawn opening.
  const surfaces = (active: Trait[]) => {
    const overview = world.worldOverview;
    const pins = pinsFor(active);
    const resolvePH = (text: string) => resolvePlaceholders(text, { placeholders, rolls: {}, pins });
    const chips = worldPromptChipValues(overview, false, resolvePH);
    const narration = buildNarrationPrompt({
      template: resolveWorldPrompt(overview, 'narration', defaultSystemPrompt, false),
      ctx: { ...chips, '<WORLD DESCRIPTION>': resolvePH(overview.systemPrompt) },
      action: '', history: [], dictionary: [], actionVec: null, semanticLore: false, embedVectors: new Map(),
      language: 'English', paragraphLimit: 'auto', maxTokens: 1024, markdownOutput: true,
      sectionStyle: 'markdown', resolvePH,
    }).prompt;
    const choices = choicesSystemPrompt(resolveWorldPrompt(overview, 'choices', defaultChoicesPrompt, false), 'English', chips);
    const drawn = drawOpening(openingPool({ overview }), () => 0);
    const opening = resolvePlaceholders(drawn.text, { placeholders, rolls: {}, pins, player: { name: null, kind: 'opening' } });
    return { narration, choices, opening };
  };
  const resolvedText = (active: Trait[]) => surfaces(active).narration;
  const allText = (active: Trait[]) => Object.values(surfaces(active)).join('\n');

  const defaults = valuesById(defaultTraits);

  // Every trait of a group pins the same placeholders, at the value of its own place in the group.
  it('backs each group with placeholders of its own, each listing all three values', () => {
    expect(placeholders).toHaveLength(5);
    for (const ph of placeholders) expect(ph.values, ph.name).toHaveLength(3);
    const groupTargets = groupTraits.map((traits) => {
      for (const trait of traits) {
        for (const pin of trait.placeholderPins ?? []) {
          const values = placeholders.find((ph) => ph.id === pin.placeholderId)!.values;
          expect(values.findIndex((v) => v.id === pin.valueId), trait.name).toBe(trait.order);
        }
      }
      const sets = traits.map((t) => [...targets(t)].sort().join());
      expect(new Set(sets).size).toBe(1);
      return sets[0].split(',');
    });
    expect(groupTargets.map((ids) => ids.length)).toEqual([1, 3, 1]);
    expect(new Set(groupTargets.flat()).size).toBe(5);
  });

  it('reads a listed, non-empty value for every placeholder when no trait is picked', () => {
    for (const ph of placeholders) {
      const value = valuesById([])[ph.id];
      expect(value.trim(), ph.name).not.toBe('');
      expect(ph.values.map((v) => v.text), ph.name).toContain(value);
    }
    expect(allText([])).not.toContain('{{ph:');
  });

  it('reads the middle value of every placeholder under the default traits', () => {
    for (const ph of placeholders) expect(defaults[ph.id], ph.name).toBe(ph.values[1].text);
    const text = allText(defaultTraits);
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
      if (!targets(trait).has(ph.id)) expect(value, ph.name).toBe(defaults[ph.id]);
      else if (!trait.isDefault) expect(value, ph.name).not.toBe(defaults[ph.id]);
    }
    const text = allText(active);
    for (const id of targets(trait)) expect(text).toContain(pinned[id]);
    expect(text).not.toContain('{{ph:');
  });

  it('follows an author edit of the pinned value text', () => {
    for (const trait of groupTraits.flat()) {
      for (const pin of trait.placeholderPins ?? []) {
        const edited = placeholders.map((ph) => (ph.id !== pin.placeholderId ? ph : {
          ...ph, values: ph.values.map((v) => (v.id === pin.valueId ? { ...v, text: 'An edited value.' } : v)),
        }));
        expect(valuesById([trait], edited)[pin.placeholderId], trait.name).toBe('An edited value.');
      }
    }
  });

  describe('under each Style', () => {
    const styleGroup = (world.traitGroups ?? []).find((g) => g.name === 'Style')?.id;
    const styles = groupTraits.find((traits) => traits[0]?.groupId === styleGroup) ?? [];
    const underStyle = (style: Trait) => surfaces([...defaultTraits.filter((t) => t.groupId !== style.groupId), style]);
    const rendered = styles.map((style) => ({ style, ...underStyle(style) }));

    it.each(['narration', 'choices', 'opening'] as const)('renders a %s unlike the other two Styles', (surface) => {
      const texts = rendered.map((r) => r[surface]);
      expect(new Set(texts).size, surface).toBe(3);
    });

    // A chip inline after a bullet would prefix only the block's first line, so each block stands on its own lines.
    it.each(styles.map((s) => [s.name, s] as const))('%s sends every frame value whole, line by line', (_name, style) => {
      const { narration, choices, opening } = rendered.find((r) => r.style === style)!;
      const pinned = valuesById([...defaultTraits.filter((t) => t.groupId !== style.groupId), style]);
      const voice = pinned[byName('voice block')];
      const shape = pinned[byName('choice shape')];
      for (const block of [voice, shape]) expect(block.split('\n').length).toBeGreaterThan(1);
      expect(narration).toContain(`\n${voice}\n`);
      expect(choices).toContain(`\n${shape}\n`);
      expect(opening).toBe(pinned[byName('opening')]);
      for (const name of ['reply length', 'pacing']) {
        expect(pinned[byName(name)].trim(), name).not.toBe('');
        expect(narration, name).toContain(pinned[byName(name)]);
      }
      for (const text of [narration, choices, opening]) {
        expect(text.trim()).not.toBe('');
        expect(text).not.toContain('{{ph:');
      }
    });
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
