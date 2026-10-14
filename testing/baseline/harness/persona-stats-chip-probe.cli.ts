// Persona stats chip probe — what changes when the Persona block carries the played entity's stats? Sedge
// Landing under None, so the Custom Persona entity plays and its stats are the persona's (Q11): Calm low, and a
// Resolve that clashes with the global Resolve and so reads as "Resolve (2)". Three prompts read the block with
// stats: narration, the storyboard planner and the choice writer. The precall planner reads it without stats;
// `--dump` shows its bodies are the same in both arms.
//
// Arms, paired by run index: `off` (the Custom Persona entity holds no stats) and `on` (its stats in the Persona
// block). The entity stats of entity-stats-chip-cases.json ride in both. Every other byte is shared.
//
// Checks:
//   rattled       — the output shows the player shaken or wavering (uptake, up in `on`)
//   numbered-name — the output writes a numbered stat name such as "Resolve (2)" (guard, down)
//   numeral-leak  — the output repeats a stat value, a range or a percent (guard, down)
//   label-leak    — the output repeats a stat label such as "Calm:" or "**Resolve**" (guard, down)
//   contract      — 3 to 5 option lines, each one "I ..." clause of at most 25 words (choices guard, up)
// Also reported per arm: mean words and the share of outputs with quoted dialogue (regression check).
//
// Usage: npx vite-node testing/baseline/harness/persona-stats-chip-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 12] [--max 600] [--only narr-bram,plan-odette] [--pool 4]
//          [--dump] [--show]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  defaultChoicesPrompt, defaultChoicesUserPrompt, defaultStoryboardPrompt, defaultSystemPrompt, defaultThinkingPrompt,
} from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues, sceneEntityChipValues } from '@/lib/chipValues/chipValues';
import { allSpelledTokens } from '@/test/chipTokens';
import { PLAYER_NAME_HEADER_KEY } from '@/lib/builtinPlaceholders';
import { resolveEntityText } from '@/lib/placeholders';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import { layerValues } from '@/lib/promptValues';
import { buildStoryboardUserMessage } from '@/lib/stagedPlanning';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { migrateWorld } from '@/lib/version';
import type { Entity, Stat } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'http://127.0.0.1:1234/v1/chat/completions');
const runs = Number(argVal('--runs', '12'));
const maxTokens = Number(argVal('--max', '600'));
const pool = Number(argVal('--pool', '4'));
const only = argVal('--only', '');
const ARMS = ['off', 'on'] as const;
const SEED = 727272;

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

const resolveOwn = (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders: [], rolls: {} });
const location = base.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');
const you: Entity = { id: 'ent-you', name: 'You', customPersona: true, stats: fixture.personaStats };
const cast = base.entities.map((e) => (entityFixture.entityStats[e.id] ? { ...e, stats: entityFixture.entityStats[e.id] } : e));
const sceneOf = (entities: Entity[]) => authoredChipScene({ ...base, entities }, {
  location,
  activeTraitIds: base.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
  resolveEntity: resolveOwn,
});
const sceneOn = sceneOf([...cast, you]);
if (!sceneOn.playedStats?.some((part) => part.stats.length)) throw new Error('The scene holds no persona stats.');
const SCENES = { on: sceneOn, off: { ...sceneOn, playedStats: [] } };
const CTX = { on: chipValues(SCENES.on), off: chipValues(SCENES.off) };
// The off arm is the same world with a Custom Persona entity that holds no stats.
const before = chipValues(sceneOf([...cast, { ...you, stats: [] }]));
for (const token of [...allSpelledTokens(), PLAYER_NAME_HEADER_KEY]) {
  if (CTX.off(token) !== before(token)) throw new Error(`The off arm differs from the shipped chip at ${token}.`);
}

