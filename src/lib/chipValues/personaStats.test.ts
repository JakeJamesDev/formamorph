import { describe, it, expect } from 'vitest';
import { chipValues } from './chipValues';
import type { ChipScene } from './chipScene';
import { defaultStatUpdatesPrompt, textStatUpdatesPrompt } from '@/components/game/GamePrompts';
import { renderPromptTemplate } from '../promptTemplate';
import { layerValues } from '../promptValues';
import { createStatRequest, keyedScene, statRequestSchema } from '../statRequest';
import { NONE_PLACEHOLDER } from '../promptFallbacks';
import { ownerStatParts, statPlacementOf } from '../statContext';
import type { ResolvedPersona } from '../persona';
import type { Entity, PlayerStat, StatGroup, Trait } from '@/types';

const health: PlayerStat = {
  id: 'health', name: 'Health', type: 'number', description: 'Physical stamina.', min: 0, max: 100, value: 62, regen: 0,
  descriptors: [{ id: 'd1', threshold: 70, description: 'Winded' }, { id: 'd2', threshold: 100, description: 'Hale' }],
};
// The persona's own Health clashes with the world's, so the stat request keys it "Health (2)".
const ownHealth: PlayerStat = { ...health, id: 'own-health', value: 10, description: 'Old wounds.', groupId: 'body' };
const calm: PlayerStat = { ...health, id: 'calm', name: 'Calm', description: 'Composure.', value: 30, descriptors: [] };
const body: StatGroup = { id: 'body', name: 'Body', parentId: null };
const scarred: Trait = { id: 'scarred', name: 'Scarred', aiDescription: 'A pale line across one cheek.', statChanges: [] };

const traveler: Entity = {
  id: 'traveler', name: 'Traveler', pronouns: 'they/them', aiDescription: 'A road-worn traveler.', aiSummary: 'A quiet traveler.',
  traits: [scarred], stats: [ownHealth, calm], statGroups: [body],
};
const persona: ResolvedPersona = { entity: traveler, source: 'library' };
// The traveler's stats as the scene and the stat request each hold them.
const [travelerPart] = ownerStatParts([traveler], { traveler: [ownHealth, calm] });
const travelerOwner = { id: 'traveler', name: 'Traveler', stats: [ownHealth, calm], placement: statPlacementOf(traveler) };

const scene = (over: Partial<ChipScene> = {}): ChipScene => ({
  overview: 'A quiet stretch of coast.',
  stats: [health],
  traits: [],
  traitGroups: [],
  ownedTraits: { traveler: ['scarred'] },
  ownedStats: { traveler: [ownHealth, calm] },
  playedStats: [travelerPart],
  persona,
  playerName: 'Traveler',
  location: null,
  locations: [],
  connections: [],
  entities: [],
  presentIds: [],
  inSceneIds: [],
  lore: [],
  notes: '',
  time: null,
  resolve: (text) => text,
  ...over,
});

