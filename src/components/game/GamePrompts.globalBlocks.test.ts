import { describe, it, expect } from 'vitest';
import openChatRaw from '@/defaultworlds/open-chat.json?raw';
import rampageRaw from '@/defaultworlds/rampage.json?raw';
import emberwatchRaw from '@/defaultworlds/emberwatch.json?raw';
import { PROMPT_TEXT_DEFAULTS, textStatUpdatesPrompt } from './GamePrompts';
import { EXPERIMENTAL_PROMPT_VALUES } from './ExperimentalPrompts';
import { BUILTIN_PRESETS, PROMPT_TEXT_KEYS, type PromptTextKey } from '@/lib/promptPresets';
import { buildStyledValues } from '@/lib/sectionStyle';
import { parsePromptTemplate, renderPromptTemplate } from '@/lib/promptTemplate';
import { splitToken, variableForToken, type PromptVariable } from '@/lib/promptVariables';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { liveChipScene, type LiveSceneSources } from '@/lib/chipValues/liveScene';
import { resolveEntityText } from '@/lib/placeholders';
import { migrateWorld } from '@/lib/version';
import { resolveOwners } from '@/lib/owners';
import { borneByPlayer } from '@/lib/ownedTraitsInPlay';
import { defaultPicks } from '@/lib/traitEffects';
import type { Entity, PlayerStat, Trait, TraitGroup, World } from '@/types';

const PERSONA = variableForToken('<PERSONA>')!;
const TRAITS = variableForToken('<TRAITS DESCRIPTION>')!;
const STATS = variableForToken('<STATS DESCRIPTION>')!;
const markdown = BUILTIN_PRESETS.find((b) => b.style === 'markdown')!;
const defaults = buildStyledValues(PROMPT_TEXT_DEFAULTS, markdown.style);

/** The chips of one kind a template carries, in order, with their header text. */
function chipsOf(template: string, variable: PromptVariable): Array<{ index: number; header?: string }> {
  return parsePromptTemplate(template).flatMap((seg, index) =>
    seg.type === 'variable' && variableForToken(seg.token) === variable
      ? [{ index, header: splitToken(seg.token)?.header }]
      : []);
}

/** The text under `## heading`, up to the next heading. */
function section(out: string, heading: string): string {
  const start = out.indexOf(`\n## ${heading}\n`);
  if (start < 0) return '';
  const body = out.slice(start + heading.length + 5);
  const end = body.indexOf('\n## ');
  return end < 0 ? body : body.slice(0, end);
}

const openChat = migrateWorld(JSON.parse(openChatRaw));
// Every prompt the app ships with a Traits or Stats chip: each built-in preset's, the text pass's, and the
// Open Chat world's own.
const ALL_PROMPTS: Array<[string, string]> = [
  ...BUILTIN_PRESETS.flatMap((preset) => {
    const values = preset.id === 'experimental' ? EXPERIMENTAL_PROMPT_VALUES : buildStyledValues(PROMPT_TEXT_DEFAULTS, preset.style);
    return PROMPT_TEXT_KEYS.map((key): [string, string] => [`${preset.id} ${key}`, values[key]]);
  }),
  ['textStatUpdatesPrompt', textStatUpdatesPrompt],
  ['open-chat systemPrompt', openChat.worldOverview.promptOverrides?.systemPrompt ?? ''],
  ['open-chat choicesPrompt', openChat.worldOverview.promptOverrides?.choicesPrompt ?? ''],
];
const SHIPPED = ALL_PROMPTS.filter(([, template]) => chipsOf(template, TRAITS).length || chipsOf(template, STATS).length);

