// Relationship probe — does a relationship make an absent relative known without putting them in the scene?
// Sedge Landing, plus Ida, who lives in the hamlet and is Known In Nowhere. Her summary never names Bram.
//
// Arms, paired by run index, on the shipped prompts: `off` (Ida exists, no relationship, so no roster lists
// her) and `on` (Bram holds Ida as his daughter, so she joins the known roster and his block reads the line).
//
// Checks:
//   uptake        — the output names Ida (up on ask cases)
//   relation      — the output names Ida as Bram's own: daughter, girl, or "my Ida" (up on ask cases)
//   mention       — the output names Ida at all (noise guard on neutral cases)
//   present-judge — the model's own yes/no: is the daughter in the scene? (guard, down). The cloud model says no
//                   to passages where she speaks, so hand-grade from `--out` before trusting it.
//   cast-leak     — the planner's Cast lists Ida or a daughter (guard, down)
//
// Usage: npx vite-node testing/baseline/harness/relationship-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 8] [--max 600] [--only narr-ask] [--pool 4] [--out f.json] [--dump] [--show]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defaultSystemPrompt, defaultThinkingPrompt } from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { resolveEntityText } from '@/lib/placeholders';
import { PROMPT_SAMPLER_PINS } from '@/lib/promptSamplers';
import { renderPromptTemplate } from '@/lib/promptTemplate';
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
const ARMS = ['off', 'on'] as const;
type Arm = typeof ARMS[number];
const SEED = 515151;

const base = migrateWorld(JSON.parse(readFileSync(path.resolve('testing/baseline/sedge-landing.json'), 'utf8')));
const ida: Entity = {
  id: 'ent-ida', name: 'Ida', knownIn: 'nowhere',
  aiDescription: 'A sharp young woman who keeps the crossing ledger in the hamlet. She counts every copper twice and means to leave for the city once the ledger balances.',
  aiSummary: 'Keeps the crossing ledger in the hamlet and counts every copper twice.',
};
const location = base.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');

const ctxFor = (arm: Arm) => {
  const entities = [...base.entities, ida].map((e) => (
    arm === 'on' && e.id === 'ent-bram' ? { ...e, relationships: [{ targetId: 'ent-ida', label: 'daughter' }] } : e
  ));
  const world = { ...base, entities };
  return chipValues(authoredChipScene(world, {
    location,
    activeTraitIds: base.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
    resolve: (text: string) => text,
    resolveEntity: (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders: [], rolls: {} }),
  }));
};
const ctx = { off: ctxFor('off'), on: ctxFor('on') };
const KNOWN = '<ENTITIES|known.summary.markdown>';
if (ctx.off(KNOWN)?.includes('Ida')) throw new Error('The off arm lists Ida.');
if (!ctx.on(KNOWN)?.includes('Ida') || !ctx.on('<ENTITIES|markdown>')?.includes("Ida is Bram's daughter")) {
  throw new Error('The on arm does not pull Ida in or print the line.');
}

type Case = { id: string; kind: 'narration' | 'planning'; action: string; checks: string[] };
const CASES: Case[] = [
  { id: 'narr-ask', kind: 'narration', action: 'I ask the ferryman whether he has any family.', checks: ['uptake', 'relation', 'present-judge'] },
  { id: 'narr-ledger', kind: 'narration', action: 'I ask the ferryman who keeps the crossing ledger.', checks: ['uptake', 'relation', 'present-judge'] },
  { id: 'narr-neutral', kind: 'narration', action: 'I sit on the end of the dock and watch the water.', checks: ['mention', 'present-judge'] },
  // A deliberate positive trigger for the leak: the player seeks the daughter as if she were here.
  { id: 'narr-address', kind: 'narration', action: "I ask the ferryman's daughter about the toll ledger.", checks: ['present-judge'] },
  { id: 'plan-ask', kind: 'planning', action: 'I ask the ferryman whether he has any family.', checks: ['uptake', 'cast-leak'] },
];

