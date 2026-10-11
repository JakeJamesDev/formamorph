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
//   S        the shipped request: the app's own stat pass builder, prompts and schema, every present owner
//   SU       S, with C3's user line
//   SN       S, with no max keys in the schema, the format or the user line
//   SG       S, with every owner's stats in author-style groups (Body, Mind, Bonds, Trade)
//   SGB      SG with bare group headings, no descriptions
//   SGO      SG with every group's heading hidden from the AI (`aiVisible: false`); matches S byte for byte
//   SH       SG with each group as a #### sub-heading and its stats flat beneath
//   SP       SG with each group as a plain `Name: description` line and its stats flat beneath
//   S0       S, with the stat prompts as committed at --s0-ref (default HEAD, the before arm for an uncommitted edit)
//   WA..WR   ticket 05's request (ded57a32), with one wording change each (WORDINGS below)
// A to E derive from the text pass's prompt by checked text swaps; S is built by the app, so it is what ships.
//
// Per reply: exact (every gold move right, nothing spurious), hits / wrong sign / misses, spurious moves,
// misattributed (a spurious move whose stat the gold moves on another owner), invalid rows, duplicates,
// cap hits, wall-clock ms, and prompt + completion tokens. `player-only` regrades every arm on player cells.
// `max` counts invented max changes (no case moves a maximum); only control and S are read for them.
//
// Usage: npx vite-node testing/baseline/harness/entity-stats-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 6] [--pool 3] [--arms control,A,B,C] [--only storm-crowd]
//          [--ws free|pattern|xgrammar|outlines|lmfe] [--s0-ref REF] [--show] [--dump]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
// Arms A to E derive from the text pass's prompts, under the names they were written against.
import {
  defaultStatUpdatesPrompt as shippedStatPrompt, defaultStatUpdatesUserPrompt as shippedStatUserPrompt,
  textStatUpdatesPrompt as defaultStatUpdatesPrompt, textStatUpdatesUserPrompt as defaultStatUpdatesUserPrompt,
} from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { PROMPT_SAMPLER_PINS } from '@/lib/promptSamplers';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import { createStatRequest, type StatRequestSnapshot } from '@/lib/statRequest';
import { PLAYER_OWNER } from '@/lib/statOwners';
import { statUpdatesCap, statUpdatesRequest } from '@/lib/turnPipeline/turnPasses';
import { migrateWorld } from '@/lib/version';
import type { StatPlacement } from '@/lib/statContext';
import type { PlayerStat, StatGroup } from '@/types';
import {
  parseJsonReply, parseOwnerBlocks, parseOwnerLines, parsePlainLines, scoreChanges,
  type GoldCells, type Owner, type Parsed, type Score,
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
const ALL_ARMS = ['control', 'A', 'A2', 'A3', 'B', 'C', 'C2', 'C3', 'D', 'E', 'S', 'SU', 'SN', 'SG', 'SGB', 'SGO', 'SH', 'SP', 'C3P', 'S0', 'WA', 'WB', 'WC', 'WD', 'WE', 'WF', 'WH', 'WJ', 'WK', 'WL', 'WP', 'WQ', 'WR'] as const;
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
const world = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'entity-stats-cases.json'), 'utf8')) as {
  entityStats: Record<string, PlayerStat[]>;
  cases: Array<{ id: string; present: string[]; narration: string; expect: GoldCells; allow: GoldCells }>;
};

const location = world.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');
const BASE_CTX = chipValues(authoredChipScene(world, {
  location,
  activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
  resolveEntity: (_entity, text) => text,
}));
const playerOwner: Owner = { key: 'player', name: PLAYER, stats: world.stats as PlayerStat[] };
const entityOwner = (id: string): Owner => {
  const entity = world.entities.find((e) => e.id === id);
  if (!entity) throw new Error(`No entity ${id} in Sedge Landing.`);
  return { key: id, name: entity.name, stats: fixture.entityStats[id].map((s) => ({ ...s, descriptors: [] }) as PlayerStat) };
};

