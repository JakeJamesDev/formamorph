// Known roster probe — what changes when the default prompts carry <ENTITIES|known>? Sedge Landing, plus Reeve
// Ashcombe, who stands in the Eelhouse and is Known In the landing and the hamlet, so at the landing she reaches
// the AI in the known roster only.
//
// `experimental` cases run the Experimental preset's narration prompt.
//
// Arms, paired by run index: `old` (the prompt without the known chip: the shipped prompt) and `new` (with it).
// Every other byte is shared. With `--base <dir>`, `old` instead reads the prompts in that directory (a
// snapshot of GamePrompts.ts and ExperimentalPrompts.ts, say from `git show HEAD:...`) and `new` reads the
// working tree, so the probe scores a prompt edit against the prompt it replaces.
//
// Checks:
//   uptake       — the output carries a fact from the reeve's summary: the weirs, the seizure, the copper (up on ask cases)
//   mention      — the output names the reeve at all (noise guard on neutral cases, down)
//   present-leak — the narration puts the reeve in the scene, acting or speaking, by regex (guard, down)
//   present-judge — the same question put to the model, one yes/no per output (guard, down)
//   cast-leak    — the planner's or director's Cast lists the reeve (guard, down)
//   address-leak — a choice speaks to the reeve as if she were here (guard, down)
//   contract     — 3 to 5 option lines, each one "I ..." clause of at most 25 words (choices guard, up)
//
// Usage: npx vite-node testing/baseline/harness/known-roster-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 8] [--max 600] [--only narr-ask,plan-ask] [--pool 4]
//          [--base DIR] [--out results.json] [--dump] [--show]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { experimentalSystemPrompt } from '@/components/game/ExperimentalPrompts';
import {
  activeCharacterGuidance, defaultChoicesPrompt, defaultChoicesUserPrompt, defaultDirectorPrompt,
  defaultDirectorUserPrompt, defaultSystemPrompt, defaultThinkingPrompt,
} from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues, sceneEntityChipValues } from '@/lib/chipValues/chipValues';
import { resolveEntityText } from '@/lib/placeholders';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import { layerValues } from '@/lib/promptValues';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { migrateWorld } from '@/lib/version';
import type { Entity } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const runs = Number(argVal('--runs', '8'));
const maxTokens = Number(argVal('--max', '600'));
const pool = Number(argVal('--pool', '4'));
const only = argVal('--only', '');
const baseDir = argVal('--base', '');
const ARMS = ['old', 'new'] as const;
type Arm = typeof ARMS[number];
const SEED = 727272;
// Each preset words the known chip its own way; the chip is the only `<ENTITIES|known.` token a prompt holds.
const KNOWN_CHIP = /<ENTITIES\|known\.[^>]*>/;

/** The system prompts a probed arm reads. */
type Prompts = { system: string; experimental: string; thinking: string; director: string; choices: string };
const current: Prompts = {
  system: defaultSystemPrompt, experimental: experimentalSystemPrompt, thinking: defaultThinkingPrompt,
  director: defaultDirectorPrompt, choices: defaultChoicesPrompt,
};
async function loadBase(dir: string): Promise<Prompts> {
  const load = (file: string) => import(pathToFileURL(path.resolve(dir, file)).href) as Promise<Record<string, string>>;
  const game = await load('GamePrompts.ts');
  const experimental = await load('ExperimentalPrompts.ts');
  const prompts = {
    system: game.defaultSystemPrompt, experimental: experimental.experimentalSystemPrompt, thinking: game.defaultThinkingPrompt,
    director: game.defaultDirectorPrompt, choices: game.defaultChoicesPrompt,
  };
  for (const [key, text] of Object.entries(prompts)) if (typeof text !== 'string') throw new Error(`The base snapshot lacks the ${key} prompt.`);
  return prompts;
}
const basePrompts = baseDir ? await loadBase(baseDir) : null;

const BASELINE = path.resolve('testing/baseline');
const base = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'known-roster-cases.json'), 'utf8')) as {
  known: Entity;
  cases: Array<{ id: string; kind: 'narration' | 'experimental' | 'planning' | 'director' | 'choices'; action?: string; narration?: string; scene?: string[]; checks: string[] }>;
};

const world = { ...base, entities: [...base.entities, fixture.known] };
const location = world.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');
const scene = authoredChipScene(world, {
  location,
  activeTraitIds: base.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
  resolveEntity: (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders: [], rolls: {} }),
});
const ctx = chipValues(scene);
if (!ctx('<ENTITIES|known.summary.markdown>')?.includes('Reeve Ashcombe')) throw new Error('The known roster does not list the reeve.');

