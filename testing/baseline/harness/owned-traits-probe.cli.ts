// Owned traits probe — do an NPC's owned traits and the played entity's owned traits reach the story once
// the chips carry them? Sedge Landing, with a limp owned by the ferryman, a work song owned by the
// eel-smoker, and a red scarf owned by a world persona the player plays.
//
// Arms, paired by run index: `before` (the scene with no owned traits in force, byte-identical to the chips
// before owned traits existed) and `after` (the same scene with them in force). Every other byte is shared.
// Narration cases read the full Entities chip; planning cases read the summary chip's one line of names.
//
// Checks:
//   limp / sing / scarf  — the trait shows in the output (uptake, wanted up in `after`)
//   name-leak            — narration names Bram or Odette, who have not given their names (guard, down)
//   label-leak           — the output repeats a trait block label or bolded trait name (guard, down)
// Also reported per arm: mean words and the share of outputs with quoted dialogue (regression check).
//
// Usage: npx vite-node testing/baseline/harness/owned-traits-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 12] [--max 600] [--only narr-bram,plan-odette] [--pool 4]
//          [--dump] [--show]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defaultSystemPrompt, defaultThinkingPrompt } from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { migrateWorld } from '@/lib/version';
import type { Entity, Trait } from '@/types';

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
const ARMS = ['before', 'after'] as const;
const SEED = 515151;

const BASELINE = path.resolve('testing/baseline');
const base = migrateWorld(JSON.parse(readFileSync(path.join(BASELINE, 'sedge-landing.json'), 'utf8')));
const fixture = JSON.parse(readFileSync(path.join(BASELINE, 'owned-traits-cases.json'), 'utf8')) as {
  owned: Record<string, Trait[]>;
  persona: Entity;
  cases: Array<{ id: string; kind: 'narration' | 'planning'; action: string; checks: string[] }>;
};

// `--unnamed` drops the owner's name that opens each owned trait text ("Odette sings" → "Sings"), to tell a
// name leak the trait text causes from one the traits block causes.
if (args.includes('--unnamed')) {
  const unnamed = (owner: string, traits: Trait[]) => traits.map((t) => ({
    ...t, aiDescription: t.aiDescription?.replace(new RegExp(`^${owner} (\\w)`), (_m, c: string) => c.toUpperCase()),
  }));
  for (const [id, traits] of Object.entries(fixture.owned)) {
    fixture.owned[id] = unnamed(base.entities.find((e) => e.id === id)?.name ?? '', traits);
  }
  fixture.persona.traits = unnamed(fixture.persona.name, fixture.persona.traits ?? []);
}
const world = { ...base, entities: base.entities.map((e) => (fixture.owned[e.id] ? { ...e, traits: fixture.owned[e.id] } : e)) };
const inForce: Record<string, string[]> = Object.fromEntries([
  ...Object.entries(fixture.owned).map(([id, traits]) => [id, traits.map((t) => t.id)]),
  [fixture.persona.id, (fixture.persona.traits ?? []).map((t) => t.id)],
]);

const location = world.locations.find((candidate) => candidate.id === 'loc-sedge');
if (!location) throw new Error('Sedge Landing fixture is missing loc-sedge.');
const sceneBase = authoredChipScene(world, {
  location,
  activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  resolve: (text: string) => text,
});
const ctxFor = (arm: typeof ARMS[number]) => chipValues({
  ...sceneBase,
  persona: { source: 'world', entity: fixture.persona },
  ownedTraits: arm === 'after' ? inForce : {},
});
const CTX = { before: ctxFor('before'), after: ctxFor('after') };