const STATS_TOKEN = '<STATS DESCRIPTION|numbers.meaning.markdown>';
/** A text swap that throws when the real prompt no longer carries the text it replaces. */
function swap(text: string, from: string | RegExp, to: string): string {
  const out = text.replace(from, to);
  if (out === text) throw new Error(`Stat prompt drifted: ${String(from).slice(0, 60)} not found.`);
  return out;
}
const statsBlock = (owner: Owner) => createStatRequest(owner.stats).context[STATS_TOKEN];
const ownerSections = (owners: Owner[]) => owners.map((o) => `### ${o.name}\n${statsBlock(o)}`).join('\n\n');

function sharedSystem(owners: Owner[]): string {
  let t = swap(defaultStatUpdatesPrompt, "record how it moved the player's stats", 'record how it moved the stats of each character listed below');
  t = swap(t, '## Player Stats\n', "## Stats\nEach character's stats sit under their name. ");
  return swap(t, STATS_TOKEN, ownerSections(owners));
}

interface Call { owner?: Owner; system: string; user: string; maxTokens: number; schema?: object; snapshot?: StatRequestSnapshot }
const userFor = (narration: string, template = defaultStatUpdatesUserPrompt) => template.replace('<NARRATION>', narration);
const render = (system: string, owner?: Owner) =>
  renderPromptTemplate(system, owner ? { ...BASE_CTX, ...createStatRequest(owner.stats).context } : BASE_CTX);
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

/** The request the app sends, built by the app's own stat pass: the player's stats and each present owner's,
 *  in groups when `groups` names a style, from `prompts` when given. */
function shippedCall(
  owners: Owner[], narration: string, groups?: GroupStyle, prompts = { system: shippedStatPrompt, user: shippedStatUserPrompt },
): Call {
  const placement = (stats: readonly PlayerStat[]) => (groups ? { placement: grouped(stats, groups) } : {});
  const snapshot = createStatRequest(playerOwner.stats, PLAYER_OWNER, {
    ...placement(playerOwner.stats),
    entities: owners.filter((o) => o !== playerOwner).map((o) => ({ id: o.key, name: o.name, stats: o.stats, ...placement(o.stats) })),
  });
  const request = statUpdatesRequest(
    prompts,
    { ctx: BASE_CTX, action: '', narration },
    { statCount: playerOwner.stats.length, statRequest: snapshot, quiet: false },
  );
  if (!request.responseSchema) throw new Error('The shipped stat request carries no schema.');
  return {
    owner: playerOwner, system: request.systemPrompt, user: request.messages[0].content, snapshot,
    maxTokens: request.maxTokens ?? 0, schema: request.responseSchema.schema,
  };
}

/** The stat request's user line, after the narration. */
const USER_LINE = /Give each character's stats[^\n]*$/;
const C3_USER = "Give each character's stats their change from this narration: 0 for every stat it did not move.";
const C3_FORMAT = "- One key per character, named exactly as its heading shows. Its value gives each of that character's stats this turn's change as one signed whole number between -20 and 20.";

/** S with C3's user line (SU), or with no max keys at all, in the schema, the format or the user line (SN). */
function shippedVariant(arm: 'SU' | 'SN', owners: Owner[], narration: string): Call {
  const call = shippedCall(owners, narration);
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

/** The stat prompt pair as committed at a ref, imported from a copy of GamePrompts.ts at that ref. */
async function promptsAt(ref: string): Promise<{ system: string; user: string }> {
  const source = execFileSync('git', ['show', `${ref}:src/components/game/GamePrompts.ts`], { encoding: 'utf8' });
  const dir = mkdtempSync(path.join(tmpdir(), 'fm-prompts-'));
  const file = path.join(dir, 'GamePrompts.ts');
  writeFileSync(file, source);
  try {
    const mod = await import(pathToFileURL(file).href) as { defaultStatUpdatesPrompt: string; defaultStatUpdatesUserPrompt: string };
    return { system: mod.defaultStatUpdatesPrompt, user: mod.defaultStatUpdatesUserPrompt };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const s0Prompts = arms.includes('S0') ? await promptsAt(argVal('--s0-ref', 'HEAD')) : undefined;

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
  const call = shippedCall(owners, narration, undefined, wordingBase);
  const { system = [], user = [] }: Wording = WORDINGS[arm];
  return {
    ...call,
    system: system.reduce((text, [from, to]) => swap(text, from, to), call.system),
    user: user.reduce((text, [from, to]) => swap(text, from, to), call.user),
  };
}

/** SG with each group bullet in the Stats section reshaped and its stat bullets dedented to the owner's level:
 *  a `####` sub-heading over its description (SH), or a plain `Name: description` line (SP). Prototype only. */
function regroupedCall(arm: 'SH' | 'SP', owners: Owner[], narration: string): Call {
  const call = shippedCall(owners, narration, 'described');
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

function callsFor(arm: Arm, owners: Owner[], narration: string): Call[] {
  if (arm === 'S') return [shippedCall(owners, narration)];
  if (arm === 'S0') return [shippedCall(owners, narration, undefined, s0Prompts)];
  if (isWording(arm)) return [worded(arm, owners, narration)];
  if (arm === 'SG') return [shippedCall(owners, narration, 'described')];
  if (arm === 'SH' || arm === 'SP') return [regroupedCall(arm, owners, narration)];
  if (arm === 'SGB') return [shippedCall(owners, narration, 'bare')];
  if (arm === 'SGO') return [shippedCall(owners, narration, 'hidden')];
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

interface Reply { raw: string; capHit: boolean; promptTokens: number; completionTokens: number }
async function complete(call: Call, seed: number): Promise<Reply> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, seed, max_tokens: call.maxTokens, reasoning_effort: 'none', stream: false,
        temperature: PROMPT_SAMPLER_PINS.statUpdates?.temperature,
        messages: [{ role: 'system', content: call.system }, { role: 'user', content: call.user }],
        ...(call.schema ? {
          response_format: { type: 'json_schema', json_schema: { name: 'stat_changes', strict: true, schema: call.schema } },
          ...WHITESPACE[whitespace],
        } : {}),
      }),
    });
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

