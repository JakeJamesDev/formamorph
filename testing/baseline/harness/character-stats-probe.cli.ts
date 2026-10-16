// Character stats probe — does a character act from its own condition once the character pass's identity
// block carries its stats? Sedge Landing: Bram the ferryman and Odette the eel-smoker, each set low and high
// on one stat while the other stat sits mid-range.
//
// Arms, paired by run index: `control` (the shipped identity block: name and background) and `stats` (the
// block with the character's stats field, as the narration Entities chip renders it). Every other byte is
// shared. A low case and its high twin send the same control request, so the control reads the background's
// own pull; the stats arm should move the two twins apart.
//
// A blind judge on the same endpoint reads each intent and picks which of two states it shows: the case's own
// or its twin's, or neither. The A/B order alternates by run. It never sees the arm or the stats.
//
// Checks per output:
//   own         — the judge picks the case's own state (↑)
//   twin        — the judge picks the twin's opposite state (↓)
//   numeral-leak — the intent repeats a stat value, a range or a percent (↓)
//   label-leak  — the intent names a stat label or quotes a descriptor (↓)
// Also reported per arm: mean words.
//
// Usage: npx vite-node testing/baseline/harness/character-stats-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 6] [--pool 4] [--only bram-vigor-low,...] [--dump] [--show]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defaultCharacterPrompt } from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues, entityStatsField } from '@/lib/chipValues/chipValues';
import { resolveEntityText } from '@/lib/placeholders';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import { layerValues } from '@/lib/promptValues';
import { buildCharacterUserMessage } from '@/lib/stagedPlanning';
import { migrateWorld } from '@/lib/version';
import type { Entity, Stat } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const runs = Number(argVal('--runs', '6'));
const pool = Number(argVal('--pool', '4'));
const only = argVal('--only', '');
const ARMS = ['control', 'stats'] as const;
type Arm = typeof ARMS[number];
const SEED = 515151;

const BASELINE = path.resolve('testing/baseline');
const base = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'entity-stats-chip-cases.json'), 'utf8')) as { entityStats: Record<string, Stat[]> };
const location = base.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');

const RECAP = 'Dusk settles over the landing. Mist rises off the gloamwater, and the rope ferry knocks against the jetty.';
const SCENE = 'The muddy landing at dusk. The ferryman stands by the rope ferry; the eel-smoker tends her firepit nearby.';
const CHARACTERS = {
  'ent-bram': { label: 'the ferryman', stance: 'by the rope ferry', action: 'I walk up to the ferryman and ask him to take me across the river right now.' },
  'ent-odette': { label: 'the eel-smoker', stance: 'at her firepit', action: 'I go over to the woman at the firepit and ask to buy some of her smoked eels.' },
};

type Case = {
  id: string; twin: string; entity: keyof typeof CHARACTERS; stat: string; value: number; others: Record<string, number>;
  /** The state the judge looks for, in plain words. */
  state: string;
};
const CASES: Case[] = [
  { id: 'bram-vigor-low', twin: 'bram-vigor-high', entity: 'ent-bram', stat: 'Vigor', value: 12, others: { Trust: 50 }, state: 'physically spent, with almost no energy or stamina left' },
  { id: 'bram-vigor-high', twin: 'bram-vigor-low', entity: 'ent-bram', stat: 'Vigor', value: 95, others: { Trust: 50 }, state: 'hale, full of physical energy and stamina' },
  { id: 'bram-trust-low', twin: 'bram-trust-high', entity: 'ent-bram', stat: 'Trust', value: 12, others: { Vigor: 75 }, state: 'guarded, barely trusting the player character' },
  { id: 'bram-trust-high', twin: 'bram-trust-low', entity: 'ent-bram', stat: 'Trust', value: 92, others: { Vigor: 75 }, state: 'devoted, trusting the player character deeply' },
  { id: 'odette-trust-low', twin: 'odette-trust-high', entity: 'ent-odette', stat: 'Trust', value: 8, others: { Stock: 20 }, state: 'hostile, not trusting the player character at all' },
  { id: 'odette-trust-high', twin: 'odette-trust-low', entity: 'ent-odette', stat: 'Trust', value: 90, others: { Stock: 20 }, state: 'friendly, trusting the player character' },
  { id: 'odette-stock-low', twin: 'odette-stock-high', entity: 'ent-odette', stat: 'Stock', value: 3, others: { Trust: 50 }, state: 'nearly out of smoked eels to sell' },
  { id: 'odette-stock-high', twin: 'odette-stock-low', entity: 'ent-odette', stat: 'Stock', value: 36, others: { Trust: 50 }, state: 'well stocked, with plenty of smoked eels to sell' },
];
const byId = new Map(CASES.map((c) => [c.id, c]));