const TRAIT_NAMES = [...Object.values(fixture.owned).flat(), ...(fixture.persona.traits ?? [])].map((t) => t.name);
const CHECKS: Record<string, { test: (text: string) => boolean; want: boolean }> = {
  limp: {
    test: (t) => /\b(limp\w*|hobbl\w*|lame|(bad|stiff|good|weak|ruined|lame|healed|injured|aching) (knee|leg)|favou?r\w* (his|one|the|a) (leg|knee)|weight (from|off|onto) (one|his|the|a) (leg|knee|foot)|uneven (gait|steps?|stride))\b/i.test(t),
    want: true,
  },
  sing: { test: (t) => /\b(sing\w*|sang|songs?|croon\w*|hum|hums|humm\w*|melod\w*|tune\w*)\b/i.test(t), want: true },
  scarf: { test: (t) => /\bscarf\b/i.test(t), want: true },
  'name-leak': { test: (t) => /\b(Bram|Odette)\b/.test(t), want: false },
  'label-leak': {
    test: (t) => /\btraits:/i.test(t) || TRAIT_NAMES.some((n) => t.includes(`**${n}**`) || t.includes(`${n}:`) || (n.includes(' ') && t.includes(n))),
    want: false,
  },
};
const DIALOGUE = /["“][^"”]{3,}["”]/;

function request(arm: typeof ARMS[number], c: typeof fixture.cases[number]): { system: string; user: string; temperature?: number } {
  const ctx = CTX[arm];
  if (c.kind === 'planning') {
    // The precall planner's own request: pinned temp 0.4 / rep-pen 1, the action framed as one instruction.
    return {
      system: renderPromptTemplate(defaultThinkingPrompt, ctx),
      user: `The player's next action: ${c.action}\n\nList the cast and lay out the beats now. Do not narrate.`,
      temperature: 0.4,
    };
  }
  const system = buildNarrationPrompt({
    template: defaultSystemPrompt, ctx, action: c.action, history: [], dictionary: [],
    actionVec: null, semanticLore: false, embedVectors: new Map(),
    language: 'English', paragraphLimit: 'single', maxTokens: 1024, markdownOutput: false,
    sectionStyle: 'markdown', resolvePH: (text) => text,
  }).prompt;
  return { system, user: c.action };
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
        model, seed, max_tokens: maxTokens, reasoning_effort: 'none', stream: false,
        // Narration is unpinned, so it sends no temperature; the planner sends its pin.
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
    console.log(`\n--- ${arm}: Traits chip\n${CTX[arm]['<TRAITS DESCRIPTION|markdown>']}`);
    console.log(`--- ${arm}: Entities chip\n${CTX[arm]['<ENTITIES|markdown>']}`);
    console.log(`--- ${arm}: Entities summary chip\n${CTX[arm]['<ENTITIES|summary.markdown>']}`);
  }
  process.exit(0);
}

type Result = { arm: typeof ARMS[number]; case: string; run: number; text: string };
const results: Result[] = [];
const started = Date.now();
const rescore = argVal('--rescore', '');
if (rescore) {
  // Score the outputs of an earlier `--show` log again, so a scorer fix needs no new samples.
  const lines = readFileSync(rescore, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/^\[(before|after)\] (\S+) #(\d+) (?!FAILED)/);
    if (m && lines[i + 1]?.startsWith('    ')) {
      results.push({ arm: m[1] as Result['arm'], case: m[2], run: Number(m[3]), text: lines[i + 1].slice(4).replace(/ ¶ /g, '\n') });
    }
  });
  console.log(`rescored ${results.length} outputs from ${rescore}`);
}

const model = rescore ? '' : await loadedModel();
if (!rescore) console.log(`model ${model} · runs ${runs} per arm per case · pool ${pool}`);
// Arms interleave run by run, so drift during the batch lands on both.
const jobs = rescore ? [] : cases.flatMap((c) => Array.from({ length: runs }, (_, run) => ARMS.map((arm) => ({ arm, c, run })))).flat();
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

console.log('\nTOTALS (↑/↓ = direction wanted; Δ = after − before, 95% CI)');
for (const c of cases) {
  const of = (arm: string) => results.filter((r) => r.case === c.id && r.arm === arm);
  for (const check of c.checks) {
    const [b, a] = [rate(of('before'), CHECKS[check].test), rate(of('after'), CHECKS[check].test)];
    console.log(`${`${c.id} ${check}`.padEnd(24)} ${CHECKS[check].want ? '↑' : '↓'}  before ${b.k}/${b.n} · after ${a.k}/${a.n}  ${diffCi(b, a)}`);
  }
  const words = (arm: string) => { const xs = of(arm); return xs.length ? (xs.reduce((s, r) => s + r.text.split(/\s+/).length, 0) / xs.length).toFixed(0) : '-'; };
  const [db, da] = [rate(of('before'), (t) => DIALOGUE.test(t)), rate(of('after'), (t) => DIALOGUE.test(t))];
  console.log(`${`${c.id} words / dialogue`.padEnd(24)}    before ${words('before')}w ${db.k}/${db.n} · after ${words('after')}w ${da.k}/${da.n}`);
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
