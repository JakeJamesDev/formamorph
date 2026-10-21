// Entity stats probe — when entities carry stats, which request shape tracks them best? Sedge Landing with
// stats on its entities (entity-stats-cases.json); owners share stat names so a change can land on the wrong one.
//
// Arms, paired by run index and interleaved run by run:
//   control  today's stat pass: the player's stats only, graded on player cells only
//   A        one call for every owner, plain lines `Owner / Stat: delta`
//   B        one call per owner, fired together; the player's call is byte-identical to control
//   A2       A, with every line required to open with its owner's name
//   A3       one call for every owner, lines grouped under each moved owner's name as the input groups them
//   C        one call for every owner, a JSON schema keyed by owner with each owner's stat names as an enum
//   C2       one call for every owner, a fixed JSON object on one line: every owner's every stat, 0 for no change
//   C3       C2, with a shift in how a character regards the player counted as a change
//   D        C3, with each stat's change written after a short `evidence` field
//   E        a gate call names the owners whose stats moved, then B's call runs for each named owner
//   C3P      C3 with the player alone, which S's request matches but for the max keys
//   S        the shipped request: the app's own stat pass builder, prompts and schema, every present owner, the
//            world's stats loose as the world authors them
//   OB       S, with the player's stats on a Custom Persona entity and only the world's own stats loose
//   SB       the request as built at BASE_REF (stat-pass-owner-blocks ticket 02's Base): every player stat under
//            `### Player Character`, each owner's section appended to the Stats chip
//   S0       S, with the stat prompts as committed at --s0-ref (default HEAD, the before arm for an uncommitted edit)
//   OB0      OB, with the stat prompts as committed at --s0-ref
//            --s0-bound N gives S0 and OB0 every schema integer a ±N range, as the schema had before 1b757d529
// The arms below are the request at BASE_REF with one change each, built as SB is:
//   SU       SB, with C3's user line
//   SN       SB, with no max keys in the schema, the format or the user line
//   SG       SB, with every owner's stats in author-style groups (Body, Mind, Bonds, Trade)
//   SGB      SG with bare group headings, no descriptions
//   SGO      SG with every group's heading hidden from the AI (`aiVisible: false`); matches SB byte for byte
//   SH       SG with each group as a #### sub-heading and its stats flat beneath
//   SP       SG with each group as a plain `Name: description` line and its stats flat beneath
//   WA..WR   ticket 05's request (ded57a32), with one wording change each (WORDINGS below)
//   K0..KN2R the stat prompts at SCALE_REF with one scale wording each (SCALES below); K0 is the fixed -20 to 20 line
//   FA..FDG  ticket 23's framings on the request at 9f4400ad (FRAMINGS below); a G suffix sends SG's groups
// A to E derive from the text pass's prompt by checked text swaps; S is built by the app, so it is what ships.
//
// --world rampage|slime swaps Sedge Landing for that bundled world and world-stats-cases.json. Its loose stats
// (the case file's `loose`) grade as the `world` owner; the `WORLD` table reports their recall per arm.
//
// Per reply: exact (every gold move right, nothing spurious), hits / wrong sign / misses, spurious moves,
// misattributed (a spurious move whose stat the gold moves on another owner), invalid rows, duplicates,
// cap hits, wall-clock ms, and prompt + completion tokens. `player-only` regrades every arm on player cells.
// `SIZE` reads each reported value change's size: mean, p90, max, past 20, and past a quarter of the stat's range.
//   L        a lean request: the owners' stats as name and reading, one format line, the narration; no world or rules
//   LT       L, with the shipped regard sentence after the narration
//   LV       L, asking for every stat's new reading; the probe turns each into its change
//   LR       L, with a line asking for every change the narration shows, even a small one
//   LD       L, asking for the changed stats only
//   XR..XF4G leave-one-out ablations of the request at 84a15574 (ABLATIONS below); a G suffix sends SG's groups
// `invented` splits spurious moves into player and entity cells, with push-bram's player cells (Q64) apart.
// `max` counts invented max changes (no case moves a maximum); only control and S are read for them.
//
// Usage: npx vite-node testing/baseline/harness/entity-stats-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 6] [--pool 3] [--arms control,A,B,C] [--only storm-crowd]
//          [--ws free|pattern|xgrammar|outlines|lmfe] [--s0-ref REF] [--sheet sedge|familiar] [--cases FILE]
//          [--world sedge|rampage|slime] [--show] [--dump]
// --sheet familiar swaps every owner's stats for Fear, Morale, Energy and Trust (entity-stats-familiar-cases.json).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  defaultStatUpdatesPrompt as shippedStatPrompt, defaultStatUpdatesUserPrompt as shippedStatUserPrompt,
} from '@/components/game/GamePrompts';
import {
  DEFAULT_GEN_MIN_P, DEFAULT_GEN_REPETITION_PENALTY, DEFAULT_GEN_TEMPERATURE, DEFAULT_GEN_TOP_K, DEFAULT_GEN_TOP_P, DEFAULT_MAX_TOKENS,
} from '@/contexts/settingsDefaults';
import { buildAiRequestSpec, type AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import type { ResponseSchemaNode } from '@/lib/aiRequest/responseSchema';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import {
  DEFAULT_REASONING_SETTING, UNKNOWN_REASONING_CAPABILITY, isReasoningEngaged, resolveReasoningCapability, resolveReasoningSetting,
  type PromptReasoning,
} from '@/lib/reasoningEffort';
import { collectPins } from '@/lib/placeholderPins';
import { resolveEntityText, resolvePlaceholders, type ResolveOptions } from '@/lib/placeholders';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import { layerValues, mapValues, type ValueLookup } from '@/lib/promptValues';
import { createStatRequest, keyedScene, type StatRequestSnapshot } from '@/lib/statRequest';
import { statUpdatesCap, statUpdatesRequest } from '@/lib/turnPipeline/turnPasses';
import { migrateWorld } from '@/lib/version';
import type { StatPlacement } from '@/lib/statContext';
import type { PlayerStat, StatGroup } from '@/types';
import {
  parseJsonReply, parseOwnerBlocks, parseOwnerLines, parsePlainLines, scoreChanges,
  type Change, type GoldCells, type Owner, type Parsed, type Score,
} from './entity-stats-score';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const runs = Number(argVal('--runs', '6'));
const pool = Number(argVal('--pool', '3'));
const only = argVal('--only', '');
const ALL_ARMS = ['control', 'A', 'A2', 'A3', 'B', 'C', 'C2', 'C3', 'D', 'E', 'S', 'OB', 'SB', 'SU', 'SN', 'SG', 'SGB', 'SGO', 'SH', 'SP', 'C3P', 'S0', 'OB0', 'WA', 'WB', 'WC', 'WD', 'WE', 'WF', 'WH', 'WJ', 'WK', 'WL', 'WP', 'WQ', 'WR', 'FA', 'FAG', 'FB', 'FBG', 'FR', 'FRG', 'FC', 'FCG', 'FD', 'FDG',
  'XR', 'XRG', 'XL', 'XLG', 'XC', 'XCG', 'XW', 'XWG', 'XT', 'XTG', 'XA', 'XAG', 'XF', 'XFG', 'XU', 'XUG', 'XUA', 'XUAG', 'XA1', 'XA1G', 'XA2', 'XA2G', 'XA3', 'XA3G', 'XA4', 'XA4G', 'XA5', 'XA5G', 'XA6', 'XA6G', 'XF1', 'XF1G', 'XF2', 'XF2G', 'XF3', 'XF3G', 'XF4', 'XF4G', 'XN', 'XNG', 'SV', 'SVG', 'L', 'LR', 'LT', 'LV', 'LD', 'K0', 'KB', 'KR', 'KM', 'KS', 'KRS', 'KD', 'KW', 'KA', 'K100', 'K5', 'KN', 'KN2', 'KN2R'] as const;
type Arm = typeof ALL_ARMS[number];
const arms = argVal('--arms', ALL_ARMS.join(',')).split(',') as Arm[];
const SEED = 424242;
// Free whitespace lets the decoder pad a finished object until the cap; these are the vLLM-family switches.
const WHITESPACE = {
  free: {},
  pattern: { guided_whitespace_pattern: '' },
  xgrammar: { guided_decoding_backend: 'xgrammar:disable-any-whitespace' },
  outlines: { guided_decoding_backend: 'outlines', guided_whitespace_pattern: '[ ]?' },
  lmfe: { guided_decoding_backend: 'lm-format-enforcer' },
} as const;
const whitespace = argVal('--ws', 'free') as keyof typeof WHITESPACE;
if (!(whitespace in WHITESPACE)) throw new Error(`--ws takes ${Object.keys(WHITESPACE).join(', ')}.`);
const PLAYER = 'Player Character';

const BASELINE = path.resolve('testing/baseline');
const worldName = argVal('--world', 'sedge');
if (worldName !== 'sedge' && worldName !== 'rampage' && worldName !== 'slime') throw new Error('--world takes sedge, rampage or slime.');
type CaseFile = {
  entityStats: Record<string, PlayerStat[]>;
  cases: Array<{ id: string; world?: string; present: string[]; narration: string; expect: GoldCells; allow: GoldCells }>;
};
/** A bundled world's probe setup: its file, its played persona's name and text, and the stats that stay loose. */
type WorldSetup = { file: string; persona: string; description: string; loose: string[] };
const worldCases = worldName === 'sedge' ? undefined
  : JSON.parse(readFileSync(path.join(BASELINE, 'world-stats-cases.json'), 'utf8')) as CaseFile & { worlds: Record<string, WorldSetup> };
const worldSetup: WorldSetup = worldCases?.worlds[worldName]
  ?? { file: 'testing/baseline/sedge-landing.json', persona: 'The Stranger', description: 'A newcomer to the landing.', loose: [] };
const world = migrateWorld(JSON.parse(readFileSync(path.resolve(worldSetup.file), 'utf8')));
const sedgeFixture: CaseFile = worldCases
  ? { entityStats: {}, cases: worldCases.cases.filter((c) => c.world === worldName) }
  : JSON.parse(readFileSync(path.join(BASELINE, 'entity-stats-cases.json'), 'utf8')) as CaseFile;
// --cases swaps in another case file over the same entity stats (the held-out set).
const casesFile = argVal('--cases', '');
if (casesFile) sedgeFixture.cases = (JSON.parse(readFileSync(path.join(BASELINE, casesFile), 'utf8')) as typeof sedgeFixture).cases;
const sheet = argVal('--sheet', 'sedge');
if (sheet !== 'sedge' && sheet !== 'familiar') throw new Error('--sheet takes sedge or familiar.');
const familiar = sheet === 'familiar'
  ? JSON.parse(readFileSync(path.join(BASELINE, 'entity-stats-familiar-cases.json'), 'utf8')) as {
    playerStats: PlayerStat[]; entityStats: Record<string, PlayerStat[]>; cases: Array<{ id: string; expect: GoldCells; allow: GoldCells }>;
  }
  : undefined;
/** The Sedge cases, with the familiar sheet's stats and gold in place when --sheet familiar. */
const fixture = familiar ? {
  entityStats: familiar.entityStats,
  cases: sedgeFixture.cases.map((c) => {
    const gold = familiar.cases.find((g) => g.id === c.id);
    if (!gold) throw new Error(`No familiar gold for ${c.id}.`);
    return { ...c, expect: gold.expect, allow: gold.allow };
  }),
} : sedgeFixture;

const location = worldName === 'sedge'
  ? world.locations.find((candidate) => candidate.id === 'loc-sedge') : world.locations.find((candidate) => candidate.isStarting);
if (!location) throw new Error(`${worldName} has no probe location.`);
// Each placeholder takes its first value, so every run reads the same world.
const activeTraits = world.traits.filter((trait) => trait.isDefault);
const resolveOptions: ResolveOptions = {
  placeholders: world.placeholders ?? [], rolls: {}, pick: (values) => values[0]?.text ?? '',
  pins: collectPins({ traits: activeTraits, disabledTraitIds: [], placeholders: world.placeholders ?? [] }),
};
const sceneOptions = {
  location,
  activeTraitIds: activeTraits.map((trait) => trait.id),
  resolve: (text: string) => resolvePlaceholders(text, resolveOptions),
  resolveEntity: (entity: { name: string }, text: string) => resolveEntityText(entity, text, resolveOptions),
};
const BASE_CTX = chipValues(authoredChipScene(world, sceneOptions));
const playerOwner: Owner = { key: 'player', name: PLAYER, stats: familiar?.playerStats ?? world.stats as PlayerStat[] };
/** An entity's request stats: the case sheet's, descriptors dropped, or the world's own. */
const entityStatsOf = (id: string): PlayerStat[] =>
  (fixture.entityStats[id] ?? world.entities.find((e) => e.id === id)?.stats ?? []).map((s) => ({ ...s, descriptors: [] }) as PlayerStat);
const entityOwner = (id: string): Owner => {
  const entity = world.entities.find((e) => e.id === id);
  if (!entity) throw new Error(`No entity ${id} in ${worldName}.`);
  return { key: id, name: entity.name, stats: entityStatsOf(id) };
};
/** The grading owner of a player-side cell: a loose stat is the world's. */
const gradeOwner = (owner: string, stat: string) =>
  (owner === 'player' && worldSetup.loose.includes(stat) ? 'world' : owner);

const STATS_TOKEN = '<STATS DESCRIPTION|numbers.meaning.markdown>';
/** A text swap that throws when the real prompt no longer carries the text it replaces. */
function swap(text: string, from: string | RegExp, to: string): string {
  const out = text.replace(from, to);
  if (out === text) throw new Error(`Stat prompt drifted: ${String(from).slice(0, 60)} not found.`);
  return out;
}
const statsBlock = (owner: Owner) => createStatRequest(owner.stats).context(STATS_TOKEN);
const ownerSections = (owners: Owner[]) => owners.map((o) => `### ${o.name}\n${statsBlock(o)}`).join('\n\n');

function sharedSystem(owners: Owner[]): string {
  let t = swap(defaultStatUpdatesPrompt, "record how it moved the player's stats", 'record how it moved the stats of each character listed below');
  t = swap(t, '## Player Stats\n', "## Stats\nEach character's stats sit under their name. ");
  return swap(t, STATS_TOKEN, ownerSections(owners));
}

interface Call { owner?: Owner; system: string; user: string; maxTokens: number; schema?: object; snapshot?: StatRequestSnapshot }
const userFor = (narration: string, template = defaultStatUpdatesUserPrompt) => template.replace('<NARRATION>', narration);
const render = (system: string, owner?: Owner) =>
  renderPromptTemplate(system, owner ? layerValues(BASE_CTX, createStatRequest(owner.stats).context) : BASE_CTX);
const total = (owners: Owner[]) => owners.reduce((n, o) => n + o.stats.length, 0);

const SOCIAL_RULE = ['a real exertion, injury, loss, or gain.', 'a real exertion, injury, loss, or gain, or a clear shift in how a character regards the player.'] as const;
const ONE_JSON = ['Your entire output is stat-change lines - nothing else.', 'Your entire output is one JSON object - nothing else.'] as const;

/** Today's stat pass, scoped to one owner. The player's call is the control request. */
function perOwnerCall(owner: Owner, narration: string): Call {
  const system = owner.key === 'player' ? defaultStatUpdatesPrompt
    : swap(swap(defaultStatUpdatesPrompt, "the player's stats", `${owner.name}'s stats`), '## Player Stats', `## ${owner.name}'s Stats`);
  return { owner, system: render(system, owner), user: userFor(narration), maxTokens: statUpdatesCap(owner.stats.length) };
}

/** Arm E's first step: which owners had a stat moved. */
function gateCall(owners: Owner[], narration: string): Call {
  let system = swap(sharedSystem(owners), 'record how it moved the stats of each character listed below', 'decide whose stats it moved, among the characters listed below');
  system = swap(swap(system, ...SOCIAL_RULE), ...ONE_JSON);
  system = swap(system, /## Format[\s\S]*$/,
    '## Format\n- `moved`: the name of every character with at least one stat this turn moved, exactly as their heading shows. An empty list when no stat moved.\n- Write the whole object on one line.');
  const user = swap(defaultStatUpdatesUserPrompt, /List only the stats[\s\S]*$/, 'Name every character this narration moved a stat of.');
  const schema = {
    type: 'object', additionalProperties: false, required: ['moved'],
    properties: { moved: { type: 'array', maxItems: owners.length, items: { type: 'string', enum: owners.map((o) => o.name) } } },
  };
  return { system: render(system), user: userFor(narration, user), maxTokens: 12 * owners.length + 16, schema };
}

/** The owners a gate reply names; an unreadable reply names none. */
function gatedOwners(raw: string, owners: Owner[]): Owner[] {
  try {
    const { moved } = JSON.parse(raw) as { moved?: unknown };
    return Array.isArray(moved) ? owners.filter((o) => moved.includes(o.name)) : [];
  } catch { return []; }
}

// SG's sections, with short neutral descriptions, so headings are the only difference from S.
const BONDS: StatGroup = { id: 'g-bonds', name: 'Bonds', aiDescription: 'Relationships.', parentId: null, order: 2 };
const STAT_GROUPS: Record<string, StatGroup> = {
  Vigor: { id: 'g-body', name: 'Body', aiDescription: 'Physical condition.', parentId: null, order: 0 },
  Resolve: { id: 'g-mind', name: 'Mind', aiDescription: 'Will and nerve.', parentId: null, order: 1 },
  Energy: { id: 'g-body', name: 'Body', aiDescription: 'Physical condition.', parentId: null, order: 0 },
  Fear: { id: 'g-mind', name: 'Mind', aiDescription: 'Will and nerve.', parentId: null, order: 1 },
  Morale: { id: 'g-mind', name: 'Mind', aiDescription: 'Will and nerve.', parentId: null, order: 1 },
  Trust: BONDS,
  Suspicion: BONDS,
  Stock: { id: 'g-trade', name: 'Trade', aiDescription: 'Goods for sale.', parentId: null, order: 3 },
};
type GroupStyle = 'described' | 'bare' | 'hidden';
const GROUP_STYLE_TRANSFORMS: Record<GroupStyle, (g: StatGroup) => StatGroup> = {
  described: (g) => g,
  bare: (g) => ({ ...g, aiDescription: '' }),
  hidden: (g) => ({ ...g, aiVisible: false }),
};
/** Every stat of `stats` in its SG group, styled: `bare` drops the descriptions (SGB), `hidden` the headings (SGO). */
function grouped(stats: readonly PlayerStat[], style: GroupStyle): StatPlacement {
  const groups = [...new Map(stats.map((s) => STAT_GROUPS[s.name]).map((g) => [g.id, GROUP_STYLE_TRANSFORMS[style](g)])).values()];
  return { groups, authored: stats.map((s) => ({ ...s, groupId: STAT_GROUPS[s.name].id })) };
}

/** The stat pass's request for `snapshot` over `ctx`, as the app builds it. */
function requestCall(snapshot: StatRequestSnapshot, ctx: ValueLookup, narration: string, prompts: { system: string; user: string }): Call {
  const request = statUpdatesRequest(
    { ...prompts, text: { system: null, user: null } }, { ctx, action: '', narration }, { statCount: playerOwner.stats.length, statRequest: snapshot, quiet: false },
  );
  if (!request.responseSchema) throw new Error('The stat request carries no schema.');
  return {
    owner: playerOwner, system: request.systemPrompt, user: request.messages[0].content, snapshot,
    maxTokens: request.maxTokens ?? 0, schema: request.responseSchema.schema,
  };
}

const PERSONA_ID = 'probe-persona';
/** The played entity that owns every player stat in the BASE_REF layout. */
const PLAYER_ID = 'probe-player';
const SHIPPED_PROMPTS = { system: shippedStatPrompt, user: shippedStatUserPrompt };

/** The request the app sends, built by the app's own stat pass over the world's scene, from `prompts` when
 *  given. With `persona`, a Custom Persona entity owns every player stat the world does not leave loose. */
function shippedCall(owners: Owner[], narration: string, prompts = SHIPPED_PROMPTS, { persona = false } = {}): Call {
  const others = owners.filter((o) => o !== playerOwner);
  const loose = persona ? playerOwner.stats.filter((s) => worldSetup.loose.includes(s.name)) : playerOwner.stats;
  const owned = persona ? playerOwner.stats.filter((s) => !worldSetup.loose.includes(s.name)) : [];
  const played = persona
    ? { id: PERSONA_ID, name: worldSetup.persona, aiDescription: worldSetup.description, customPersona: true, stats: owned }
    : undefined;
  const cast = world.entities.map((e) => ({ ...e, stats: entityStatsOf(e.id) }));
  const scene = authoredChipScene({ ...world, stats: loose, entities: played ? [...cast, played] : cast }, sceneOptions);
  const snapshot = createStatRequest(loose, {
    ...(played && { persona: { id: played.id, name: played.name, stats: owned } }),
    entities: others.map((o) => ({ id: o.key, name: o.name, stats: o.stats })),
    inSceneIds: others.map((o) => o.key),
  });
  return requestCall(snapshot, chipValues(keyedScene(scene, snapshot)), narration, prompts);
}

/** The request as built at BASE_REF, from `prompts`: every player stat under the prompt's Player Character
 *  heading, then each owner's own heading and section appended to every Stats chip value, in groups when
 *  `groups` names a style. The owner and stat keys are the ones that build gave. */
const BASE_REF = '633c60570';
function baseLayoutCall(owners: Owner[], narration: string, groups: GroupStyle | undefined, prompts: { system: string; user: string }): Call {
  const placement = (stats: readonly PlayerStat[]) => (groups ? { placement: grouped(stats, groups) } : {});
  const others = owners.filter((o) => o !== playerOwner && o.stats.length);
  const snapshot = createStatRequest([], {
    persona: { id: PLAYER_ID, name: PLAYER, stats: playerOwner.stats, ...placement(playerOwner.stats) },
    entities: others.map((o) => ({ id: o.key, name: o.name, stats: o.stats, ...placement(o.stats) })),
  });
  const sections = others.map((o, i) => ({ key: snapshot.entityKeys[i], values: createStatRequest(o.stats, placement(o.stats)).context }));
  const context = mapValues(snapshot.context, (value, token) =>
    [value, ...sections.map((section) => `### ${section.key}\n${section.values(token)}`)].join('\n\n'));
  return requestCall({ ...snapshot, context }, BASE_CTX, narration, prompts);
}

/** The stat request's user line, after the narration. */
const USER_LINE = /Give each character's stats[^\n]*$/;
const C3_USER = "Give each character's stats their change from this narration: 0 for every stat it did not move.";
const C3_FORMAT = "- One key per character, named exactly as its heading shows. Its value gives each of that character's stats this turn's change as one signed whole number between -20 and 20.";

/** S with C3's user line (SU), or with no max keys at all, in the schema, the format or the user line (SN). */
function shippedVariant(arm: 'SU' | 'SN', owners: Owner[], narration: string): Call {
  const call = baseLayoutCall(owners, narration, undefined, basePrompts!);
  const user = swap(call.user, USER_LINE, C3_USER);
  if (arm === 'SU') return { ...call, user };
  const strip = (node: Record<string, unknown>): Record<string, unknown> => {
    if (node.type !== 'object') return node;
    const properties = Object.fromEntries(Object.entries(node.properties as Record<string, Record<string, unknown>>)
      .filter(([key]) => !key.endsWith(' max')).map(([key, child]) => [key, strip(child)]));
    return { ...node, properties, required: Object.keys(properties) };
  };
  const system = swap(call.system, /- One key per character, named exactly as its heading shows\. Under it[^\n]*/, C3_FORMAT);
  return { ...call, user, system: swap(system, 'A value or maximum that did not move gets 0.', 'A stat that did not move gets 0.'), schema: strip(call.schema as Record<string, unknown>) };
}

/** The stat prompt pair as committed at a ref, imported from a copy of GamePrompts.ts at that ref. `text` is
 *  the text pass's pair. */
async function promptsAt(ref: string): Promise<{ system: string; user: string; text: { system: string; user: string } }> {
  const source = execFileSync('git', ['show', `${ref}:src/components/game/GamePrompts.ts`], { encoding: 'utf8' });
  const dir = mkdtempSync(path.join(tmpdir(), 'fm-prompts-'));
  const file = path.join(dir, 'GamePrompts.ts');
  writeFileSync(file, source);
  try {
    const mod = await import(pathToFileURL(file).href) as {
      defaultStatUpdatesPrompt: string; defaultStatUpdatesUserPrompt: string;
      textStatUpdatesPrompt: string; textStatUpdatesUserPrompt: string;
    };
    return {
      system: mod.defaultStatUpdatesPrompt, user: mod.defaultStatUpdatesUserPrompt,
      text: { system: mod.textStatUpdatesPrompt, user: mod.textStatUpdatesUserPrompt },
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
// Arms A to E derive from the text pass's prompts as they stood before the owner blocks, under the names they were written against.
const { text: { system: defaultStatUpdatesPrompt, user: defaultStatUpdatesUserPrompt } } = await promptsAt('62e87af3c');
const s0Prompts = arms.includes('S0') || arms.includes('OB0') ? await promptsAt(argVal('--s0-ref', 'HEAD')) : undefined;
const s0Bound = args.includes('--s0-bound') ? Number(argVal('--s0-bound', '20')) : undefined;
const bounded = (node: ResponseSchemaNode, n: number): ResponseSchemaNode => (node.type === 'integer'
  ? { type: 'integer', minimum: -n, maximum: n }
  : { ...node, properties: Object.fromEntries(Object.entries(node.properties).map(([k, v]) => [k, bounded(v, n)])) });
const s0Bounded = (call: Call): Call =>
  (s0Bound === undefined || !call.schema ? call : { ...call, schema: bounded(call.schema as ResponseSchemaNode, s0Bound) });
const BASE_LAYOUT_ARMS: readonly Arm[] =['SB', 'SU', 'SN', 'SG', 'SGB', 'SGO', 'SH', 'SP'];
const basePrompts = arms.some((arm) => BASE_LAYOUT_ARMS.includes(arm)) ? await promptsAt(BASE_REF) : undefined;

/** One wording change on the stat prompts ticket 17 started from, each a checked text swap. */
type Wording = { system?: Array<[string | RegExp, string]>; user?: Array<[string | RegExp, string]> };
const MAX_KEY_FORMAT = /- One key per character, named exactly as its heading shows\. Under it[^\n]*/;
const SPLIT_MAX = '- One key per character, named exactly as its heading shows. Under it, each stat\'s name holds this turn\'s change to that stat as one signed whole number between -20 and 20.\n- Beside each stat, its name followed by " max" holds this turn\'s change to the stat\'s maximum, in the same form. A maximum moves only when the turn changes how high that stat can go.';
const REGARD_ROUTE = "- A shift in how a character regards the player changes that character's own stat for it.";
const WA_USER = "Give each character's stats their change from this narration, a shift in how a character regards the player included: 0 for every value and maximum it did not move.";
const STANDING = ["When you're unsure whether a stat moved, leave it out.", "When you're unsure whether a stat moved, leave it out.\n- A stat's current reading and the traits show where it stands before this turn. Only an event in this narration moves it."] as const;
const WH_USER = "Give each character's stats their change from this narration: 0 for every value and maximum it did not move. A clear shift in how a character regards the player moves that character's own stat.";
const OWNED = "A stat moves only for what that character does, goes through, or feels this turn.";
const OWNED_INTRO = ["Each character's stats sit under their name.", `Each character's stats sit under their name. ${OWNED}`] as const;
const OWNED_LAST = ['\n\n## Format', `\n- Each stat belongs to the character it sits under. ${OWNED}\n\n## Format`] as const;
const SPLIT_SWAPS: Array<[string | RegExp, string]> = [[MAX_KEY_FORMAT, SPLIT_MAX], ['A value or maximum that did not move gets 0.', 'A stat or maximum that did not move gets 0.']];
const REGARD_LAST = ['\n\n## Format', `\n${REGARD_ROUTE}\n\n## Format`] as const;

/** Scale wordings on the request with the stat prompts at SCALE_REF and today's unbounded schema. Every arm
 *  but K0 starts from the bare line KB; KN2R is what shipped. */
const SCALE_REF = '7e3a25d59';
const RANGE_LINE = 'Each is one signed whole number between -20 and 20.';
const SCALE_LINE = 'Each is one signed whole number.';
const SMALL_RULE = 'Pick a small whole number scaled loosely to';
const SCALES: Record<string, Array<[string, string]>> = {
  K0: [],
  KB: [],
  KR: [[SCALE_LINE, "Each is one signed whole number, sized against the stat's range: a minor moment moves it a small share of the range, a major one a large share."]],
  KM: [[SCALE_LINE, "Each is one signed whole number in the same units as the stat's reading."]],
  KD: [[SCALE_LINE, 'Each is one signed whole number: negative lowers the stat, positive raises it.']],
  KW: [[SCALE_LINE, 'Each is one signed whole number, from a small step for a minor moment to a large jump for a major one.']],
  KA: [[SCALE_LINE, "Each is one signed whole number between minus and plus the stat's range."]],
  // K100 and K5 test whether the range sets the step a slight shift rounds to.
  K100: [[SCALE_LINE, 'Each is one signed whole number between -100 and 100.']],
  K5: [[SCALE_LINE, 'Each is one signed whole number between -5 and 5.']],
  KN: [['Pick a small whole number scaled loosely to the stat\'s range and how big the moment was, and commit to it.',
    "Pick a whole number sized to the stat's range and how big the moment was, and commit to it. A slight but clear shift still moves the stat by a noticeable amount."]],
  KN2: [['- A value or maximum that did not move gets 0.', '- Only a value or maximum the turn did not touch gets 0. A slight but clear shift gets a noticeable number.']],
  KN2R: [['- A value or maximum that did not move gets 0.', "- Only a value or maximum the turn did not touch gets 0. A slight but clear shift gets a noticeable number, a small share of the stat's range."]],
  KS: [[SMALL_RULE, 'Pick a whole number sized to']],
  KRS: [[SMALL_RULE, 'Pick a whole number sized to'], [SCALE_LINE, "Each is one signed whole number, sized against the stat's range: a minor moment moves it a small share of the range, a major one a large share."]],
};
const isScale = (arm: Arm) => arm in SCALES;
const scalePrompts = arms.some(isScale) ? await promptsAt(SCALE_REF) : undefined;
const scaled = (arm: Arm, owners: Owner[], narration: string): Call => {
  const call = shippedCall(owners, narration, scalePrompts);
  const swaps: Array<[string, string]> = arm === 'K0' ? [] : [[RANGE_LINE, SCALE_LINE], ...SCALES[arm]];
  return { ...call, system: swaps.reduce((text, [from, to]) => swap(text, from, to), call.system) };
};
const WORDINGS = {
  // The user line names the regard shift beside the physical changes.
  WA: { user: [[USER_LINE, WA_USER]] },
  // The format gives the value key its own line and the max key a second one, with C3's user line.
  WB: { system: SPLIT_SWAPS, user: [[USER_LINE, C3_USER]] },
  // The regard rule names the owner the change goes to, last in What to change.
  WC: { system: [REGARD_LAST] },
  WD: { system: [...SPLIT_SWAPS, REGARD_LAST], user: [[USER_LINE, C3_USER]] },
  // A rule that a stat's reading and the traits are its starting point, not a change.
  WE: { system: [STANDING] },
  WF: { system: [STANDING], user: [[USER_LINE, WA_USER]] },
  // WE, with the regard shift last in the user line and scoped to the regarding character's stat.
  WH: { system: [STANDING], user: [[USER_LINE, WH_USER]] },
  // A rule that a stat moves only for its own character, in the Stats intro; then with WH's user line.
  WJ: { system: [OWNED_INTRO] },
  WK: { system: [OWNED_INTRO], user: [[USER_LINE, WH_USER]] },
  // The same rule, last in What to change, with WH's user line.
  WL: { system: [OWNED_LAST], user: [[USER_LINE, WH_USER]] },
  // The owner rule last in the user line, with no regard sentence.
  WP: { user: [[USER_LINE, `Give each character's stats their change from this narration: 0 for every value and maximum it did not move. ${OWNED}`]] },
  // WL, with the zeros last in the user line.
  WQ: { system: [OWNED_LAST], user: [[USER_LINE, "Give each character's stats their change from this narration. A clear shift in how a character regards the player moves that character's own stat. Every value and maximum the narration did not move gets 0."]] },
  // WL, with the regard sentence naming only the other characters.
  WR: { system: [OWNED_LAST], user: [[USER_LINE, "Give each character's stats their change from this narration: 0 for every value and maximum it did not move. When another character's regard for the player clearly shifts, that character's own stat moves."]] },
} satisfies Record<string, Wording>;
const isWording = (arm: Arm): arm is keyof typeof WORDINGS => arm in WORDINGS;
const wordingBase = arms.some(isWording) ? await promptsAt('ded57a32') : undefined;
function worded(arm: keyof typeof WORDINGS, owners: Owner[], narration: string): Call {
  const call = baseLayoutCall(owners, narration, undefined, wordingBase!);
  const { system = [], user = [] }: Wording = WORDINGS[arm];
  return {
    ...call,
    system: system.reduce((text, [from, to]) => swap(text, from, to), call.system),
    user: user.reduce((text, [from, to]) => swap(text, from, to), call.user),
  };
}

/** Ticket 23's framing wordings, each a set of checked swaps on the shipped request at FRAMING_REF, flat or grouped. */
const FRAMING_REF = '9f4400ad';
const STATS_INTRO = "Each character's stats sit under their name. Current readings";
const ROLE_LINE = 'You read what happened this turn and record how it moved';
const IS_STAT = 'A stat is a tracked quantity about one character. It holds its reading until an event in the story moves it.';
const SHAPES_STORY = 'Stats shape the story: the narrator reads them to decide what each character can do and how they act, so every change you record carries into later turns.';
const OWNED_LAYOUT = "Each character's stats sit under their name, a ### heading, and belong to that character.";
const GROUP_BULLET = 'a group bullet names what the stats nested under it share.';
const GROUPED = `${GROUP_BULLET} A group holds no reading of its own; you record changes on its stats.`;
const IF_GROUPED = `When a character's stats sit in groups, ${GROUPED}`;
const ALWAYS_GROUPED = `Some stats sit in groups: ${GROUPED}`;
const SHAPES_STORY_SHORT = 'Stats shape the story: the narrator reads them to decide what each character can do and how they act.';
const IF_GROUPED_OWN = `When a character's stats sit in groups, ${GROUP_BULLET} Each stat under a group moves on its own.`;
const ROLE_FRAMING = 'Each stat is a number that tracks one thing about one character, and it changes only when the story changes it. The narrator reads the stats each turn to decide what the characters can do and how they act.';
const FRAMINGS = {
  // All three parts open the Stats section; the group sentence is conditional.
  FA: [[STATS_INTRO, `${IS_STAT} ${SHAPES_STORY}\n${OWNED_LAYOUT} ${IF_GROUPED}\nCurrent readings`]],
  // What a stat is and what stats do open the prompt, in the role; the layout opens the Stats section.
  FB: [[ROLE_LINE, `${ROLE_FRAMING} ${ROLE_LINE}`], [STATS_INTRO, `${OWNED_LAYOUT} ${IF_GROUPED}\nCurrent readings`]],
  // FA, with the group sentence sent only when the request has groups.
  FR: [[STATS_INTRO, `${IS_STAT} ${SHAPES_STORY}\n${OWNED_LAYOUT}\nCurrent readings`]],
  FRG: [[STATS_INTRO, `${IS_STAT} ${SHAPES_STORY}\n${OWNED_LAYOUT} ${ALWAYS_GROUPED}\nCurrent readings`]],
  // FA, with the story line ending at what the narrator does: no line that a change carries into later turns.
  FC: [[STATS_INTRO, `${IS_STAT} ${SHAPES_STORY_SHORT}\n${OWNED_LAYOUT} ${IF_GROUPED}\nCurrent readings`]],
  // FC, with a group sentence that says each stat under a group moves on its own.
  FD: [[STATS_INTRO, `${IS_STAT} ${SHAPES_STORY_SHORT}\n${OWNED_LAYOUT} ${IF_GROUPED_OWN}\nCurrent readings`]],
} satisfies Record<string, Array<[string, string]>>;
const FRAMING_ARMS = { FA: ['FA', false], FAG: ['FA', true], FB: ['FB', false], FBG: ['FB', true], FR: ['FR', false], FRG: ['FRG', true],
  FC: ['FC', false], FCG: ['FC', true], FD: ['FD', false], FDG: ['FD', true] } as const;
const isFraming = (arm: Arm): arm is keyof typeof FRAMING_ARMS => arm in FRAMING_ARMS;
const framingBase = arms.some(isFraming) ? await promptsAt(FRAMING_REF) : undefined;
function framed(arm: keyof typeof FRAMING_ARMS, owners: Owner[], narration: string): Call {
  const [wording, groups] = FRAMING_ARMS[arm];
  const call = baseLayoutCall(owners, narration, groups ? 'described' : undefined, framingBase!);
  return { ...call, system: FRAMINGS[wording].reduce((text, [from, to]) => swap(text, from, to), call.system) };
}

/** Leave-one-out ablations of the shipped request at ABLATION_REF: each arm deletes one section or line. */
const ABLATION_REF = '84a15574';
const cut = (from: RegExp): [RegExp, string] => [from, ''];
const ABLATIONS = {
  // Whole sections.
  XR: { system: [cut(/ Each stat is a number[^.]*\. The narrator reads the stats[^.]*\./)] },
  XL: { system: [cut(/Each character's stats sit under their name, a ### heading[^\n]*\n/)] },
  XC: { system: [cut(/Current readings \(shown as[^\n]*\n/)] },
  XW: { system: [cut(/## Game World\n[\s\S]*?(?=## Stats\n)/)] },
  XT: { system: [cut(/## Traits\n[\s\S]*?(?=## What to change\n)/)] },
  XA: { system: [cut(/## What to change\n[\s\S]*?(?=## Format\n)/)] },
  XF: { system: [cut(/\n+## Format\n[\s\S]*$/)] },
  XU: { user: [cut(/ A clear shift in how a character regards the player[^\n]*$/)] },
  XUA: { user: [cut(/\n\nGive each character's stats[^\n]*$/)] },
  // One line each, of What to change and Format.
  XA1: { system: [cut(/- The RIGHT stat in the RIGHT direction[^\n]*\n/)] },
  XA2: { system: [cut(/- Many turns move no stat at all[^\n]*\n/)] },
  XA3: { system: [cut(/- List a stat only for a change you can point to[^\n]*\n/)] },
  XA4: { system: [cut(/- Report each stat that genuinely moved[^\n]*\n/)] },
  XA5: { system: [cut(/- The amount is a rough judgment[^\n]*\n/)] },
  XA6: { system: [cut(/- Each stat belongs to the character it sits under[^\n]*\n/)] },
  XF1: { system: [cut(/- One key per character, named exactly as its heading shows[^\n]*\n/)] },
  XF2: { system: [cut(/- Put the sign on the number[^\n]*\n/)] },
  XF3: { system: [cut(/- A value or maximum that did not move gets 0\.\n/)] },
  XF4: { system: [cut(/\n- Write the whole object on one line\.$/)] },
  // Vigor's description names what moves it, for the player and every entity with Vigor.
  SV: { system: [[/Physical energy and stamina\./g, 'Physical energy and stamina. Hard work, injury, and going without food or sleep lower it; rest and food raise it.']] },
  // The lines both passes read as noise, cut together: the role framing, A1 and A2.
  XN: { system: [
    cut(/ Each stat is a number[^.]*\. The narrator reads the stats[^.]*\./),
    cut(/- The RIGHT stat in the RIGHT direction[^\n]*\n/),
    cut(/- Many turns move no stat at all[^\n]*\n/),
  ] },
} satisfies Record<string, Wording>;
type AblationArm = keyof typeof ABLATIONS | `${keyof typeof ABLATIONS}G`;
const ablationOf = (arm: Arm) => (arm.endsWith('G') ? arm.slice(0, -1) : arm);
const isAblation = (arm: Arm): arm is AblationArm & Arm => /^(X|SV)/.test(arm) && ablationOf(arm) in ABLATIONS;
const ablationBase = arms.some(isAblation) ? await promptsAt(ABLATION_REF) : undefined;
function ablated(arm: AblationArm, owners: Owner[], narration: string): Call {
  const call = baseLayoutCall(owners, narration, arm.endsWith('G') ? 'described' : undefined, ablationBase!);
  const { system = [], user = [] }: Wording = ABLATIONS[ablationOf(arm) as keyof typeof ABLATIONS];
  return {
    ...call,
    system: system.reduce((text, [from, to]) => swap(text, from, to), call.system),
    user: user.reduce((text, [from, to]) => swap(text, from, to), call.user),
  };
}

/** SG with each group bullet in the Stats section reshaped and its stat bullets dedented to the owner's level:
 *  a `####` sub-heading over its description (SH), or a plain `Name: description` line (SP). Prototype only. */
function regroupedCall(arm: 'SH' | 'SP', owners: Owner[], narration: string): Call {
  const call = baseLayoutCall(owners, narration, 'described', basePrompts!);
  const names = new Set(Object.values(STAT_GROUPS).map((g) => g.name));
  const start = call.system.indexOf('## Stats\n');
  const end = call.system.indexOf('\n## ', start + 1);
  if (start < 0 || end < 0) throw new Error('Stat prompt drifted: no Stats section.');
  const section = call.system.slice(start, end).split('\n').map((line) => {
    const group = /^- \*\*(.+?):\*\*(?: (.*))?$/.exec(line);
    if (group && names.has(group[1])) {
      const desc = group[2] ?? '';
      return arm === 'SH' ? `#### ${group[1]}${desc ? `\n${desc}` : ''}` : `${group[1]}:${desc ? ` ${desc}` : ''}`;
    }
    return line.startsWith('  - ') ? line.slice(2) : line;
  }).join('\n');
  return { ...call, system: call.system.slice(0, start) + section + call.system.slice(end) };
}

/** What a lean reply holds per stat: every change with 0 (L), every new reading (LV), or only the changed stats (LD). */
const LEAN_FORMATS = {
  L: "Its value gives each of that character's stats this turn's change as a signed whole number between -20 and 20, and 0 for a stat that did not change.",
  LV: "Its value gives each of that character's stats its reading after this turn, as a whole number within that stat's range. A stat that did not change keeps its current reading.",
  LR: "Its value gives each of that character's stats this turn's change as a signed whole number between -20 and 20, and 0 for a stat that did not change. Record every change the narration shows, even a small one.",
  LT: "Its value gives each of that character's stats this turn's change as a signed whole number between -20 and 20, and 0 for a stat that did not change.",
  LD: "Its value holds only the stats this turn changed, each with its change as a signed whole number between -20 and 20. Leave out every stat that did not change; a character with no changed stat gets an empty object.",
} as const;
type LeanArm = keyof typeof LEAN_FORMATS;
const isLean = (arm: Arm): arm is LeanArm => arm in LEAN_FORMATS;

/** The lean request: every owner's stats as name and reading, one format line, then the narration. */
function leanCall(arm: LeanArm, owners: Owner[], narration: string): Call {
  const line = (s: PlayerStat) => `- ${s.name}: ${s.value}/${s.max}${s.description ? `. ${s.description}` : ''}`;
  const system = [
    "You track the stats of the characters in a roleplay. Read the narration and record how it changed each character's stats.",
    ...owners.map((o) => `\n### ${o.name}\n${o.stats.map(line).join('\n')}`),
    `\nOutput one JSON object on one line. One key per character, named as its heading shows. ${LEAN_FORMATS[arm]}`,
  ].join('\n');
  const field = (s: PlayerStat) => (arm === 'LV' ? { type: 'integer', minimum: s.min ?? 0, maximum: s.max ?? 100 } : { type: 'integer', minimum: -20, maximum: 20 });
  const schema = {
    type: 'object', additionalProperties: false, required: owners.map((o) => o.name),
    properties: Object.fromEntries(owners.map((o) => [o.name, {
      type: 'object', additionalProperties: false, required: arm === 'LD' ? [] : o.stats.map((s) => s.name),
      properties: Object.fromEntries(o.stats.map((s) => [s.name, field(s)])),
    }])),
  };
  const regard = arm === 'LT' ? "\n\nA clear shift in how a character regards the player moves that character's own stat." : '';
  // Room for a pretty-printed object: the lean prompt carries no one-line rule the model keeps to.
  return { system, user: `Narration: ${narration}${regard}`, maxTokens: 24 * total(owners) + 24 * owners.length + 32, schema };
}

function callsFor(arm: Arm, owners: Owner[], narration: string): Call[] {
  if (isLean(arm)) return [leanCall(arm, owners, narration)];
  if (arm === 'S') return [shippedCall(owners, narration)];
  if (arm === 'OB') return [shippedCall(owners, narration, SHIPPED_PROMPTS, { persona: true })];
  if (arm === 'SB') return [baseLayoutCall(owners, narration, undefined, basePrompts!)];
  if (arm === 'S0') return [s0Bounded(shippedCall(owners, narration, s0Prompts))];
  if (arm === 'OB0') return [s0Bounded(shippedCall(owners, narration, s0Prompts, { persona: true }))];
  if (isWording(arm)) return [worded(arm, owners, narration)];
  if (isScale(arm)) return [scaled(arm, owners, narration)];
  if (isFraming(arm)) return [framed(arm, owners, narration)];
  if (isAblation(arm)) return [ablated(arm, owners, narration)];
  if (arm === 'SG') return [baseLayoutCall(owners, narration, 'described', basePrompts!)];
  if (arm === 'SH' || arm === 'SP') return [regroupedCall(arm, owners, narration)];
  if (arm === 'SGB') return [baseLayoutCall(owners, narration, 'bare', basePrompts!)];
  if (arm === 'SGO') return [baseLayoutCall(owners, narration, 'hidden', basePrompts!)];
  if (arm === 'SU' || arm === 'SN') return [shippedVariant(arm, owners, narration)];
  if (arm === 'C3P') return callsFor('C3', [playerOwner], narration);
  if (arm === 'control') {
    return [{ owner: playerOwner, system: render(defaultStatUpdatesPrompt, playerOwner), user: userFor(narration), maxTokens: statUpdatesCap(playerOwner.stats.length) }];
  }
  if (arm === 'B') return owners.map((owner) => perOwnerCall(owner, narration));
  if (arm === 'E') return [gateCall(owners, narration)];
  const maxLines = statUpdatesCap(total(owners)) + 8 * total(owners);
  if (arm === 'A') {
    let system = sharedSystem(owners);
    system = swap(system, /One line per changed stat: its exact name from the list above/,
      "One line per changed stat: the character's name exactly as its heading shows, a slash, then the stat's exact name from that character's list");
    const user = swap(defaultStatUpdatesUserPrompt, 'each a stat name, a colon,', 'each a character name, a slash, a stat name, a colon,');
    return [{ system: render(system), user: userFor(narration, user), maxTokens: maxLines }];
  }
  if (arm === 'A2') {
    let system = sharedSystem(owners);
    system = swap(system, /One line per changed stat: its exact name from the list above \(written plainly - never a \+ or - on the name\), a colon, then one signed whole number\. Nothing else on the line\./,
      "One line per changed stat, in the shape Name / Stat: change. Every line starts with its character's name exactly as the heading shows - the Player Character's lines too, since several characters share stat names. Then a slash, the stat's exact name from that character's list (written plainly - never a + or - on the name), a colon, and one signed whole number. Nothing else on the line.");
    system = swap(system, 'never a fraction, a slash, or a value-over-maximum', 'never a fraction or a value-over-maximum');
    let user = swap(defaultStatUpdatesUserPrompt, 'each a stat name, a colon,', "each line a character's name, a slash, a stat name, a colon,");
    user = swap(user, '(not a value, not a fraction, no slash)', '(not a value, not a fraction)');
    return [{ system: render(system), user: userFor(narration, `${user} Every line starts with a character's name.`), maxTokens: maxLines }];
  }
  if (arm === 'A3') {
    let system = sharedSystem(owners);
    system = swap(system, /- One line per changed stat: its exact name from the list above/,
      "- Group the lines by character, as the Stats section does: a character's name alone on a line, exactly as its heading shows, then one line per changed stat of that character. Name only characters with a changed stat.\n- Each stat line: the stat's exact name from that character's list");
    const user = swap(defaultStatUpdatesUserPrompt, /- each a stat name, a colon,/, "- under each moved character's name, each a stat name, a colon,");
    return [{ system: render(system), user: userFor(narration, user), maxTokens: maxLines }];
  }
  let system = swap(sharedSystem(owners), ...ONE_JSON);
  if (arm === 'D') {
    system = swap(system, ...SOCIAL_RULE);
    system = swap(system, /## Format[\s\S]*$/,
      "## Format\n- One key per character, named exactly as its heading shows. Under it, one key per stat of that character, each holding two fields in this order: `evidence` - a few words naming what in the narration moved that stat, or none; then `change` - this turn's change as one signed whole number between -20 and 20.\n- A stat whose evidence is none gets 0.\n- Write the whole object on one line.");
    const user = swap(defaultStatUpdatesUserPrompt, /List only the stats[\s\S]*$/, "For each character's stats, name the evidence from this narration, then the change: 0 when there is none.");
    const schema = {
      type: 'object', additionalProperties: false, required: owners.map((o) => o.name),
      properties: Object.fromEntries(owners.map((o) => [o.name, {
        type: 'object', additionalProperties: false, required: o.stats.map((s) => s.name),
        properties: Object.fromEntries(o.stats.map((s) => [s.name, {
          type: 'object', additionalProperties: false, required: ['evidence', 'change'],
          properties: { evidence: { type: 'string', maxLength: 80 }, change: { type: 'integer', minimum: -20, maximum: 20 } },
        }])),
      }])),
    };
    return [{ system: render(system), user: userFor(narration, user), maxTokens: 48 * total(owners) + 16 * owners.length + 16, schema }];
  }
  if (arm === 'C2' || arm === 'C3') {
    if (arm === 'C3') system = swap(system, ...SOCIAL_RULE);
    system = swap(system, /## Format[\s\S]*$/,
      "## Format\n- One key per character, named exactly as its heading shows. Its value gives each of that character's stats this turn's change as one signed whole number between -20 and 20.\n- A stat that did not move gets 0.\n- Write the whole object on one line.");
    const user = swap(defaultStatUpdatesUserPrompt, /List only the stats[\s\S]*$/, "Give each character's stats their change from this narration: 0 for every stat it did not move.");
    const schema = {
      type: 'object', additionalProperties: false, required: owners.map((o) => o.name),
      properties: Object.fromEntries(owners.map((o) => [o.name, {
        type: 'object', additionalProperties: false, required: o.stats.map((s) => s.name),
        properties: Object.fromEntries(o.stats.map((s) => [s.name, { type: 'integer', minimum: -20, maximum: 20 }])),
      }])),
    };
    return [{ system: render(system), user: userFor(narration, user), maxTokens: 16 * total(owners) + 16 * owners.length + 16, schema }];
  }
  system = swap(system, /## Format[\s\S]*$/,
    "## Format\n- One key per character, named exactly as its heading shows. Its value lists only that character's changed stats: each stat's exact name and its change as one signed whole number between -20 and 20.\n- A character whose stats did not move gets an empty list.");
  const user = swap(defaultStatUpdatesUserPrompt, /List only the stats[\s\S]*$/, 'Record only the stats this narration actually moved, for each character. An empty list when nothing changed.');
  const schema = {
    type: 'object', additionalProperties: false, required: owners.map((o) => o.name),
    properties: Object.fromEntries(owners.map((o) => [o.name, {
      type: 'array', maxItems: o.stats.length,
      items: {
        type: 'object', additionalProperties: false, required: ['stat', 'change'],
        properties: { stat: { type: 'string', enum: o.stats.map((s) => s.name) }, change: { type: 'integer', minimum: -20, maximum: 20 } },
      },
    }])),
  };
  return [{ system: render(system), user: userFor(narration, user), maxTokens: 32 * total(owners) + 16 * owners.length + 16, schema }];
}

// The app's request layer builds every body: default settings, and the endpoint's reasoning record resolved as
// the app resolves it. The probe adds only `seed`, a non-streamed reply, and the --ws hints.
const apiToken = process.env.FM_API_TOKEN ?? '';
const reasoning = await resolveReasoningCapability({ url: endpoint, token: apiToken, model }) ?? UNKNOWN_REASONING_CAPABILITY;
const promptReasoning: Record<string, PromptReasoning> = {};
const settings: AiSettingsSnapshot = {
  resolveTarget: () => ({
    endpointId: 'probe', url: endpoint, apiToken, model, maxTokens: DEFAULT_MAX_TOKENS, localEngine: false,
    samplerOverrides: defaultEndpointSamplerOverrides(), reasoning,
  }),
  thinkingMode: 'off',
  reasoningEffort: resolveReasoningSetting(DEFAULT_REASONING_SETTING),
  reasoningEngaged: isReasoningEngaged('off', resolveReasoningSetting(DEFAULT_REASONING_SETTING), promptReasoning),
  promptReasoning,
  promptReasoningBudget: {},
  promptSamplers: {},
  promptMaxOutput: {},
  genTemperature: DEFAULT_GEN_TEMPERATURE,
  genRepetitionPenalty: DEFAULT_GEN_REPETITION_PENALTY,
  genTopP: DEFAULT_GEN_TOP_P,
  genTopK: DEFAULT_GEN_TOP_K,
  genMinP: DEFAULT_GEN_MIN_P,
  paragraphLimit: 'auto',
  disableThinking: false,
};

/** One call's request, as the app's request layer builds it, with the probe's additions. */
function requestFor(call: Call, seed: number) {
  const spec = buildAiRequestSpec(settings, {
    systemPrompt: call.system,
    messages: [{ role: 'user', content: call.user }],
    requestType: 'statUpdates',
    maxTokensOverride: call.maxTokens,
    ...(call.schema && { responseSchema: { name: 'stat_changes', schema: call.schema as ResponseSchemaNode } }),
  });
  return { spec, body: { ...spec.body, seed, stream: false, ...(call.schema && WHITESPACE[whitespace]) } };
}

interface Reply { raw: string; capHit: boolean; promptTokens: number; completionTokens: number }
async function complete(call: Call, seed: number): Promise<Reply> {
  const { spec, body } = requestFor(call, seed);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(spec.url, { method: 'POST', headers: spec.headers, body: JSON.stringify(body) });
    if (res.ok) {
      const body = await res.json() as {
        choices: Array<{ message: { content: string | null }; finish_reason: string }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };
      return {
        raw: body.choices[0].message.content ?? '', capHit: body.choices[0].finish_reason === 'length',
        promptTokens: body.usage?.prompt_tokens ?? 0, completionTokens: body.usage?.completion_tokens ?? 0,
      };
    }
    if (res.status < 500 || attempt >= 2) throw new Error(`${res.status} ${await res.text()}`);
  }
}

/** LV's reply with each new reading turned into its change from the current reading; unreadable text passes through. */
function readingsToChanges(raw: string, owners: Owner[]): string {
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return raw; }
  if (!body || typeof body !== 'object') return raw;
  return JSON.stringify(Object.fromEntries(Object.entries(body as Record<string, unknown>).map(([name, stats]) => {
    const owner = owners.find((o) => o.name === name);
    if (!owner || !stats || typeof stats !== 'object') return [name, stats];
    return [name, Object.fromEntries(Object.entries(stats as Record<string, unknown>).map(([stat, reading]) => {
      const current = owner.stats.find((s) => s.name === stat)?.value;
      return [stat, typeof reading === 'number' && typeof current === 'number' ? reading - current : reading];
    }))];
  })));
}

function parse(arm: Arm, owners: Owner[], calls: Call[], replies: Reply[]): Parsed {
  if (arm === 'A' || arm === 'A2') return parseOwnerLines(replies[0].raw, owners);
  if (arm === 'A3') return parseOwnerBlocks(replies[0].raw, owners);
  if (arm === 'LV') return parseJsonReply(readingsToChanges(replies[0].raw, owners), owners);
  if (arm === 'C' || arm === 'C2' || arm === 'C3' || arm === 'D' || isLean(arm)) return parseJsonReply(replies[0].raw, owners);
  if (arm === 'C3P') return parseJsonReply(replies[0].raw, [playerOwner]);
  if (arm === 'S' || arm === 'OB' || arm === 'SB' || arm === 'S0' || arm === 'OB0' || arm === 'SU' || arm === 'SN' || arm === 'SG' || arm === 'SGB' || arm === 'SGO' || arm === 'SH' || arm === 'SP' || isWording(arm) || isScale(arm) || isFraming(arm) || isAblation(arm)) return parsePlainLines(replies[0].raw, playerOwner, calls[0].snapshot, (id) => (id === null || id === PERSONA_ID || id === PLAYER_ID ? playerOwner.key : id));
  const parts = calls.flatMap((call, i) => (call.owner ? [parsePlainLines(replies[i].raw, call.owner, call.snapshot)] : []));
  return {
    changes: parts.flatMap((p) => p.changes), invalid: parts.reduce((n, p) => n + p.invalid, 0), unreadable: false,
    maxChanges: parts.reduce((n, p) => n + (p.maxChanges ?? 0), 0),
  };
}

const cases = fixture.cases.filter((c) => !only || only.split(',').includes(c.id));
const ownersOf = (c: typeof cases[number]) => [playerOwner, ...c.present.map(entityOwner)];

if (args.includes('--dump')) {
  const c = cases[0];
  for (const arm of arms) {
    for (const call of callsFor(arm, ownersOf(c), c.narration)) {
      console.log(`\n===== ${arm}${call.owner ? ` · ${call.owner.name}` : ''} · max ${call.maxTokens}\n--- system\n${call.system}\n--- user\n${call.user}`);
      if (call.schema) console.log(`--- schema\n${JSON.stringify(call.schema)}`);
      const { messages: _messages, response_format: _format, ...fields } = requestFor(call, SEED).body;
      console.log(`--- body fields\n${JSON.stringify(fields)}`);
    }
  }
  process.exit(0);
}

interface Result {
  arm: Arm; case: string; run: number; score: Score; player: Score; world: Score; parsed: Parsed; replies: Reply[]; ms: number;
  /** Each nonzero value change's size beside its stat's range. */
  sizes: Array<{ abs: number; range: number }>;
  /** Arm E: owners with a gold move the gate left out, and owners it named with nothing to move. */
  gate?: { missed: number; extra: number };
}
const results: Result[] = [];
const started = Date.now();
console.log(`model ${model} · ${endpoint} · runs ${runs} · pool ${pool} · sheet ${sheet} · arms ${arms.join(',')}`);
const jobs = cases.flatMap((c) => Array.from({ length: runs }, (_, run) => arms.map((arm) => ({ arm, c, run })))).flat();
let next = 0;
await Promise.all(Array.from({ length: pool }, async () => {
  while (next < jobs.length) {
    const { arm, c, run } = jobs[next++];
    const owners = ownersOf(c);
    const scope = arm === 'control' || arm === 'C3P' ? ['player'] : owners.map((o) => o.key);
    try {
      const calls = callsFor(arm, owners, c.narration);
      const t0 = Date.now();
      const replies = await Promise.all(calls.map((call) => complete(call, SEED + run)));
      let gate: Result['gate'];
      if (arm === 'E') {
        const named = gatedOwners(replies[0].raw, owners);
        const moves = (o: Owner) => Boolean(c.expect[o.key] && Object.keys(c.expect[o.key]).length);
        gate = {
          missed: owners.filter((o) => moves(o) && !named.includes(o)).length,
          extra: named.filter((o) => !moves(o) && !c.allow[o.key]).length,
        };
        const second = named.map((o) => perOwnerCall(o, c.narration));
        calls.push(...second);
        replies.push(...await Promise.all(second.map((call) => complete(call, SEED + run))));
      }
      const ms = Date.now() - t0;
      const read = parse(arm, owners, calls, replies);
      const parsed = { ...read, changes: read.changes.map((ch) => ({ ...ch, owner: gradeOwner(ch.owner, ch.stat) })) };
      const score = scoreChanges(parsed.changes, c.expect, c.allow, worldSetup.loose.length && arm !== 'control' && arm !== 'C3P' ? [...scope, 'world'] : scope);
      const player = scoreChanges(parsed.changes, c.expect, c.allow, ['player']);
      const loose = scoreChanges(parsed.changes, c.expect, c.allow, ['world']);
      const statOf = (ch: Change) => (owners.find((o) => o.key === ch.owner) ?? playerOwner).stats.find((s) => s.name === ch.stat)
        ?? playerOwner.stats.find((s) => s.name === ch.stat);
      const sizes = parsed.changes.filter((ch) => ch.change !== 0).map((ch) => {
        const stat = statOf(ch);
        return { abs: Math.abs(ch.change), range: stat ? stat.max - stat.min : NaN };
      });
      results.push({ arm, case: c.id, run, score, player, world: loose, parsed, replies, ms, gate, sizes });
      const caps = replies.filter((r) => r.capHit).length;
      console.log(`[${arm}] ${c.id} #${run} exact=${score.exact ? 1 : 0} hits ${score.hits}/${score.expected} sign ${score.wrongSign} spur ${score.spurious} misattr ${score.misattributed} inv ${parsed.invalid}${parsed.unreadable ? ' UNREADABLE' : ''} dup ${score.duplicates}${caps ? ` CAP×${caps}` : ''}${gate ? ` gate-missed ${gate.missed} gate-extra ${gate.extra}` : ''} · ${ms}ms`);
      if (args.includes('--show')) {
        replies.forEach((r, i) => console.log(`    ${calls[i].owner ? `${calls[i].owner!.name}: ` : ''}${r.raw.replace(/\s*\n\s*/g, ' ¶ ') || '(empty)'}`));
      }
    } catch (error) {
      console.log(`[${arm}] ${c.id} #${run} FAILED ${(error as Error).message.slice(0, 200)}`);
    }
  }
}));

const sum = (xs: Result[], f: (r: Result) => number) => xs.reduce((n, r) => n + f(r), 0);
const mean = (xs: Result[], f: (r: Result) => number) => (xs.length ? sum(xs, f) / xs.length : NaN);
const pct = (k: number, n: number) => (n ? `${k}/${n} (${Math.round((100 * k) / n)}%)` : '-');
const p90 = (xs: number[]) => xs.sort((a, b) => a - b)[Math.max(0, Math.ceil(xs.length * 0.9) - 1)] ?? NaN;

console.log('\nTOTALS per arm (control and C3P are graded on player cells only)');
console.log('arm      exact          recall          sign spur misattr inv unread dup cap max   ms(mean/p90)  tok in/out');
for (const arm of arms) {
  const xs = results.filter((r) => r.arm === arm);
  if (!xs.length) continue;
  const caps = sum(xs, (r) => r.replies.filter((x) => x.capHit).length);
  console.log([
    arm.padEnd(8),
    pct(xs.filter((r) => r.score.exact).length, xs.length).padEnd(14),
    pct(sum(xs, (r) => r.score.hits), sum(xs, (r) => r.score.expected)).padEnd(15),
    String(sum(xs, (r) => r.score.wrongSign)).padStart(4),
    String(sum(xs, (r) => r.score.spurious)).padStart(4),
    String(sum(xs, (r) => r.score.misattributed)).padStart(7),
    String(sum(xs, (r) => r.parsed.invalid)).padStart(3),
    String(xs.filter((r) => r.parsed.unreadable).length).padStart(6),
    String(sum(xs, (r) => r.score.duplicates)).padStart(3),
    String(caps).padStart(3),
    String(sum(xs, (r) => r.parsed.maxChanges ?? 0)).padStart(3),
    `${Math.round(mean(xs, (r) => r.ms))}/${p90(xs.map((r) => r.ms))}`.padStart(14),
    `${Math.round(mean(xs, (r) => sum([r], (q) => q.replies.reduce((n, x) => n + x.promptTokens, 0))))}/${Math.round(mean(xs, (r) => r.replies.reduce((n, x) => n + x.completionTokens, 0)))}`.padStart(11),
  ].join(' '));
}
const gated = results.filter((r) => r.gate);
if (gated.length) {
  const owed = sum(gated, (r) => Object.values(fixture.cases.find((c) => c.id === r.case)!.expect).filter((cells) => Object.keys(cells).length).length);
  console.log(`E gate: missed ${sum(gated, (r) => r.gate!.missed)}/${owed} owners with a gold move · named ${sum(gated, (r) => r.gate!.extra)} with nothing to move`);
}

if (worldSetup.loose.length) {
  console.log(`\nWORLD (the loose stats ${worldSetup.loose.join(', ')}: recall, wrong signs, invented moves)`);
  for (const arm of arms) {
    const xs = results.filter((r) => r.arm === arm);
    if (!xs.length) continue;
    console.log(`${arm.padEnd(8)} recall ${pct(sum(xs, (r) => r.world.hits), sum(xs, (r) => r.world.expected)).padEnd(14)} sign ${sum(xs, (r) => r.world.wrongSign)}  spur ${sum(xs, (r) => r.world.spurious)}`);
  }
}

console.log('\nPLAYER-ONLY (every arm regraded on player cells)');
for (const arm of arms) {
  const xs = results.filter((r) => r.arm === arm);
  if (!xs.length) continue;
  console.log(`${arm.padEnd(8)} exact ${pct(xs.filter((r) => r.player.exact).length, xs.length).padEnd(14)} recall ${pct(sum(xs, (r) => r.player.hits), sum(xs, (r) => r.player.expected)).padEnd(14)} spur ${sum(xs, (r) => r.player.spurious)}`);
}

console.log('\nINVENTED per arm (player cells, entity cells, max changes, and push-bram player cells: the Q64 case)');
for (const arm of arms) {
  const xs = results.filter((r) => r.arm === arm);
  if (!xs.length) continue;
  const player = sum(xs, (r) => r.player.spurious);
  const bram = sum(xs.filter((r) => r.case === 'push-bram'), (r) => r.player.spurious);
  console.log(`${arm.padEnd(8)} player ${String(player).padStart(4)}  entity ${String(sum(xs, (r) => r.score.spurious) - player).padStart(4)}  max ${String(sum(xs, (r) => r.parsed.maxChanges ?? 0)).padStart(3)}  push-bram player ${bram}`);
}

console.log('\nCELLS per arm (missed or wrong-signed gold moves, then spurious moves; count × case:owner/stat±)');
const tally = (cells: string[]) => [...cells.reduce((m, c) => m.set(c, (m.get(c) ?? 0) + 1), new Map<string, number>())]
  .sort((a, b) => b[1] - a[1]).map(([cell, n]) => `${n}×${cell}`).join(' ') || '-';
for (const arm of arms) {
  const xs = results.filter((r) => r.arm === arm);
  if (!xs.length) continue;
  console.log(`${arm.padEnd(8)} missed ${tally(xs.flatMap((r) => r.score.missedCells.map((c) => `${r.case}:${c}`)))}`);
  console.log(`${''.padEnd(8)} spur   ${tally(xs.flatMap((r) => r.score.spuriousCells.map((c) => `${r.case}:${c}`)))}`);
}

console.log('\nSIZE per arm (nonzero value changes: count, mean, p90, max, past 20, past a quarter of the range; narrow = range ≤ 40)');
for (const arm of arms) {
  const all = results.filter((r) => r.arm === arm).flatMap((r) => r.sizes);
  if (!all.length) continue;
  const narrow = all.filter((s) => s.range <= 40);
  const line = (xs: typeof all) => {
    const abs = xs.map((s) => s.abs);
    const avg = abs.reduce((n, x) => n + x, 0) / (abs.length || 1);
    return `n ${String(xs.length).padStart(4)}  mean ${avg.toFixed(1).padStart(5)}  p90 ${String(p90([...abs])).padStart(4)}  max ${String(Math.max(...abs, 0)).padStart(4)}`
      + `  >20 ${String(xs.filter((s) => s.abs > 20).length).padStart(3)}  >¼range ${String(xs.filter((s) => s.abs > s.range / 4).length).padStart(3)}`;
  };
  console.log(`${arm.padEnd(8)} all    ${line(all)}`);
  if (narrow.length) console.log(`${''.padEnd(8)} narrow ${line(narrow)}`);
}

console.log('\nEXACT per case');
console.log(`${'case'.padEnd(14)} ${arms.map((a) => a.padEnd(9)).join(' ')}`);
for (const c of cases) {
  const cell = (arm: Arm) => { const xs = results.filter((r) => r.arm === arm && r.case === c.id); return `${xs.filter((r) => r.score.exact).length}/${xs.length}`; };
  console.log(`${c.id.padEnd(14)} ${arms.map((a) => cell(a).padEnd(9)).join(' ')}`);
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
