// Persona block stats probe — what changes when the played persona's own stats move from the Stats chip into
// its block, the Stats chip becomes "Other Stats" after Other Traits, and the choice writer reads the
// persona's Summary in place of its Name? Sedge Landing with a played library persona nobody here knows:
// Calm low, a Resolve that clashes with the world's and so reads "Resolve (2)", and one owned trait.
//
// Arms, paired by run index: `control` (ticket 02's prompts: Player Stats before the block, the persona's
// stats in that chip, the choice writer on Name) and `block` (the working tree). Every other byte is shared.
//
// Checks:
//   player-name     — the narration or a choice names the player, whom nobody here knows (guard, down)
//   npc-name-leak   — the narration names Bram or Odette, who have not given their names (guard, down)
//                     (neither applies to the storyboard plan, which is private stage direction)
//   stat-tabulation — a stat line such as "Calm: 10" (guard, down)
//   numeral-leak    — the output repeats a stat value, a range or a percent (guard, down)
//   numbered-name   — the output writes a numbered stat name such as "Resolve (2)" (guard, down)
//   label-leak      — the output repeats a stat label such as "Calm:" or "**Resolve**" (guard, down)
//   rattled         — the output shows the player shaken or wavering: the stats shape it (up)
//   trait-fit       — the output draws on the player's herbalist trait (up)
//   contract        — 3 to 5 option lines, each one "I ..." clause of at most 25 words (choices guard, up)
// Also reported per arm: mean words and the share of outputs with quoted dialogue (regression check).
//
// Usage: npx vite-node testing/baseline/harness/persona-block-stats-probe.cli.ts --
//          [--endpoint URL] [--model default] [--runs 12] [--max 600] [--only narr-bram,choice-odette] [--pool 4]
//          [--dump] [--show]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  defaultChoicesPrompt, defaultChoicesUserPrompt, defaultStoryboardPrompt, defaultSystemPrompt,
} from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues, playedStatParts, sceneEntityChipValues, statChipPartValues } from '@/lib/chipValues/chipValues';
import { resolveEntityText } from '@/lib/placeholders';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import { layerValues, type ValueLookup } from '@/lib/promptValues';
import { buildStoryboardUserMessage } from '@/lib/stagedPlanning';
import { statPlacementOf } from '@/lib/statContext';
import { stripMarkdown } from '@/lib/stripMarkdown';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { migrateWorld } from '@/lib/version';
import type { Entity, PlayerStat, Stat, Trait } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const runs = Number(argVal('--runs', '12'));
const maxTokens = Number(argVal('--max', '600'));
const pool = Number(argVal('--pool', '4'));
const only = argVal('--only', '');
const ARMS = ['control', 'block'] as const;
type Arm = typeof ARMS[number];
const SEED = 939393;

type Case = {
  id: string; kind: 'narration' | 'planning' | 'choices'; action?: string; narration?: string;
  scene?: string | string[]; intents?: Array<{ name: string; text: string }>; checks: string[];
};
const BASELINE = path.resolve('testing/baseline');
const base = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const entityFixture = JSON.parse(readFileSync(path.join(BASELINE, 'entity-stats-chip-cases.json'), 'utf8')) as {
  entityStats: Record<string, Stat[]>;
};
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'persona-stats-chip-cases.json'), 'utf8')) as {
  personaStats: Stat[]; cases: Case[];
};

// The template's trailing backslashes are line continuations, so the chips sit back to back in the string.
const BLOCK = (content: string) => `<PERSONA|${content}|header="{{user}} (Player Character)">`;
const OTHER_TRAITS = '<TRAITS DESCRIPTION|markdown|header="Other Traits">';
const OTHER_STATS = '<STATS DESCRIPTION|descriptions.markdown|header="Other Stats">';
const PLAYER_STATS = '<STATS DESCRIPTION|descriptions.markdown|header="Player Stats">';
/** The prompt as ticket 02 shipped it: Player Stats before a block that carried no stats. */
function controlOf(template: string, blockContent: string, controlContent: string): string {
  const now = BLOCK(blockContent) + OTHER_TRAITS + OTHER_STATS;
  if (!template.includes(now)) throw new Error(`A prompt does not carry ${now}.`);
  return template.replace(now, PLAYER_STATS + BLOCK(controlContent) + OTHER_TRAITS);
}
// The control block sends no stats, so its persona reads as before the stats moved in.
const TEMPLATES: Record<Arm, { narration: string; choices: string; planning: string }> = {
  control: {
    narration: controlOf(defaultSystemPrompt, 'markdown', 'nostats.markdown'),
    choices: controlOf(defaultChoicesPrompt, 'summary.markdown', 'name.markdown'),
    planning: controlOf(defaultStoryboardPrompt, 'markdown', 'nostats.markdown'),
  },
  block: { narration: defaultSystemPrompt, choices: defaultChoicesPrompt, planning: defaultStoryboardPrompt },
};

