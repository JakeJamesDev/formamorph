import { describe, it, expect } from 'vitest';
import { bundledWorldText } from '@/test/bundledWorldFiles';
import { migrateWorld } from './version';
import { DEFAULT_WORLDS } from './defaultWorlds';
import { runRules } from './testBench/rules';
import { planTurn, planHasPass } from './turnPipeline/planTurn';
import { HIDDEN_SETTING_DEFAULTS } from './settingsAdvancedData';
import { testInput } from './turnPipeline/turnTestInputs';
import type { TurnSettings } from './turnPipeline/turnPlan';
import { buildEnterFlow } from './enterFlow';
import { shownOptions } from './worldOptions';
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
import type { WorldOptionValue } from '@/types';
import { optionPinLists } from './worldOptions';
import { AS_LISTED } from '@/test/asListed';

// The stored text through the world migration, images included: the Test Bench pass below reads them.
const world = migrateWorld(JSON.parse(bundledWorldText('open-chat')));
const chipIds = (text: string) => directChipTargets([text]);
const byName = (name: string) => (world.placeholders ?? []).find((ph) => ph.name === name)!.id;

describe('the Open Chat default world', () => {
  it('is listed as a bundled default under its stable id, waiting for a library entity', () => {
    expect(DEFAULT_WORLDS).toContainEqual({ id: 'open-chat', defaultName: 'Open Chat', needsLibraryEntity: true });
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
    for (const label of ['Library Additions', 'Persona', ...(world.options ?? []).map((o) => o.name)]) {
      expect(intro, label).toContain(`**${label}**`);
    }
    // Group chats are a smoke case only, so the readme asks for one entity.
    expect(intro).toMatch(/\bone entity\b/);
    expect(intro).not.toContain(SETTINGS_COPY.narrationLayout.label);
  });

  it('opens setup on the intro readme, before the Option and trait picks', () => {
    const steps = buildEnterFlow({
      introReadme: world.worldOverview.introReadme, traitCount: world.traits.length,
      shownOptionCount: shownOptions(world.options).length,
      startingLocationCount: world.locations.length, hasLibraryAdditions: false, hasWorldPersonas: false, hasCustomPersona: false, showsAvatar: false,
    }, 'newGame');
    expect(steps).toEqual(['intro', 'workspace']);
  });

  it('names each setting in the gameplay readme by its live label', () => {
    const readme = world.worldOverview.readme ?? '';
    const tab = (value: string) => SETTINGS_TABS.find((t) => t.value === value)?.label;
    const chat = NARRATION_LAYOUTS.find((o) => o.value === 'chat')?.label;
    for (const label of [
      tab('display'), SETTINGS_COPY.narrationLayout.label, chat,
      tab('output'), SETTINGS_COPY.systemPrompts.label, 'Choices', 'World Options',
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

  it('gives its location image tags for the generator', () => {
    for (const location of world.locations) expect(location.imageTags?.trim(), location.name).toBeTruthy();
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

  it.each(['narration', 'choices'] as const)('places Global Traits, then Global Stats, before the headed Persona chip in its %s prompt', (kind) => {
    const placed = parsePromptTemplate(worldPrompt(world.worldOverview, kind) ?? '').flatMap((s) => {
      const parts = s.type === 'variable' ? splitToken(s.token) : null;
      return parts?.header ? [`${parts.base}: ${parts.header}`] : [];
    });
    const persona = placed.findIndex((chip) => chip.startsWith('<PERSONA>'));
    expect(persona).toBeGreaterThan(-1);
    expect(placed.slice(persona - 2, persona)).toEqual(['<TRAITS DESCRIPTION>: Global Traits', '<STATS DESCRIPTION>: Global Stats']);
  });

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
    expect(world.worldOverview.allowedPersonas).toBeUndefined();
    expect(world.worldOverview.startPersona).toBeUndefined();
    expect('openingsEnabled' in world.worldOverview).toBe(false);
    const openings = world.worldOverview.openings ?? [];
    expect(openings).toHaveLength(1);
    expect(openings[0].kind).toBe('action');
    expect(openings[0].text.trim()).not.toBe('');
  });

  it('offers three World Options of three values, shown at setup and changeable mid-game, the middle one the default', () => {
    const options = world.options ?? [];
    expect(options.map((o) => o.name)).toEqual(['Reply Length', 'Style', 'Pacing']);
    for (const option of options) {
      if (option.type !== 'choice') throw new Error(`${option.name} is not a choice`);
      expect(option.shownToPlayer, option.name).toBe(true);
      expect(option.midGame, option.name).toBe(true);
      expect(option.values, option.name).toHaveLength(3);
      expect(option.default, option.name).toBe(option.values[1].id);
      // A Style value carries the frame: the voice block, the choice shape, and the opening.
      for (const value of option.values) expect(value.placeholderPins, value.name).toHaveLength(option.name === 'Style' ? 3 : 1);
    }
  });

  it('leaves no traits behind from the three tone groups', () => {
    expect(world.traits).toEqual([]);
    expect(world.traitGroups ?? []).toEqual([]);
  });

  it('pins every Option value to a value its placeholder lists, by value id', () => {
    const byId = new Map((world.placeholders ?? []).map((ph) => [ph.id, ph]));
    for (const option of world.options ?? []) {
      if (option.type !== 'choice') continue;
      for (const value of option.values) {
        for (const pin of value.placeholderPins ?? []) {
          const listed = byId.get(pin.placeholderId)?.values.map((v) => v.id) ?? [];
          expect(listed, value.name).toContain(pin.valueId);
        }
      }
    }
  });

  // The Style trait carries the frame, so each surface reads its own chip and states no frame of its own.
  it('places each frame chip in its own surface, and neither prompt states a voice outside its chips', () => {
    const narration = worldPrompt(world.worldOverview, 'narration') ?? '';
    const choices = worldPrompt(world.worldOverview, 'choices') ?? '';
    expect(chipIds(narration)).toEqual(new Set([byName('Reply Length'), byName('Voice Block'), byName('Pacing')]));
    expect(chipIds(choices)).toEqual(new Set([byName('Choice Shape')]));
    expect(world.worldOverview.openings!.map((o) => [...chipIds(o.text)])).toEqual([[byName('Opening')]]);
    for (const [kind, text] of [['narration', narration], ['choices', choices]]) {
      const bare = parsePlaceholderText(text).map((s) => (s.type === 'text' ? s.value : '')).join('');
      expect(bare, kind).not.toMatch(/first person|second person|third person|quotation|asterisk|present tense|text message|narrat/i);
    }
  });
});

describe('the Open Chat tone Options', () => {
  const placeholders = world.placeholders ?? [];
  const options = (world.options ?? []).flatMap((o) => (o.type === 'choice' ? [o] : []));
  /** One pick per Option: its value id. An Option left out reads its default. */
  type Picks = Record<string, string>;
  const targets = (value: WorldOptionValue): Set<string> => new Set((value.placeholderPins ?? []).map((p) => p.placeholderId));
  const idOf = (name: string) => options.find((o) => o.name === name)!.id;

  // Play's path: the Options' pins at their current values, collected and laid over a playthrough with no rolls yet.
  const pinsFor = (picks: Picks, phs = placeholders) =>
    collectPins({ traits: [], options: optionPinLists(world.options, picks), placeholders: phs });
  const valuesById = (picks: Picks, phs = placeholders): Record<string, string> =>
    Object.fromEntries(readPlaceholders({ placeholders: phs, rolls: {}, pins: pinsFor(picks, phs) })
      .map((r) => [r.id, r.value]));
  // What play sends and shows: both system prompts with the world's chips keyed at the seam, and the drawn opening.
  const surfaces = (picks: Picks) => {
    const overview = world.worldOverview;
    const pins = pinsFor(picks);
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
    const drawn = drawOpening(openingPool({ placesOf: AS_LISTED, overview }), () => 0);
    const opening = resolvePlaceholders(drawn.text, { placeholders, rolls: {}, pins, player: { name: null, kind: 'opening' } });
    return { narration, choices, opening };
  };
  const resolvedText = (picks: Picks) => surfaces(picks).narration;
  const allText = (picks: Picks) => Object.values(surfaces(picks)).join('\n');

  const defaults = valuesById({});

  // Every value of an Option pins the same placeholders, at the value of its own place in the Option.
  it('backs each Option with placeholders of its own, each listing all three values', () => {
    expect(placeholders).toHaveLength(5);
    for (const ph of placeholders) expect(ph.values, ph.name).toHaveLength(3);
    const optionTargets = options.map((option) => {
      option.values.forEach((value, place) => {
        for (const pin of value.placeholderPins ?? []) {
          const values = placeholders.find((ph) => ph.id === pin.placeholderId)!.values;
          expect(values.findIndex((v) => v.id === pin.valueId), value.name).toBe(place);
        }
      });
      const sets = option.values.map((v) => [...targets(v)].sort().join());
      expect(new Set(sets).size).toBe(1);
      return sets[0].split(',');
    });
    expect(optionTargets.map((ids) => ids.length)).toEqual([1, 3, 1]);
    expect(new Set(optionTargets.flat()).size).toBe(5);
  });

  it('reads a listed, non-empty value for every placeholder at the defaults', () => {
    for (const ph of placeholders) {
      const value = defaults[ph.id];
      expect(value.trim(), ph.name).not.toBe('');
      expect(ph.values.map((v) => v.text), ph.name).toContain(value);
    }
    expect(allText({})).not.toContain('{{ph:');
  });

  it('reads the middle value of every placeholder at the defaults', () => {
    for (const ph of placeholders) expect(defaults[ph.id], ph.name).toBe(ph.values[1].text);
    const text = allText({});
    for (const value of Object.values(defaults)) expect(text).toContain(value);
    expect(text).not.toContain('{{ph:');
  });

  // A save from before Options holds no picks, a stale id is not a value of the Option: both read the defaults.
  it('reads the defaults for a save with no picks or a stale pick', () => {
    expect(valuesById({ [idOf('Style')]: 'a-value-id-the-world-no-longer-has' })).toEqual(defaults);
  });

  // The prompt as play sends it carries one length instruction: the Reply Length value.
  it('sends the player length guidance nowhere in the narration prompt', () => {
    const text = resolvedText({});
    for (const mode of ['auto', 'single'] as const) expect(text).not.toContain(lengthGuidance(mode, 1024));
  });

  // Picking a value replaces the Option's default, as the picker does.
  const allValues = options.flatMap((option) => option.values.map((value) => [`${option.name}: ${value.name}`, option, value] as const));
  it.each(allValues)('%s changes only its own placeholder', (_name, option, value) => {
    const picks = { [option.id]: value.id };
    const pinned = valuesById(picks);
    for (const ph of placeholders) {
      const text = pinned[ph.id];
      expect(text.trim(), ph.name).not.toBe('');
      if (!targets(value).has(ph.id)) expect(text, ph.name).toBe(defaults[ph.id]);
      else if (value.id !== option.default) expect(text, ph.name).not.toBe(defaults[ph.id]);
    }
    const text = allText(picks);
    for (const id of targets(value)) expect(text).toContain(pinned[id]);
    expect(text).not.toContain('{{ph:');
  });

  it('follows an author edit of the pinned value text', () => {
    for (const option of options) {
      for (const value of option.values) {
        for (const pin of value.placeholderPins ?? []) {
          const edited = placeholders.map((ph) => (ph.id !== pin.placeholderId ? ph : {
            ...ph, values: ph.values.map((v) => (v.id === pin.valueId ? { ...v, text: 'An edited value.' } : v)),
          }));
          expect(valuesById({ [option.id]: value.id }, edited)[pin.placeholderId], value.name).toBe('An edited value.');
        }
      }
    }
  });

  describe('under each Style', () => {
    const style = options.find((o) => o.name === 'Style')!;
    const rendered = style.values.map((value) => ({ value, ...surfaces({ [style.id]: value.id }) }));

    it.each(['narration', 'choices', 'opening'] as const)('renders a %s unlike the other two Styles', (surface) => {
      const texts = rendered.map((r) => r[surface]);
      expect(new Set(texts).size, surface).toBe(3);
    });

    // A chip inline after a bullet would prefix only the block's first line, so each block stands on its own lines.
    it.each(style.values.map((v) => [v.name, v] as const))('%s sends every frame value whole, line by line', (_name, value) => {
      const { narration, choices, opening } = rendered.find((r) => r.value === value)!;
      const pinned = valuesById({ [style.id]: value.id });
      const voice = pinned[byName('Voice Block')];
      const shape = pinned[byName('Choice Shape')];
      for (const block of [voice, shape]) expect(block.split('\n').length).toBeGreaterThan(1);
      expect(narration).toContain(`\n${voice}\n`);
      expect(choices).toContain(`\n${shape}\n`);
      expect(opening).toBe(pinned[byName('Opening')]);
      for (const name of ['Reply Length', 'Pacing']) {
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