function parse(arm: Arm, owners: Owner[], calls: Call[], replies: Reply[]): Parsed {
  if (arm === 'A' || arm === 'A2') return parseOwnerLines(replies[0].raw, owners);
  if (arm === 'A3') return parseOwnerBlocks(replies[0].raw, owners);
  if (arm === 'C' || arm === 'C2' || arm === 'C3' || arm === 'D') return parseJsonReply(replies[0].raw, owners);
  if (arm === 'C3P') return parseJsonReply(replies[0].raw, [playerOwner]);
  if (arm === 'S' || arm === 'S0' || arm === 'SU' || arm === 'SN' || arm === 'SG' || arm === 'SGB' || arm === 'SGO' || arm === 'SH' || arm === 'SP' || isWording(arm)) return parsePlainLines(replies[0].raw, playerOwner, calls[0].snapshot, (id) => (id === PLAYER_OWNER ? playerOwner.key : id));
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
    }
  }
  process.exit(0);
}

interface Result {
  arm: Arm; case: string; run: number; score: Score; player: Score; parsed: Parsed; replies: Reply[]; ms: number;
  /** Arm E: owners with a gold move the gate left out, and owners it named with nothing to move. */
  gate?: { missed: number; extra: number };
}
const results: Result[] = [];
const started = Date.now();
console.log(`model ${model} · ${endpoint} · runs ${runs} · pool ${pool} · arms ${arms.join(',')}`);
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
      const parsed = parse(arm, owners, calls, replies);
      const score = scoreChanges(parsed.changes, c.expect, c.allow, scope);
      const player = scoreChanges(parsed.changes, c.expect, c.allow, ['player']);
      results.push({ arm, case: c.id, run, score, player, parsed, replies, ms, gate });
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

console.log('\nPLAYER-ONLY (every arm regraded on player cells)');
for (const arm of arms) {
  const xs = results.filter((r) => r.arm === arm);
  if (!xs.length) continue;
  console.log(`${arm.padEnd(8)} exact ${pct(xs.filter((r) => r.player.exact).length, xs.length).padEnd(14)} recall ${pct(sum(xs, (r) => r.player.hits), sum(xs, (r) => r.player.expected)).padEnd(14)} spur ${sum(xs, (r) => r.player.spurious)}`);
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

console.log('\nEXACT per case');
console.log(`${'case'.padEnd(14)} ${arms.map((a) => a.padEnd(9)).join(' ')}`);
for (const c of cases) {
  const cell = (arm: Arm) => { const xs = results.filter((r) => r.arm === arm && r.case === c.id); return `${xs.filter((r) => r.score.exact).length}/${xs.length}`; };
  console.log(`${c.id.padEnd(14)} ${arms.map((a) => cell(a).padEnd(9)).join(' ')}`);
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