const resolveOwn = (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders: [], rolls: {} });
const location = base.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');
const herbalist: Trait = {
  id: 'probe-herbalist', name: 'Hedge Herbalist', statChanges: [],
  aiDescription: 'Knows every root, leaf and moss of the river country, and what each one cures or poisons.',
};
const personaStats: PlayerStat[] = fixture.personaStats.map((stat) => ({ ...stat, value: stat.value ?? stat.min }));
const sylvie: Entity = {
  id: 'probe-sylvie', name: 'Sylvie Thornwhistle', pronouns: 'she/her',
  aiDescription: 'A traveling herbalist with a satchel of dried roots, quick-eyed and a little too curious.',
  aiSummary: 'A curious traveling herbalist.',
  traits: [herbalist], stats: fixture.personaStats,
};
const cast = base.entities.map((e) => (entityFixture.entityStats[e.id] ? { ...e, stats: entityFixture.entityStats[e.id] } : e));
const authored = authoredChipScene({ ...base, entities: cast }, {
  location,
  activeTraitIds: base.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
  resolveEntity: resolveOwn,
});
const scene = {
  ...authored,
  persona: { source: 'library' as const, entity: sylvie },
  playerName: sylvie.name,
  ownedTraits: { ...authored.ownedTraits, [sylvie.id]: [herbalist.id] },
  ownedStats: { ...authored.ownedStats, [sylvie.id]: personaStats },
  playedStats: [{ ownerId: sylvie.id, stats: personaStats, placement: statPlacementOf(sylvie) }],
};
const blockCtx = chipValues(scene);
// The control arm's Stats chip is ticket 02's: the world's stats, then the persona's, numbered on a clash.
const world = { stats: scene.stats, placement: scene.statPlacement };
const CTX: Record<Arm, ValueLookup> = {
  block: blockCtx,
  control: layerValues(
    blockCtx,
    statChipPartValues([world, ...playedStatParts(world, scene.playedStats, (name) => stripMarkdown(name).trim())]),
  ),
};
if (!CTX.control(OTHER_STATS.replace(/\|header="[^"]*"/, ''))?.includes('Resolve (2)')) {
  throw new Error('The control Stats chip does not carry the numbered persona stat.');
}

const STAT_LABELS = ['Vigor', 'Resolve', 'Calm', 'Trust', 'Stock'];
const contract = (text: string) => {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length >= 3 && lines.length <= 5 && lines.every((l) => /^I\b/.test(l) && l.split(/\s+/).length <= 25);
};
const CHECKS: Record<string, { test: (text: string) => boolean; want: boolean }> = {
  'player-name': { test: (t) => /\b(Sylvie|Thornwhistle)\b/.test(t), want: false },
  'npc-name-leak': { test: (t) => /\b(Bram|Odette)\b/.test(t), want: false },
  'stat-tabulation': { test: (t) => /(^|\n)\s*[-*]?\s*(vigor|resolve|calm|hp|health|stat)\s*(\(\d+\))?\s*:?\s*[+-]?\d/i.test(t), want: false },
  'numeral-leak': { test: (t) => /\b\d+\s*(\/\s*\d+|percent|%| out of)/i.test(t) || /\b(vigor|resolve|calm|trust|stock)\b[^.\n]{0,12}\b\d+\b/i.test(t), want: false },
  'numbered-name': { test: (t) => /\b[A-Za-z][\w'-]*\s*\(\d+\)/.test(t), want: false },
  'label-leak': { test: (t) => STAT_LABELS.some((l) => new RegExp(`\\*\\*${l}\\*\\*|\\b${l}:`).test(t)), want: false },
  rattled: { test: (t) => /\b(shak\w*|trembl\w*|nervous\w*|jitter\w*|rattled|unsteady|uneas\w*|anxi\w*|on edge|hesita\w*|swallow\w*|clammy|falter\w*|waver\w*|doubt\w*|fear\w*|afraid|dread\w*|tight (chest|throat)|heart (pound\w*|hammer\w*|race\w*|thud\w*)|pulse|steady (myself|yourself|my|your)\b|calm (myself|my|down)|deep breath|breathe)\b/i.test(t), want: true },
  'trait-fit': { test: (t) => /\b(herb\w*|roots?|leaf|leaves|moss|remed\w*|poultice|salve|tincture|satchel|cure\w*|poison\w*|medicin\w*|forag\w*)\b/i.test(t), want: true },
  contract: { test: contract, want: true },
};
const NARRATION_CHECKS = ['player-name', 'npc-name-leak', 'stat-tabulation', 'numeral-leak', 'numbered-name', 'label-leak', 'rattled', 'trait-fit'];
const CHOICE_CHECKS = ['player-name', 'numeral-leak', 'numbered-name', 'label-leak', 'rattled', 'trait-fit', 'contract'];
// A plan is private stage direction, so it may name anyone.
const PLANNING_CHECKS = NARRATION_CHECKS.filter((check) => check !== 'player-name' && check !== 'npc-name-leak');
const CHECKS_BY_KIND = { narration: NARRATION_CHECKS, planning: PLANNING_CHECKS, choices: CHOICE_CHECKS };
const checksOf = (c: Case) => CHECKS_BY_KIND[c.kind];
const DIALOGUE = /["“][^"”]{3,}["”]/;

function request(arm: Arm, c: Case): { system: string; user: string; max?: number } {
  const ctx = CTX[arm];
  if (c.kind === 'planning') {
    return {
      system: renderPromptTemplate(TEMPLATES[arm].planning, ctx),
      user: buildStoryboardUserMessage({
        recap: '', scene: typeof c.scene === 'string' ? c.scene : '', intents: c.intents ?? [], overflow: [], action: c.action ?? '',
      }),
    };
  }
  if (c.kind === 'choices') {
    // The choice writer reads only who is in the scene, through the scene-roster override.
    const values = layerValues(ctx, sceneEntityChipValues(scene, Array.isArray(c.scene) ? c.scene : []), { '<LANGUAGE>': '' });
    return {
      system: renderPromptTemplate(TEMPLATES[arm].choices, values),
      user: renderPromptTemplate(defaultChoicesUserPrompt, layerValues(values, { '<NARRATION>': c.narration ?? '' })),
      max: 220,
    };
  }
  const system = buildNarrationPrompt({
    template: TEMPLATES[arm].narration, ctx, action: c.action ?? '', history: [], dictionary: [],
    actionVec: null, semanticLore: false, embedVectors: new Map(),
    language: 'English', paragraphLimit: 'single', maxTokens: 1024, markdownOutput: false,
    sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
  return { system, user: c.action ?? '' };
}

async function complete(req: ReturnType<typeof request>, seed: number): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Narration, choices and the storyboard are unpinned, so they send no temperature.
      body: JSON.stringify({
        model, seed, max_tokens: req.max ?? maxTokens, reasoning_effort: 'none', stream: false,
        messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.user }],
      }),
    });
    if (res.ok) {
      const body = await res.json() as { choices: Array<{ message: { content: string | null } }> };
      return body.choices[0].message.content ?? '';
    }
    if (res.status < 500 || attempt >= 2) throw new Error(`${res.status} ${await res.text()}`);
  }
}