const resolveOwn = (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders: [], rolls: {} });
const SYSTEM_VALUES = chipValues(authoredChipScene(base, {
  location,
  activeTraitIds: base.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
  resolveEntity: resolveOwn,
}));

/** The case's entity with its stats set to the case's values, and the Entities chip's field for it. */
function caseCharacter(c: Case): { entity: Entity; field: string } {
  const set: Record<string, number> = { ...c.others, [c.stat]: c.value };
  const stats = fixture.entityStats[c.entity].map((stat) => ({ ...stat, value: set[stat.name] ?? stat.value }));
  const world = { ...base, entities: base.entities.map((e) => (e.id === c.entity ? { ...e, stats } : e)) };
  const scene = authoredChipScene(world, { location, activeTraitIds: [], resolve: (text: string) => text, resolveEntity: resolveOwn });
  const entity = scene.entities.find((e) => e.id === c.entity);
  if (!entity) throw new Error(`No ${c.entity} in the scene.`);
  const field = entityStatsField(scene, entity);
  if (!field.includes(`${c.stat}:** ${c.value}/`)) throw new Error(`${c.id}: the field misses ${c.stat} ${c.value}.\n${field}`);
  return { entity, field };
}

function request(arm: Arm, c: Case): { system: string; user: string } {
  const { entity, field } = caseCharacter(c);
  const who = CHARACTERS[c.entity];
  return {
    system: renderPromptTemplate(defaultCharacterPrompt, layerValues(SYSTEM_VALUES, { '<CHARACTER NAME>': entity.name })),
    user: buildCharacterUserMessage({
      character: { name: entity.name, entity, stance: who.stance },
      stats: arm === 'stats' ? field : undefined,
      scene: SCENE,
      action: who.action,
      recap: RECAP,
    }),
  };
}

async function complete(body: Record<string, unknown>): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, reasoning_effort: 'none', stream: false, ...body }),
    });
    if (res.ok) {
      const json = await res.json() as { choices: Array<{ message: { content: string | null } }> };
      return json.choices[0].message.content ?? '';
    }
    if (res.status < 500 || attempt >= 2) throw new Error(`${res.status} ${await res.text()}`);
  }
}

// The character pass has no sampler pin, so on a custom endpoint it sends no temperature.
const intentOf = (req: { system: string; user: string }, seed: number) => complete({
  seed, max_tokens: 300, messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.user }],
});

type Pick = 'own' | 'twin' | 'neither';
const judge = async (c: Case, run: number, text: string): Promise<Pick> => {
  const twin = byId.get(c.twin)!;
  const ownFirst = run % 2 === 0;
  const [a, b] = ownFirst ? [c.state, twin.state] : [twin.state, c.state];
  const label = CHARACTERS[c.entity].label;
  const reply = await complete({
    temperature: 0, max_tokens: 5,
    messages: [{
      role: 'user',
      content: `Here is what ${label} in a story says they want and do this turn:\n"""${text}"""\n\nWhich state does this show ${label} in, by what they want, what they do, or how they do it?\nA) ${a}\nB) ${b}\nC) neither one shows\n\nAnswer A, B or C only.`,
    }],
  });
  const letter = reply.trim().match(/[ABC]/)?.[0];
  if (letter === 'A') return ownFirst ? 'own' : 'twin';
  if (letter === 'B') return ownFirst ? 'twin' : 'own';
  return 'neither';
};