describe("the persona's own stats in the Persona chip", () => {
  const values = chipValues(scene());

  it('nests the stats after the traits, under its own groups, in each format', () => {
    expect(values('<PERSONA|markdown>')).toContain([
      '  - **stats:**',
      '    - **Calm:** 30/100 — Composure.',
      '    - **Body:**',
      '      - **Health (2):** 10/100 (Winded) — Old wounds.',
    ].join('\n'));
    expect(values('<PERSONA>')).toContain('  stats:\n    Calm: 30/100 — Composure.\n    Body:\n      Health (2): 10/100 (Winded) — Old wounds.');
    expect(values('<PERSONA|xml>')).toContain('  <stats>\n');
    expect(values('<PERSONA|xml>')).toContain('<name>Health (2)</name>');
    for (const token of ['<PERSONA>', '<PERSONA|markdown>', '<PERSONA|xml>']) {
      expect(values(token)!.indexOf('Scarred')).toBeGreaterThan(-1);
      expect(values(token)!.indexOf('Scarred')).toBeLessThan(values(token)!.indexOf('Calm'));
    }
  });

  it('leaves the Stats chip holding the world stats alone', () => {
    expect(values('<STATS DESCRIPTION|numbers>')).toBe('Health: 62/100');
    expect(values('<STATS DESCRIPTION|numbers.meaning.markdown>')).toBe('- **Health:** 62/100 — Physical stamina.');
  });

  it('names a clashing stat by the numbered key the stat request gives it', () => {
    const request = createStatRequest([health], {
      persona: travelerOwner,
    });
    expect(request.targets.find((target) => target.id === 'own-health')?.key).toBe('Health (2)');
    expect(values('<PERSONA|markdown>')).toContain('**Health (2):**');
    expect(values('<PERSONA|markdown>')).not.toMatch(/\*\*Health:\*\*/);
  });

  it('keeps the stats block in Summary, with the trait names on one line', () => {
    expect(values('<PERSONA|summary>')).toContain('  traits: Scarred\n  stats:\n    Calm: 30/100 — Composure.');
  });

  it('drops the stats field in the No Stats state, and leaves Name bare', () => {
    for (const token of ['<PERSONA|nostats>', '<PERSONA|summary.nostats.markdown>', '<PERSONA|nostats.xml>']) {
      expect(values(token)).toContain('Scarred');
      expect(values(token)).not.toMatch(/stats/);
      expect(values(token)).not.toContain('Calm');
    }
    expect(values('<PERSONA|name>')).toBe('Traveler (they/them)');
  });

  it('shows no stats field for a persona that owns none', () => {
    const bare = chipValues(scene({ ownedStats: {}, playedStats: [{ ownerId: 'traveler', stats: [] }] }));
    expect(bare('<PERSONA|markdown>')).toContain('Scarred');
    expect(bare('<PERSONA|markdown>')).not.toContain('stats');
    expect(bare('<STATS DESCRIPTION|numbers>')).toBe('Health: 62/100');
  });

  it('reads the none placeholder with no persona, and the played stats stay with the world stats', () => {
    const none = chipValues(scene({ persona: null, playerName: null }));
    expect(none('<PERSONA|markdown>')).toBe(NONE_PLACEHOLDER);
    expect(none('<STATS DESCRIPTION|numbers>')).toBe('Health: 62/100\nCalm: 30/100\nBody:\n  Health (2): 10/100');
  });

  it("puts another played entity's stats and owned traits in the Persona chip, under its own groups (Q11, Q28)", () => {
    // Under a library persona the Custom Persona entity plays too. It shares a stat id, a group id and a trait
    // id with the traveler, so only owner-scoped ids keep each in its place.
    const marked: PlayerStat = { ...health, id: 'own-health', value: 40, description: 'Brand marks.', groupId: 'body' };
    const markBody: StatGroup = { id: 'body', name: 'Marks', parentId: null };
    const branded: Trait = { id: 'scarred', name: 'Branded', aiDescription: 'A brand on one wrist.', statChanges: [] };
    const custom: Entity = { id: 'custom', name: 'You', customPersona: true, stats: [marked], statGroups: [markBody], traits: [branded] };
    const both = chipValues(scene({
      playedStats: [travelerPart, ...ownerStatParts([custom], { custom: [marked] })],
      playedEntities: [traveler, custom],
      ownedTraits: { traveler: ['scarred'], custom: ['scarred'] },
    }));
    expect(both('<STATS DESCRIPTION|numbers>')).toBe('Health: 62/100');
    const block = both('<PERSONA|markdown>')!;
    expect(block).toContain([
      '  - **stats:**',
      '    - **Calm:** 30/100 — Composure.',
      '    - **Body:**',
      '      - **Health (2):** 10/100 (Winded) — Old wounds.',
      '    - **Marks:**',
      '      - **Health (3):** 40/100 (Winded) — Brand marks.',
    ].join('\n'));
    expect(block).toContain('**Scarred:** A pale line across one cheek.');
    expect(block).toContain('**Branded:** A brand on one wrist.');
    // One entity block, headed by the persona.
    expect(block.match(/^- \*\*/gm)).toHaveLength(1);
    expect(block).not.toContain('You');
  });
});