/** The template each arm sends. Without a base, `old` drops the known chip, which leaves the shipped prompt
 *  byte for byte; with one, `old` is the base snapshot's prompt as it stands. */
const template = (arm: Arm, key: keyof Prompts) => {
  const text = current[key];
  if (!KNOWN_CHIP.test(text)) throw new Error('A probed prompt lacks the known chip.');
  if (arm === 'new') return text;
  return basePrompts ? basePrompts[key] : text.replace(KNOWN_CHIP, '');
};

const REEVE = /\b(Ashcombe|reeve)\b/i;
const ACTS = /\b(step|walk|arriv|enter|stand|stood|approach|appear|sit|sat|says?|said|nod|turn|smil|watch|call|speak|spoke|glanc|lean)\w*/i;
const castLines = (text: string) => {
  const at = text.search(/^Cast:/m);
  if (at < 0) return [];
  return text.slice(at).split('\n').slice(1).filter((line) => /^\s*-/.test(line));
};
const contract = (text: string) => {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length >= 3 && lines.length <= 5 && lines.every((l) => /^I\b/.test(l) && l.split(/\s+/).length <= 25);
};
type Result = { arm: Arm; case: string; run: number; text: string; judged?: boolean };
const CHECKS: Record<string, { test: (r: Result) => boolean; want: boolean }> = {
  // Facts only her summary carries, so an echo of the action's words never scores.
  uptake: { test: ({ text: t }) => /\b(weirs?|coppers?|seiz\w*)\b/i.test(t), want: true },
  mention: { test: ({ text: t }) => REEVE.test(t), want: false },
  // The reeve as the subject of a physical or spoken act within the same clause.
  'present-leak': { test: ({ text: t }) => t.split(/[.!?\n]/).some((s) => REEVE.test(s) && ACTS.test(s.slice(s.search(REEVE)))), want: false },
  // The model's own reading of the passage; see judgePresent.
  'present-judge': { test: (r) => r.judged === true, want: false },
  'cast-leak': { test: ({ text: t }) => castLines(t).some((line) => REEVE.test(line)), want: false },
  'address-leak': { test: ({ text: t }) => /\bI\b[^\n]{0,30}\b(ask|tell|greet|approach|bow|speak|turn)\w*\s+(to\s+)?(the\s+reeve|Reeve Ashcombe|Ashcombe)\b/i.test(t), want: false },
  contract: { test: ({ text }) => contract(text), want: true },
};
const DIALOGUE = /["“][^"”]{3,}["”]/;

type Case = typeof fixture.cases[number];
function request(arm: Arm, c: Case): { system: string; user: string; temperature?: number; max?: number } {
  if (c.kind === 'planning') {
    // The precall planner's own request: pinned temp 0.4 / rep-pen 1, the action framed as one instruction.
    return {
      system: renderPromptTemplate(template(arm, 'thinking'), ctx),
      user: `The player's next action: ${c.action}\n\nList the cast and lay out the beats now. Do not narrate.`,
      temperature: 0.4,
    };
  }
  if (c.kind === 'director') {
    const values = layerValues(ctx, { '<ACTIVE CHARACTER GUIDANCE>': activeCharacterGuidance(false, 3) });
    return {
      system: renderPromptTemplate(template(arm, 'director'), values),
      user: renderPromptTemplate(defaultDirectorUserPrompt, layerValues(values, { '<NARRATION>': '', '<PLAYER ACTION>': c.action ?? '' })),
      max: 300,
    };
  }
  if (c.kind === 'choices') {
    // The choice writer reads only who is in the scene, through the scene-roster override.
    const values = layerValues(ctx, sceneEntityChipValues(scene, (c.scene ?? []).map((name) => world.entities.find((e) => e.name === name)!.id)), { '<LANGUAGE>': '' });
    return {
      system: renderPromptTemplate(template(arm, 'choices'), values),
      user: renderPromptTemplate(defaultChoicesUserPrompt, layerValues(values, { '<NARRATION>': c.narration ?? '' })),
      max: 220,
    };
  }
  const system = buildNarrationPrompt({
    template: template(arm, c.kind === 'experimental' ? 'experimental' : 'system'), ctx, action: c.action ?? '', history: [], dictionary: [],
    actionVec: null, semanticLore: false, embedVectors: new Map(),
    language: 'English', paragraphLimit: 'single', maxTokens: 1024, markdownOutput: false,
    sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
  return { system, user: c.action ?? '' };
}

async function complete(model: string, req: ReturnType<typeof request>, seed: number): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, seed, max_tokens: req.max ?? maxTokens, reasoning_effort: 'none', stream: false,
        // Narration, choices and the director are unpinned, so they send no temperature; the planner sends its pin.
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

/** The model's own reading of whether the reeve is in the scene of `text`, as one yes/no at temperature 0.
 *  The regex scorer misses a reeve who "is already there, idly tapping" and flags one "out of sight" when a
 *  later word starts with "sit", so judged cases carry this check beside it. */
async function judgePresent(model: string, text: string): Promise<boolean> {
  const answer = await complete(model, {
    system: 'You read one passage of a story and answer one question about it with one word: yes or no.',
    user: `Passage:\n${text}\n\nQuestion: In this passage, is the river-reeve (Reeve Ashcombe) in the scene with the player - there in person, seen, acting, or speaking? A reeve who is only spoken of, remembered, or absent is not in the scene. Answer yes or no.`,
    temperature: 0, max: 5,
  }, 1);
  return /^\W*yes/i.test(answer);
}

const cases = fixture.cases.filter((c) => !only || only.split(',').includes(c.id));
if (args.includes('--dump')) {
  console.log(`--- known roster\n${ctx('<ENTITIES|known.summary.markdown>')}`);
  for (const c of cases) for (const arm of ARMS) console.log(`\n=== ${c.id} (${arm})\n${JSON.stringify(request(arm, c), null, 2).slice(0, 8000)}`);
  process.exit(0);
}

const results: Result[] = [];
const started = Date.now();
const model = argVal('--model', 'default');
console.log(`model ${model} · runs ${runs} per arm per case · pool ${pool}${basePrompts ? ` · old = ${baseDir}` : ''}`);
// Arms interleave run by run, so drift during the batch lands on both.
const jobs = cases.flatMap((c) => Array.from({ length: runs }, (_, run) => ARMS.map((arm) => ({ arm, c, run })))).flat();
let next = 0;
await Promise.all(Array.from({ length: pool }, async () => {
  while (next < jobs.length) {
    const { arm, c, run } = jobs[next++];
    try {
      const text = await complete(model, request(arm, c), SEED + run);
      const result: Result = { arm, case: c.id, run, text };
      if (c.checks.includes('present-judge')) result.judged = await judgePresent(model, text);
      results.push(result);
      const hits = c.checks.map((check) => `${check}=${CHECKS[check].test(result) ? 1 : 0}`).join(' ');
      console.log(`[${arm}] ${c.id} #${run} ${hits} · ${text.split(/\s+/).length}w`);
      if (args.includes('--show')) console.log(`    ${text.replace(/\n+/g, ' ¶ ')}`);
    } catch (error) {
      console.log(`[${arm}] ${c.id} #${run} FAILED ${(error instanceof Error ? error.message : String(error)).slice(0, 160)}`);
    }
  }
}));

const outPath = argVal('--out', '');
if (outPath) writeFileSync(outPath, JSON.stringify({ model, runs, base: baseDir || null, results }, null, 2));
const rate = (xs: Result[], test: (r: Result) => boolean) => ({ k: xs.filter(test).length, n: xs.length });
const diffCi = (a: { k: number; n: number }, b: { k: number; n: number }) => {
  if (!a.n || !b.n) return 'n/a';
  const pa = a.k / a.n, pb = b.k / b.n;
  const se = Math.sqrt((pa * (1 - pa)) / a.n + (pb * (1 - pb)) / b.n);
  return `Δ ${(pb - pa).toFixed(2)} [${(pb - pa - 1.96 * se).toFixed(2)}, ${(pb - pa + 1.96 * se).toFixed(2)}]`;
};

console.log('\nTOTALS (↑/↓ = direction wanted; Δ = new − old, 95% CI)');
for (const c of cases) {
  const of = (arm: Arm) => results.filter((r) => r.case === c.id && r.arm === arm);
  for (const check of c.checks) {
    const [b, a] = [rate(of('old'), CHECKS[check].test), rate(of('new'), CHECKS[check].test)];
    console.log(`${`${c.id} ${check}`.padEnd(28)} ${CHECKS[check].want ? '↑' : '↓'}  old ${b.k}/${b.n} · new ${a.k}/${a.n}  ${diffCi(b, a)}`);
  }
  const words = (arm: Arm) => { const xs = of(arm); return xs.length ? (xs.reduce((s, r) => s + r.text.split(/\s+/).length, 0) / xs.length).toFixed(0) : '-'; };
  const [db, da] = [rate(of('old'), (r) => DIALOGUE.test(r.text)), rate(of('new'), (r) => DIALOGUE.test(r.text))];
  console.log(`${`${c.id} words / dialogue`.padEnd(28)}    old ${words('old')}w ${db.k}/${db.n} · new ${words('new')}w ${da.k}/${da.n}`);
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