const NUMERAL = /\b\d+\s*(\/\s*\d+|percent|%| out of)/i;
const LABEL = /\*\*|\b(Vigor|Stock)\b|\bTrust\b(?!ed|s|ing)|[("“'](Spent|Tired|Hale|Guarded|Open|Devoted|Hostile|Neutral|Friendly|Nearly out|Stocked)[)"”']/;

const cases = CASES.filter((c) => !only || only.split(',').includes(c.id));
if (args.includes('--dump')) {
  for (const c of cases) for (const arm of ARMS) console.log(`\n=== ${c.id} (${arm}) user\n${request(arm, c).user}`);
  console.log(`\n=== system (${cases[0]?.id})\n${request('stats', cases[0]).system}`);
  process.exit(0);
}

type Result = { arm: Arm; case: string; run: number; text: string; pick: Pick };
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
      const text = await intentOf(request(arm, c), SEED + run);
      const pick = await judge(c, run, text);
      results.push({ arm, case: c.id, run, text, pick });
      console.log(`[${arm}] ${c.id} #${run} ${pick} num=${NUMERAL.test(text) ? 1 : 0} label=${LABEL.test(text) ? 1 : 0} · ${text.split(/\s+/).length}w`);
      if (args.includes('--show')) console.log(`    ${text.replace(/\n+/g, ' ¶ ')}`);
    } catch (error) {
      console.log(`[${arm}] ${c.id} #${run} FAILED ${(error instanceof Error ? error.message : String(error)).slice(0, 160)}`);
    }
  }
}));

const rate = (xs: Result[], test: (r: Result) => boolean) => ({ k: xs.filter(test).length, n: xs.length });
const diffCi = (a: { k: number; n: number }, b: { k: number; n: number }) => {
  if (!a.n || !b.n) return 'n/a';
  const pa = a.k / a.n, pb = b.k / b.n;
  const se = Math.sqrt((pa * (1 - pa)) / a.n + (pb * (1 - pb)) / b.n);
  return `Δ ${(pb - pa).toFixed(2)} [${(pb - pa - 1.96 * se).toFixed(2)}, ${(pb - pa + 1.96 * se).toFixed(2)}]`;
};
const CHECKS: Array<[string, '↑' | '↓', (r: Result) => boolean]> = [
  ['own', '↑', (r) => r.pick === 'own'],
  ['twin', '↓', (r) => r.pick === 'twin'],
  ['numeral-leak', '↓', (r) => NUMERAL.test(r.text)],
  ['label-leak', '↓', (r) => LABEL.test(r.text)],
];
const line = (label: string, want: string, b: { k: number; n: number }, a: { k: number; n: number }) =>
  console.log(`${label.padEnd(32)} ${want}  control ${b.k}/${b.n} · stats ${a.k}/${a.n}  ${diffCi(b, a)}`);

console.log('\nTOTALS (Δ = stats − control, 95% CI)');
for (const c of cases) {
  const of = (arm: Arm) => results.filter((r) => r.case === c.id && r.arm === arm);
  for (const [check, want, test] of CHECKS) line(`${c.id} ${check}`, want, rate(of('control'), test), rate(of('stats'), test));
  const words = (arm: Arm) => { const xs = of(arm); return xs.length ? (xs.reduce((s, r) => s + r.text.split(/\s+/).length, 0) / xs.length).toFixed(0) : '-'; };
  console.log(`${`${c.id} words`.padEnd(32)}    control ${words('control')}w · stats ${words('stats')}w`);
}
const all = (arm: Arm) => results.filter((r) => r.arm === arm && cases.some((c) => c.id === r.case));
for (const [check, want, test] of CHECKS) line(`ALL ${check}`, want, rate(all('control'), test), rate(all('stats'), test));
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