const cases = fixture.cases.filter((c) => !only || only.split(',').includes(c.id));
if (args.includes('--dump')) {
  for (const c of cases.filter((x, i, all) => all.findIndex((y) => y.kind === x.kind) === i)) {
    for (const arm of ARMS) {
      const sys = request(arm, c).system;
      const at = sys.indexOf('(Player Character)');
      console.log(`\n--- ${c.kind} · ${arm}\n${sys.slice(Math.max(0, at - 400), at + 1400)}`);
    }
  }
  process.exit(0);
}

type Result = { arm: Arm; case: string; run: number; text: string };
const results: Result[] = [];
const started = Date.now();
console.log(`model ${model} · runs ${runs} per arm per case · pool ${pool}`);
// Arms interleave run by run, so drift during the batch lands on both.
const jobs = cases.flatMap((c) => Array.from({ length: runs }, (_, run) => ARMS.map((arm) => ({ arm, c, run })))).flat();
let next = 0;
await Promise.all(Array.from({ length: pool }, async () => {
  while (next < jobs.length) {
    const { arm, c, run } = jobs[next++];
    try {
      const text = await complete(request(arm, c), SEED + run);
      results.push({ arm, case: c.id, run, text });
      const hits = checksOf(c).map((check) => `${check}=${CHECKS[check].test(text) ? 1 : 0}`).join(' ');
      console.log(`[${arm}] ${c.id} #${run} ${hits} · ${text.split(/\s+/).length}w`);
      if (args.includes('--show')) console.log(`    ${text.replace(/\n+/g, ' ¶ ')}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[${arm}] ${c.id} #${run} FAILED ${message.slice(0, 160)}`);
    }
  }
}));

const rate = (xs: Result[], test: (t: string) => boolean) => ({ k: xs.filter((r) => test(r.text)).length, n: xs.length });
const words = (xs: Result[]) => (xs.length ? (xs.reduce((s, r) => s + r.text.split(/\s+/).length, 0) / xs.length).toFixed(0) : '-');
console.log('\nTOTALS (↑/↓ = direction wanted)');
for (const kind of ['narration', 'planning', 'choices'] as const) {
  const ids = new Set(cases.filter((c) => c.kind === kind).map((c) => c.id));
  if (!ids.size) continue;
  const of = (arm: Arm) => results.filter((r) => r.arm === arm && ids.has(r.case));
  for (const check of CHECKS_BY_KIND[kind]) {
    const [a, b] = [rate(of('control'), CHECKS[check].test), rate(of('block'), CHECKS[check].test)];
    console.log(`${`${kind} ${check}`.padEnd(28)} ${CHECKS[check].want ? '↑' : '↓'}  control ${a.k}/${a.n} · block ${b.k}/${b.n}`);
  }
  const [da, db] = [rate(of('control'), (t) => DIALOGUE.test(t)), rate(of('block'), (t) => DIALOGUE.test(t))];
  console.log(`${`${kind} words / dialogue`.padEnd(28)}    control ${words(of('control'))}w ${da.k}/${da.n} · block ${words(of('block'))}w ${db.k}/${db.n}`);
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