describe('the global blocks in every shipped prompt', () => {
  it('covers the prompts that place a Persona block', () => {
    const withBlock = SHIPPED.filter(([, template]) => chipsOf(template, PERSONA).some((chip) => chip.header));
    // Seven per markdown preset, plus the text pass and the two Open Chat prompts.
    expect(withBlock.length).toBeGreaterThanOrEqual(7 * BUILTIN_PRESETS.length + 3);
  });

  it.each(SHIPPED)('heads the global blocks Global Traits and Global Stats, before the Persona block, in %s (Q16, Q24)', (_name, template) => {
    const traits = chipsOf(template, TRAITS);
    const stats = chipsOf(template, STATS);
    expect(traits.map((chip) => chip.header)).toEqual(traits.map(() => 'Global Traits'));
    expect(stats.map((chip) => chip.header)).toEqual(stats.map(() => 'Global Stats'));
    const global = [...traits, ...stats];
    for (const block of chipsOf(template, PERSONA).filter((chip) => chip.header)) {
      for (const chip of global) expect(chip.index).toBeLessThan(block.index);
    }
  });

  it.each(SHIPPED)("never calls stats the player's in %s (Q12)", (_name, template) => {
    expect(template).not.toMatch(/player's (current )?stats|Other Stats|Other Traits/);
  });
});

/** The world's global traits when a world entity is played: global scope's default traits, as a playthrough reads them. */
function traitsUnderWorldPersona(world: World, entity: Entity): { traits: Trait[]; traitGroups: TraitGroup[] } {
  const { global } = resolveOwners(
    { traits: world.traits, traitGroups: world.traitGroups ?? [], entities: world.entities },
    { source: 'world', entityId: entity.id },
  );
  const active = new Set(defaultPicks(global.traits, global.groups));
  return { traits: borneByPlayer(global.traits.filter((trait) => active.has(trait.id))), traitGroups: borneByPlayer(global.groups) };
}

/** The narration prompt rendered for a bundled world's opening scene, or with a world entity played when one is given. */
function renderFor(raw: string, played?: string): string {
  const world = migrateWorld(JSON.parse(raw));
  const opening = authoredChipScene(world);
  const entity = played ? world.entities.find((candidate) => candidate.name === played)! : null;
  const scene = entity
    ? { ...opening, ...traitsUnderWorldPersona(world, entity), persona: { source: 'world' as const, entity }, playerName: entity.name }
    : opening;
  return renderPromptTemplate(defaults.systemPrompt, chipValues(scene));
}

const calm: PlayerStat = {
  id: 'calm', name: 'Calm', type: 'number', description: 'Composure.', min: 0, max: 100, value: 10, regen: 0, descriptors: [],
};

/** Rampage's opening, whose world keeps two global stats, with a played library persona that owns one stat. */
function personaWithStats() {
  const traveler: Entity = { id: 'traveler', name: 'Traveler', aiDescription: 'A road-worn traveler.', stats: [calm] };
  return {
    ...authoredChipScene(migrateWorld(JSON.parse(rampageRaw))),
    persona: { source: 'library' as const, entity: traveler },
    playerName: traveler.name,
    playedStats: [{ ownerId: traveler.id, stats: [calm] }],
  };
}

// The default prompts that carry a Stats chip; written out, not read from the templates.
const STATTED: PromptTextKey[] = ['choicesPrompt', 'storyboardPrompt', 'systemPrompt'];
// The Persona prompts that read none of the persona's stats.
const STAT_FREE: PromptTextKey[] = ['characterPrompt', 'directorPrompt', 'thinkingPrompt'];

describe("the persona's stats beside the global blocks", () => {
  it.each(STAT_FREE)("keeps the persona's stats out of %s", (key) => {
    const out = renderPromptTemplate(defaults[key], chipValues(personaWithStats()));
    expect(chipsOf(defaults[key], STATS)).toEqual([]);
    expect(out).toContain('\n## Player Character\n');
    expect(out).not.toContain('Calm');
  });

  it("sends the persona's stats in its block, after Global Stats, in every prompt with a Stats chip", () => {
    const values = chipValues(personaWithStats());
    for (const key of STATTED) {
      const out = renderPromptTemplate(defaults[key], values);
      expect(section(out, 'Player Character'), key).toContain('Calm');
      expect(section(out, 'Global Stats'), key).not.toContain('Calm');
      expect(out.indexOf('## Global Stats'), key).toBeLessThan(out.indexOf('## Player Character'));
    }
  });

  it('opens at "## Global Traits" for a world with world traits and no persona', () => {
    const out = renderFor(openChatRaw);
    expect(out).toContain('\n## Global Traits\n');
    expect(out).not.toContain('Player Character');
  });

  it('drops the section, heading included, when the played world persona leaves no global traits', () => {
    // The premise comes from Emberwatch's own data, not from the scene: its traits belong to entities, none to global scope.
    const world = migrateWorld(JSON.parse(emberwatchRaw));
    const sylvie = world.entities.find((entity) => entity.name === 'Sylvie Thornwhistle')!;
    expect(traitsUnderWorldPersona(world, sylvie).traits).toEqual([]);
    const out = renderFor(emberwatchRaw, 'Sylvie Thornwhistle');
    expect(out).toContain('\n## Player Character\n');
    expect(out).not.toContain('Global Traits');
  });
});

describe('the played entities in the narration request under each persona source (Q11, Q28)', () => {
  const nerve: PlayerStat = { ...calm, id: 'nerve', name: 'Nerve', description: 'Courage.', value: 70 };
  const destruction: PlayerStat = { ...calm, id: 'destruction', name: 'Destruction', description: 'How much of the city lies in ruins.', value: 40 };
  const scarred: Trait = { id: 'scarred', name: 'Scarred', aiDescription: 'A pale line across one cheek.', statChanges: [] };
  const lucky: Trait = { id: 'lucky', name: 'Lucky', aiDescription: 'Things tend to land well.', statChanges: [] };
  const custom: Entity = { id: 'custom', name: 'Custom Persona', customPersona: true, stats: [calm], traits: [scarred] };
  const resolveEntity = (entity: { name: string }, text: string) => resolveEntityText(entity, text, { placeholders: [], rolls: {} });
  const render = (over: Partial<LiveSceneSources>) => renderPromptTemplate(defaults.systemPrompt, chipValues(liveChipScene({
    overview: 'A city under siege.',
    stats: [destruction],
    statPlacement: { groups: [], authored: [destruction] },
    traits: [lucky],
    traitGroups: [],
    resolve: (text) => text,
    resolveTrait: (_trait, text, owner) => resolveEntity(owner ?? { name: '' }, text),
    resolveEntity,
    persona: null,
    location: null,
    locations: [],
    connections: [],
    entities: [],
    allEntities: [],
    participants: [],
    notes: '',
    time: null,
    placeholders: [],
    ...over,
  })));
  const expectPlayed = (out: string, stats: string[], traits: string[]) => {
    const block = section(out, 'Player Character');
    for (const name of [...stats, ...traits]) expect(block).toContain(name);
    expect(section(out, 'Global Stats')).toContain('Destruction');
    expect(section(out, 'Global Traits')).toContain('Lucky');
    for (const name of [...stats, ...traits]) {
      expect(section(out, 'Global Stats')).not.toContain(name);
      expect(section(out, 'Global Traits')).not.toContain(name);
    }
    expect(out.indexOf('## Global Stats')).toBeLessThan(out.indexOf('## Player Character'));
  };

  it("puts a world persona's stats in its block", () => {
    const knight: Entity = { id: 'knight', name: 'Knight', stats: [nerve] };
    expectPlayed(render({
      persona: { source: 'world', entity: knight }, playedEntities: [knight], entityStats: { knight: [nerve] },
    }), ['Nerve'], []);
  });

  it("puts a library persona's and the Custom Persona entity's stats and owned traits in one block", () => {
    const wanderer: Entity = { id: 'wanderer', name: 'Wanderer', stats: [nerve] };
    const out = render({
      persona: { source: 'library', entity: wanderer },
      playedEntities: [wanderer, custom],
      entityStats: { wanderer: [nerve], custom: [calm] },
      ownedTraits: { custom: { chosen: ['scarred'] } },
    });
    expectPlayed(out, ['Nerve', 'Calm'], ['Scarred']);
    // One entity block: the library persona's name heads it, the Custom Persona entity's never does.
    expect(section(out, 'Player Character')).not.toContain('Custom Persona');
  });

  it("puts the Custom Persona entity's stats in its block under None", () => {
    expectPlayed(render({
      persona: { source: 'custom', entity: custom },
      playedEntities: [custom],
      entityStats: { custom: [calm] },
      ownedTraits: { custom: { chosen: ['scarred'] } },
    }), ['Calm'], ['Scarred']);
  });
});