const STAT_LABELS = ['Vigor', 'Resolve', 'Calm', 'Trust', 'Stock'];
const contract = (text: string) => {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length >= 3 && lines.length <= 5 && lines.every((l) => /^I\b/.test(l) && l.split(/\s+/).length <= 25);
};
const CHECKS: Record<string, { test: (text: string) => boolean; want: boolean }> = {
  rattled: { test: (t) => /\b(shak\w*|trembl\w*|nervous\w*|jitter\w*|rattled|unsteady|uneas\w*|anxi\w*|on edge|hesita\w*|swallow\w*|clammy|falter\w*|waver\w*|doubt\w*|fear\w*|afraid|dread\w*|tight (chest|throat)|heart (pound\w*|hammer\w*|race\w*|thud\w*)|pulse|steady (yourself|your (hands?|voice|nerves?|breath)))\b/i.test(t), want: true },
  'numbered-name': { test: (t) => /\b[A-Za-z][\w'-]*\s*\(\d+\)/.test(t), want: false },
  contract: { test: contract, want: true },
  'numeral-leak': { test: (t) => /\b\d+\s*(\/\s*\d+|percent|%| out of)/i.test(t) || /\b(vigor|resolve|calm|trust|stock)\b[^.\n]{0,12}\b\d+\b/i.test(t), want: false },
  'label-leak': { test: (t) => STAT_LABELS.some((l) => new RegExp(`\\*\\*${l}\\*\\*|\\b${l}:`).test(t)), want: false },
};
const DIALOGUE = /["“][^"”]{3,}["”]/;

function request(arm: typeof ARMS[number], c: Case): { system: string; user: string; temperature?: number; max?: number } {
  const ctx = CTX[arm];
  if (c.kind === 'planning') {
    // The storyboard planner: unpinned, the reconciled scene and intents as its user turn.
    return {
      system: renderPromptTemplate(defaultStoryboardPrompt, ctx),
      user: buildStoryboardUserMessage({
        recap: '', scene: typeof c.scene === 'string' ? c.scene : '', intents: c.intents ?? [], overflow: [], action: c.action ?? '',
      }),
    };
  }
  if (c.kind === 'choices') {
    // The choice writer reads only who is in the scene, through the scene-roster override.
    const values = layerValues(ctx, sceneEntityChipValues(SCENES[arm], Array.isArray(c.scene) ? c.scene : []), { '<LANGUAGE>': '' });
    return {
      system: renderPromptTemplate(defaultChoicesPrompt, values),
      user: renderPromptTemplate(defaultChoicesUserPrompt, layerValues(values, { '<NARRATION>': c.narration ?? '' })),
      max: 220,
    };
  }
  const system = buildNarrationPrompt({
    template: defaultSystemPrompt, ctx, action: c.action ?? '', history: [], dictionary: [],
    actionVec: null, semanticLore: false, embedVectors: new Map(),
    language: 'English', paragraphLimit: 'single', maxTokens: 1024, markdownOutput: false,
    sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
  return { system, user: c.action ?? '' };
}

async function loadedModel(): Promise<string> {
  const explicit = argVal('--model', '');
  if (explicit) return explicit;
  const res = await fetch(new URL('/api/v0/models', endpoint));
  const { data } = await res.json() as { data: Array<{ id: string; state?: string; type?: string }> };
  const loaded = data.find((m) => m.state === 'loaded' && m.type === 'llm');
  if (!loaded) throw new Error('No LLM is loaded; pass --model.');
  return loaded.id;
}

async function complete(model: string, req: ReturnType<typeof request>, seed: number): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, seed, max_tokens: req.max ?? maxTokens, reasoning_effort: 'none', stream: false,
        // Narration, choices and the storyboard are unpinned, so they send no temperature.
        ...(req.temperature !== undefined ? { temperature: req.temperature, repetition_penalty: 1 } : {}),
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
  for (const arm of ARMS) console.log(`\n--- ${arm}: Persona block\n${CTX[arm]('<PERSONA|markdown>')}`);
  const precall = ARMS.map((arm) => renderPromptTemplate(defaultThinkingPrompt, CTX[arm]));
  console.log(`\nprecall planner bodies identical across arms: ${precall[0] === precall[1]}`);
  for (const c of cases) console.log(`\n=== ${c.id} (on)\n${JSON.stringify(request('on', c), null, 2).slice(0, 6000)}`);
  process.exit(0);
}

type Result = { arm: typeof ARMS[number]; case: string; run: number; text: string };
const results: Result[] = [];
const started = Date.now();
const model = await loadedModel();
console.log(`model ${model} · runs ${runs} per arm per case · pool ${pool}`);
// Arms interleave run by run, so drift during the batch lands on both.
const jobs = cases.flatMap((c) => Array.from({ length: runs }, (_, run) => ARMS.map((arm) => ({ arm, c, run })))).flat();
let next = 0;
await Promise.all(Array.from({ length: pool }, async () => {
  while (next < jobs.length) {
    const { arm, c, run } = jobs[next++];
    try {
      const text = await complete(model, request(arm, c), SEED + run);
      results.push({ arm, case: c.id, run, text });
      const hits = c.checks.map((check) => `${check}=${CHECKS[check].test(text) ? 1 : 0}`).join(' ');
      console.log(`[${arm}] ${c.id} #${run} ${hits} · ${text.split(/\s+/).length}w`);
      if (args.includes('--show')) console.log(`    ${text.replace(/\n+/g, ' ¶ ')}`);
    } catch (error) {
      console.log(`[${arm}] ${c.id} #${run} FAILED ${(error as Error).message.slice(0, 160)}`);
    }
  }
}));

const rate = (xs: Result[], test: (t: string) => boolean) => ({ k: xs.filter((r) => test(r.text)).length, n: xs.length });
const diffCi = (a: { k: number; n: number }, b: { k: number; n: number }) => {
  if (!a.n || !b.n) return 'n/a';
  const pa = a.k / a.n, pb = b.k / b.n;
  const se = Math.sqrt((pa * (1 - pa)) / a.n + (pb * (1 - pb)) / b.n);
  return `Δ ${(pb - pa).toFixed(2)} [${(pb - pa - 1.96 * se).toFixed(2)}, ${(pb - pa + 1.96 * se).toFixed(2)}]`;
};

console.log('\nTOTALS (↑/↓ = direction wanted; Δ = on − off, 95% CI)');
for (const c of cases) {
  const of = (arm: string) => results.filter((r) => r.case === c.id && r.arm === arm);
  for (const check of c.checks) {
    const [b, a] = [rate(of('off'), CHECKS[check].test), rate(of('on'), CHECKS[check].test)];
    console.log(`${`${c.id} ${check}`.padEnd(28)} ${CHECKS[check].want ? '↑' : '↓'}  off ${b.k}/${b.n} · on ${a.k}/${a.n}  ${diffCi(b, a)}`);
  }
  const words = (arm: string) => { const xs = of(arm); return xs.length ? (xs.reduce((s, r) => s + r.text.split(/\s+/).length, 0) / xs.length).toFixed(0) : '-'; };
  const [db, da] = [rate(of('off'), (t) => DIALOGUE.test(t)), rate(of('on'), (t) => DIALOGUE.test(t))];
  console.log(`${`${c.id} words / dialogue`.padEnd(28)}    off ${words('off')}w ${db.k}/${db.n} · on ${words('on')}w ${da.k}/${da.n}`);
}
console.log('\nPOOLED by check');
for (const check of Object.keys(CHECKS)) {
  const xs = results.filter((r) => fixture.cases.find((c) => c.id === r.case)?.checks.includes(check));
  if (!xs.length) continue;
  const [b, a] = [rate(xs.filter((r) => r.arm === 'off'), CHECKS[check].test), rate(xs.filter((r) => r.arm === 'on'), CHECKS[check].test)];
  console.log(`${check.padEnd(16)} ${CHECKS[check].want ? '↑' : '↓'}  off ${b.k}/${b.n} · on ${a.k}/${a.n}  ${diffCi(b, a)}`);
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
