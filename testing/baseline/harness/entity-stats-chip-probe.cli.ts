// Entity stats chip probe — what changes when the Entities chip carries each present entity's stats?
// Sedge Landing, with Bram worn out and guarded and Odette nearly out of eels and hostile, in the three
// prompts that read the chip: narration, the planner and the choice writer.
//
// Arms, paired by run index: `off` (the stats piece switched off: the chip as it was) and `on` (the piece on,
// the default). Every other byte is shared.
//
// Checks:
//   bram-worn / bram-guarded / odette-low-stock / odette-hostile — the stat shows in the output (uptake, up in `on`)
//   bram-care   — a choice that meets Bram's state (uptake, up)
//   contract    — 3 to 5 option lines, each one "I ..." clause of at most 25 words (choices guard, up)
//   numeral-leak — the output repeats a stat value, a range or a percent (guard, down)
//   label-leak  — the output repeats a stat label such as "Trust:" or "**Vigor**" (guard, down)
//   name-leak   — the output names Bram or Odette, who have not given their names (guard, down)
// Also reported per arm: mean words and the share of outputs with quoted dialogue (regression check).
//
// Usage: npx vite-node testing/baseline/harness/entity-stats-chip-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 12] [--max 600] [--only narr-bram,plan-odette] [--pool 4]
//          [--dump] [--show]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  defaultChoicesPrompt, defaultChoicesUserPrompt, defaultSystemPrompt, defaultThinkingPrompt,
} from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues, sceneEntityChipValues } from '@/lib/chipValues/chipValues';
import { resolveEntityText } from '@/lib/placeholders';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import { layerValues } from '@/lib/promptValues';
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
const SEED = 616161;

const BASELINE = path.resolve('testing/baseline');
const base = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'entity-stats-chip-cases.json'), 'utf8')) as {
  entityStats: Record<string, Stat[]>;
  cases: Array<{ id: string; kind: 'narration' | 'planning' | 'choices'; action?: string; narration?: string; scene?: string[]; checks: string[] }>;
};

const resolveOwn = (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders: [], rolls: {} });
const location = base.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');
const world = { ...base, entities: base.entities.map((e) => (fixture.entityStats[e.id] ? { ...e, stats: fixture.entityStats[e.id] } : e)) };
const sceneBase = authoredChipScene(world, {
  location,
  activeTraitIds: base.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
  resolveEntity: resolveOwn,
});
if (!Object.keys(sceneBase.ownedStats ?? {}).length) throw new Error('The scene holds no entity stats.');
const SCENES = { on: sceneBase, off: { ...sceneBase, ownedStats: {} } };
const CTX = { on: chipValues(SCENES.on), off: chipValues(SCENES.off) };

const STAT_LABELS = ['Vigor', 'Trust', 'Stock'];
const contract = (text: string) => {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length >= 3 && lines.length <= 5 && lines.every((l) => /^I\b/.test(l) && l.split(/\s+/).length <= 25);
};
const CHECKS: Record<string, { test: (text: string) => boolean; want: boolean }> = {
  'bram-worn': { test: (t) => /\b(tired|weary|weariness|exhaust\w*|spent|drained|haggard|slump\w*|wheez\w*|ragged breath|labou?red breath|heavy breath\w*|winded|gaunt|grey-faced|fatigue\w*|bone-tired|sagg\w*)\b/i.test(t), want: true },
  'bram-guarded': { test: (t) => /\b(wary|warily|guard\w*|suspicio\w*|distrust\w*|cautious\w*|reserved|curt|terse|hesitat\w*|reluctan\w*|cold\w*|short nod|does not meet|doesn't meet|avoids? (your|my) (eyes?|gaze))\b/i.test(t), want: true },
  'odette-low-stock': { test: (t) => /\b(few|sparse|nearly empty|almost empty|last|handful|bare|thin|scant|picked over|two eels|three eels|dwindl\w*|running low|ran low)\b/i.test(t), want: true },
  'odette-hostile': { test: (t) => /\b(hostile|glar\w*|scowl\w*|cold\w*|curt|terse|wary|warily|suspicio\w*|distrust\w*|unfriendly|snap\w*)\b/i.test(t), want: true },
  'bram-care': { test: (t) => /\b(rest|sit|help|spare|offer|water|catch (his|your) breath|let him|take (the|his) (oar|pole|rope)|ease|lighten)\b/i.test(t), want: true },
  contract: { test: contract, want: true },
  'numeral-leak': { test: (t) => /\b\d+\s*(\/\s*\d+|percent|%| out of)/i.test(t) || /\b(vigor|trust|stock)\b[^.\n]{0,12}\b\d+\b/i.test(t), want: false },
  'label-leak': { test: (t) => STAT_LABELS.some((l) => new RegExp(`\\*\\*${l}\\*\\*|\\b${l}:`).test(t)), want: false },
  'name-leak': { test: (t) => /\b(Bram|Odette)\b/.test(t), want: false },
};
const DIALOGUE = /["“][^"”]{3,}["”]/;

function request(arm: typeof ARMS[number], c: typeof fixture.cases[number]): { system: string; user: string; temperature?: number; max?: number } {
  const ctx = CTX[arm];
  if (c.kind === 'planning') {
    // The precall planner's own request: pinned temp 0.4 / rep-pen 1, the action framed as one instruction.
    return {
      system: renderPromptTemplate(defaultThinkingPrompt, ctx),
      user: `The player's next action: ${c.action}\n\nList the cast and lay out the beats now. Do not narrate.`,
      temperature: 0.4,
    };
  }
  if (c.kind === 'choices') {
    // The choice writer reads only who is in the scene, through the scene-roster override.
    const values = layerValues(ctx, sceneEntityChipValues(SCENES[arm], c.scene ?? []), { '<LANGUAGE>': '' });
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
        // Narration and choices are unpinned, so they send no temperature; the planner sends its pin.
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
  for (const arm of ARMS) {
    console.log(`\n--- ${arm}: Entities chip\n${CTX[arm]('<ENTITIES|markdown>')}`);
    console.log(`--- ${arm}: Entities summary chip\n${CTX[arm]('<ENTITIES|summary.markdown>')}`);
  }
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
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
