import { describe, it, expect } from 'vitest';
import openChatRaw from '@/defaultworlds/open-chat.json?raw';
import rampageRaw from '@/defaultworlds/rampage.json?raw';
import emberwatchRaw from '@/defaultworlds/emberwatch.json?raw';
import { PROMPT_TEXT_DEFAULTS } from './GamePrompts';
import { BUILTIN_PRESETS, type PromptTextKey } from '@/lib/promptPresets';
import { buildStyledValues } from '@/lib/sectionStyle';
import { parsePromptTemplate, renderPromptTemplate } from '@/lib/promptTemplate';
import { splitToken, variableForToken, type PromptVariable } from '@/lib/promptVariables';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { migrateWorld } from '@/lib/version';
import { resolveOwners } from '@/lib/owners';
import { PLAYER_OWNER } from '@/lib/traitGates';
import { borneByPlayer } from '@/lib/ownedTraitsInPlay';
import { defaultPicks } from '@/lib/traitEffects';
import type { Entity, PlayerStat, Trait, TraitGroup, World } from '@/types';

// The six default prompts that carry the Persona block; the expectation is written out, not read from the templates.
const BLOCKED: PromptTextKey[] = [
  'characterPrompt', 'choicesPrompt', 'directorPrompt', 'storyboardPrompt', 'systemPrompt', 'thinkingPrompt',
];

const PERSONA = variableForToken('<PERSONA>')!;
const TRAITS = variableForToken('<TRAITS DESCRIPTION>')!;
const markdown = BUILTIN_PRESETS.find((b) => b.style === 'markdown')!;
const defaults = buildStyledValues(PROMPT_TEXT_DEFAULTS, markdown.style);

/** The chips of one kind a template carries, in order, with their header text. */
function chipsOf(template: string, variable: PromptVariable): Array<{ index: number; header?: string }> {
  return parsePromptTemplate(template).flatMap((seg, index) =>
    seg.type === 'variable' && variableForToken(seg.token) === variable
      ? [{ index, header: splitToken(seg.token)?.header }]
      : []);
}

/** The world's player traits when a world entity is played: the player owner's default traits, as a playthrough reads them. */
function traitsUnderWorldPersona(world: World, entity: Entity): { traits: Trait[]; traitGroups: TraitGroup[] } {
  const { owners } = resolveOwners(
    { traits: world.traits, traitGroups: world.traitGroups ?? [], entities: world.entities },
    { source: 'world', entityId: entity.id },
  );
  const player = owners.find((owner) => owner.id === PLAYER_OWNER)!;
  const active = new Set(defaultPicks(player.traits, player.groups));
  return { traits: borneByPlayer(player.traits.filter((trait) => active.has(trait.id))), traitGroups: borneByPlayer(player.groups) };
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

/** Rampage's opening, whose world keeps two loose stats, with a played library persona that owns one stat. */
function personaWithStats() {
  const calm: PlayerStat = {
    id: 'calm', name: 'Calm', type: 'number', description: 'Composure.', min: 0, max: 100, value: 10, regen: 0, descriptors: [],
  };
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
// The Persona prompts that read none of the player's stats.
const STAT_FREE: PromptTextKey[] = ['characterPrompt', 'directorPrompt', 'thinkingPrompt'];
const STATS = variableForToken('<STATS DESCRIPTION>')!;

describe('the Other Stats chip in the default prompts', () => {
  it.each(STATTED)('heads the Stats chip "Other Stats" after Other Traits in %s', (key) => {
    const stats = chipsOf(defaults[key], STATS);
    const traits = chipsOf(defaults[key], TRAITS);
    expect(stats.map((chip) => chip.header)).toEqual(['Other Stats']);
    expect(stats[0].index).toBeGreaterThan(traits[0].index);
  });

  it.each(STAT_FREE)("keeps the player's stats out of %s", (key) => {
    const out = renderPromptTemplate(defaults[key], chipValues(personaWithStats()));
    expect(chipsOf(defaults[key], STATS)).toEqual([]);
    expect(out).toContain('\n## Player Character\n');
    expect(out).not.toContain('Calm');
  });

  it("sends the persona's stats in the block of every prompt with Other Stats", () => {
    const values = chipValues(personaWithStats());
    for (const key of STATTED) {
      const out = renderPromptTemplate(defaults[key], values);
      expect(out, key).toContain('Calm');
      expect(out.indexOf('Calm'), key).toBeLessThan(out.indexOf('## Other Stats'));
    }
  });
});

describe('the Other Traits chip in the default prompts', () => {
  it.each(BLOCKED)('heads the Traits chip "Other Traits" after the Persona chip in %s', (key) => {
    const traits = chipsOf(defaults[key], TRAITS);
    // The narration prompt also carries a name-only Persona chip in its body; the block is the headed one.
    const block = chipsOf(defaults[key], PERSONA).filter((chip) => chip.header === 'Player Character');
    expect(traits.map((chip) => chip.header)).toEqual(['Other Traits']);
    expect(block).toHaveLength(1);
    expect(traits[0].index).toBeGreaterThan(block[0].index);
  });

  it('opens the player section at "## Other Traits" for a world with world traits and no persona', () => {
    const out = renderFor(openChatRaw);
    expect(out).toContain('\n## Other Traits\n');
    expect(out).not.toContain('Player Character');
    expect(out).not.toContain('\n## Traits\n');
  });

  it('drops the section, heading included, when the played world persona leaves no world player traits', () => {
    // The premise comes from Emberwatch's own data, not from the scene: its traits belong to entities, none to the player root.
    const world = migrateWorld(JSON.parse(emberwatchRaw));
    const sylvie = world.entities.find((entity) => entity.name === 'Sylvie Thornwhistle')!;
    expect(traitsUnderWorldPersona(world, sylvie).traits).toEqual([]);
    const out = renderFor(emberwatchRaw, 'Sylvie Thornwhistle');
    expect(out).toContain('\n## Player Character\n');
    expect(out).not.toContain('Other Traits');
    expect(out).not.toContain('\n## Traits\n');
  });
});