describe('the stat request with a played persona that owns stats', () => {
  const request = createStatRequest([health], {
    persona: travelerOwner,
  });
  const ctx = chipValues(keyedScene(scene(), request));

  it('renders the schema prompt in owner blocks, its keys, and the text pass in the same owner blocks', () => {
    expect(renderPromptTemplate(defaultStatUpdatesPrompt, layerValues(ctx, request.context))).toMatchInlineSnapshot(`
      "You are the stat tracker for an interactive roleplay. Each stat is a number that tracks one thing about one character, and it changes only when the story changes it. The narrator reads the stats each turn to decide what the characters can do and how they act. You read what happened this turn and record how it moved the stats of each character listed below. Your entire output is one JSON object - nothing else.

      ## Game World
      A quiet stretch of coast.

      ## Stats
      Each character's stats sit under their name and belong to that character: the player's character in the Player Character block, each other character present this turn in the In Scene block. The Global Stats block holds the stats that belong to no character. When stats sit in groups, a group bullet names what the stats nested under it share. A group holds no reading of its own; you record changes on its stats.
      Current readings (shown as current-value/maximum) with what each stat means, so you know each stat's level, range, and purpose. Output only the CHANGE this turn, never a value and never that value/max format.

      ## Global Stats
      - **Health:** 62/100 — Physical stamina.

      ## Player Character
      - **Traveler**
        - **pronouns:** they/them
        - **summary:** A quiet traveler.
        - **traits:** Scarred
        - **stats:**
          - **Calm:** 30/100 — Composure.
          - **Body:**
            - **Health (2):** 10/100 (Winded) — Old wounds.

      ## What to change
      - The RIGHT stat in the RIGHT direction is what matters most. A rough amount on the stat the turn actually moved beats a precise amount on the wrong one.
      - Many turns move no stat at all. Outputting nothing is a correct and common answer: a calm, idle, or purely conversational turn usually changes nothing. Never invent a change just to have something to write.
      - List a stat only for a change you can point to in the narration - a real exertion, injury, loss, or gain, or a clear shift in how a character regards the player. A stat being relevant, on the character's mind, or thematically related is NOT a change. When you're unsure whether a stat moved, leave it out.
      - Report each stat that genuinely moved and no others. If two stats plainly shifted, give both; if one did, give one; if none did, give nothing. Don't pad the list with a related-but-unmoved stat, and don't drop one the turn clearly hit.
      - The amount is a rough judgment, not a calculation - no one knows the exact number. Pick a small whole number scaled loosely to the stat's range and how big the moment was, and commit to it. Never report the value because you're unsure of the change.
      - Each stat belongs to the character it sits under. A stat moves only for what that character does, goes through, or feels this turn.

      ## Format
      - One key per character: "Player Character" for the player's character, each In Scene character's name exactly as the block shows it, and "Global Stats" for the Global Stats block. Under it, two keys per stat of that character: the stat's name, holding this turn's change to the stat's value, and the stat's name followed by " max", holding this turn's change to the stat's maximum. Each is one signed whole number.
      - Put the sign on the number: a leading minus lowers the stat.
      - Only a value or maximum the turn did not touch gets 0. A slight but clear shift gets a noticeable number, a small share of the stat's range.
      - Write the whole object on one line."
    `);
    expect(renderPromptTemplate(textStatUpdatesPrompt, layerValues(ctx, request.context))).toMatchInlineSnapshot(`
      "You are the stat tracker for an interactive roleplay. You read what happened this turn and record how it moved the stats of the player's character and of the world. Your entire output is stat-change lines - nothing else.

      ## Game World
      A quiet stretch of coast.

      ## Stats
      The Global Stats block holds the stats that belong to no character. When there is a Player Character block, it holds the player character's stats.
      Current readings (shown as current-value/maximum) with what each stat means, so you know each stat's level, range, and purpose. Output only the CHANGE this turn, never a value and never that value/max format.

      ## Global Stats
      - **Health:** 62/100 — Physical stamina.

      ## Player Character
      - **Traveler**
        - **pronouns:** they/them
        - **summary:** A quiet traveler.
        - **traits:** Scarred
        - **stats:**
          - **Calm:** 30/100 — Composure.
          - **Body:**
            - **Health (2):** 10/100 (Winded) — Old wounds.

      ## What to change
      - The RIGHT stat in the RIGHT direction is what matters most. A rough amount on the stat the turn actually moved beats a precise amount on the wrong one.
      - Many turns move no stat at all. Outputting nothing is a correct and common answer: a calm, idle, or purely conversational turn usually changes nothing. Never invent a change just to have something to write.
      - List a stat only for a change you can point to in the narration - a real exertion, injury, loss, or gain. A stat being relevant, on the character's mind, or thematically related is NOT a change. When you're unsure whether a stat moved, leave it out.
      - Report each stat that genuinely moved and no others. If two stats plainly shifted, give both; if one did, give one; if none did, give nothing. Don't pad the list with a related-but-unmoved stat, and don't drop one the turn clearly hit.
      - The amount is a rough judgment, not a calculation - no one knows the exact number. Pick a small whole number scaled loosely to the stat's range and how big the moment was, and commit to it. Never report the value because you're unsure of the change.
      - The stats under Player Character belong to that character. They move only for what that character does, goes through, or feels this turn.

      ## Format
      - One line per changed stat: its exact name from the list above (written plainly - never a + or - on the name), a colon, then one signed whole number. Nothing else on the line.
      - The change is ONE whole number - never a fraction, a slash, or a value-over-maximum. Put the sign on the number (a leading minus lowers the stat).
      - A slight but clear shift still gets a line, with a noticeable number, a small share of the stat's range.
      - To change a stat's maximum instead of its current value, add MAX after the number.
      - If nothing changed this turn, output nothing at all. Never write a preamble, heading, or explanation."
    `);
    expect(statRequestSchema(request)).toMatchInlineSnapshot(`
      {
        "name": "stat_changes",
        "schema": {
          "additionalProperties": false,
          "properties": {
            "Global Stats": {
              "additionalProperties": false,
              "properties": {
                "Health": {
                  "type": "integer",
                },
                "Health max": {
                  "type": "integer",
                },
              },
              "required": [
                "Health",
                "Health max",
              ],
              "type": "object",
            },
            "Player Character": {
              "additionalProperties": false,
              "properties": {
                "Calm": {
                  "type": "integer",
                },
                "Calm max": {
                  "type": "integer",
                },
                "Health (2)": {
                  "type": "integer",
                },
                "Health (2) max": {
                  "type": "integer",
                },
              },
              "required": [
                "Health (2)",
                "Health (2) max",
                "Calm",
                "Calm max",
              ],
              "type": "object",
            },
          },
          "required": [
            "Player Character",
            "Global Stats",
          ],
          "type": "object",
        },
      }
    `);
  });
});