const IDA = /\bIda\b/;
const castLines = (text: string) => {
  const at = text.search(/^Cast:/m);
  return at < 0 ? [] : text.slice(at).split('\n').slice(1).filter((line) => /^\s*-/.test(line));
};
type Result = { arm: Arm; case: string; run: number; text: string; judged?: boolean };
const CHECKS: Record<string, { test: (r: Result) => boolean; want: boolean }> = {
  uptake: { test: ({ text }) => IDA.test(text), want: true },
  relation: { test: ({ text }) => IDA.test(text) && /\b(daughter|girl|my Ida)\b/i.test(text), want: true },
  mention: { test: ({ text }) => IDA.test(text), want: false },
  'present-judge': { test: (r) => r.judged === true, want: false },
  'cast-leak': { test: ({ text }) => castLines(text).some((line) => IDA.test(line) || /\bdaughter\b/i.test(line)), want: false },
};

type Request = { system: string; user: string; temperature?: number; repetitionPenalty?: number; max?: number };
function request(arm: Arm, c: Case): Request {
  if (c.kind === 'planning') {
    // The precall planner's own request, with its sampler pins.
    return {
      system: renderPromptTemplate(defaultThinkingPrompt, ctx[arm]),
      user: `The player's next action: ${c.action}\n\nList the cast and lay out the beats now. Do not narrate.`,
      ...PROMPT_SAMPLER_PINS.thinking,
    };
  }
  const system = buildNarrationPrompt({
    template: defaultSystemPrompt, ctx: ctx[arm], action: c.action, history: [], dictionary: [],
    actionVec: null, semanticLore: false, embedVectors: new Map(),
    language: 'English', paragraphLimit: 'single', maxTokens: 1024, markdownOutput: false,
    sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
  return { system, user: c.action };
}

async function complete(model: string, req: Request, seed: number): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, seed, max_tokens: req.max ?? maxTokens, reasoning_effort: 'none', stream: false,
        // Narration is unpinned, so it sends no temperature; the planner sends its pin.
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        ...(req.repetitionPenalty !== undefined ? { repetition_penalty: req.repetitionPenalty } : {}),
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

/** The model's own reading of whether Ida, or a daughter like her, is in the scene of `text`, at temperature 0. */
async function judgePresent(model: string, text: string): Promise<boolean> {
  const answer = await complete(model, {
    system: 'You read one passage of a story and answer one question about it with one word: yes or no.',
    user: `Passage:\n${text}\n\nQuestion: In this passage, is Ida, the ferryman's daughter and keeper of the crossing ledger, in the scene with the player - there in person, seen, acting, or speaking? Anyone of that description counts, named or not. One who is only spoken of, remembered, or absent is not in the scene. Answer yes or no.`,
    temperature: 0, max: 5,
  }, 1);
  return /^\W*yes/i.test(answer);
}

const cases = CASES.filter((c) => !only || only.split(',').includes(c.id));
if (args.includes('--dump')) {
  for (const arm of ARMS) console.log(`--- ${arm}: known roster\n${ctx[arm](KNOWN)}\n--- ${arm}: here\n${ctx[arm]('<ENTITIES|markdown>')}`);
  process.exit(0);
}

const results: Result[] = [];
const started = Date.now();
const model = argVal('--model', 'default');
console.log(`model ${model} · runs ${runs} per arm per case · pool ${pool}`);
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
if (outPath) writeFileSync(outPath, JSON.stringify({ model, runs, results }, null, 2));
const rate = (xs: Result[], test: (r: Result) => boolean) => ({ k: xs.filter(test).length, n: xs.length });
console.log('\nTOTALS (↑/↓ = direction wanted)');
for (const c of cases) {
  const of = (arm: Arm) => results.filter((r) => r.case === c.id && r.arm === arm);
  for (const check of c.checks) {
    const [a, b] = [rate(of('off'), CHECKS[check].test), rate(of('on'), CHECKS[check].test)];
    console.log(`${`${c.id} ${check}`.padEnd(28)} ${CHECKS[check].want ? '↑' : '↓'}  off ${a.k}/${a.n} · on ${b.k}/${b.n}`);
  }
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
