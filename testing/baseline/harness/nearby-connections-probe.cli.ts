// Nearby-through-Connections probe — what changes when Emberwatch's locations set `nearbyUsesConnections`?
// Ashford Square has no parent or siblings, so its tree-only reachable roster is empty; through its Connections it
// lists the keep, tavern and chapel cast. Corvin Vale stands in the square in both arms.
//
// Arms, paired by run index: `old` (every location's field removed: the shipped world) and `new` (the bundled
// file as it is). The default prompts are shared, so the reachable roster is the only difference.
//
// Checks:
//   uptake       — the output names the entity the action asks after, whom only the reachable roster names (up)
//   mention      — the output names any reachable entity at all (noise guard on the neutral case, down)
//   present-leak — the narration puts a reachable entity in the scene, acting or speaking (guard, down)
//   cast-leak    — the planner's Cast lists a reachable entity (guard, down)
//
// Usage: npx vite-node testing/baseline/harness/nearby-connections-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 8] [--max 600] [--only narr-lore,plan-pay] [--pool 4]
//          [--dump] [--show]
import { readFileSync } from 'node:fs';
import { defaultSystemPrompt, defaultThinkingPrompt } from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import { buildNarrationPrompt } from '@/lib/turnPipeline/narrationPrompt';
import { migrateWorld } from '@/lib/version';

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
const ARMS = ['old', 'new'] as const;
type Arm = typeof ARMS[number];
const SEED = 919191;
const SQUARE_ID = 'ceeed07b-7534-547a-9bb1-c80dfffb598b';

const bundled = migrateWorld(JSON.parse(readFileSync('src/defaultworlds/emberwatch.json', 'utf8')));
const worldOf = (arm: Arm) => (arm === 'new'
  ? bundled
  : { ...bundled, locations: bundled.locations.map(({ nearbyUsesConnections: _dropped, ...location }) => location) });

/** Each arm's chip lookup at the square, with the world's default traits and no persona. */
const ctxOf = (arm: Arm) => {
  const world = worldOf(arm);
  const location = world.locations.find((candidate) => candidate.id === SQUARE_ID);
  if (!location) throw new Error('Emberwatch lacks Ashford Square.');
  return chipValues(authoredChipScene(world, {
    location, activeTraitIds: world.traits.filter((trait) => trait.isDefault).map((trait) => trait.id),
  }));
};
const ctx = { old: ctxOf('old'), new: ctxOf('new') };
const REACHABLE = '<ENTITIES|reachable.summary.markdown>';
if (!ctx.new(REACHABLE)?.includes('Wenna Tallow')) throw new Error('The new arm\'s reachable roster lacks Wenna Tallow.');
if (ctx.old(REACHABLE)?.includes('Wenna Tallow')) throw new Error('The old arm\'s reachable roster lists Wenna Tallow.');

const CASES: Array<{ id: string; kind: 'narration' | 'planning'; action: string; target?: RegExp; checks: string[] }> = [
  { id: 'narr-lore', kind: 'narration', action: 'I ask Corvin who in town remembers the old stories about the barrow.', target: /\b(Wenna|Tallow)\b/, checks: ['uptake', 'present-leak'] },
  { id: 'narr-pay', kind: 'narration', action: 'I ask Corvin who is paying for work against the barrow.', target: /\b(Orrin|Blackwell)\b/, checks: ['uptake', 'present-leak'] },
  { id: 'narr-neutral', kind: 'narration', action: 'I draw a bucket from the well and drink.', checks: ['present-leak', 'mention'] },
  { id: 'plan-lore', kind: 'planning', action: 'I ask Corvin who in town remembers the old stories about the barrow.', target: /\b(Wenna|Tallow)\b/, checks: ['uptake', 'cast-leak'] },
  { id: 'plan-neutral', kind: 'planning', action: 'I draw a bucket from the well and drink.', checks: ['cast-leak'] },
];
type Case = typeof CASES[number];

// The cast the new arm adds at the square, by every name and alias the roster sends.
const added = bundled.entities.filter((entity) => ctx.new(REACHABLE)?.includes(`**${entity.name}**`) && !ctx.old(REACHABLE)?.includes(`**${entity.name}**`));
if (!added.length) throw new Error('The arms send the same reachable roster.');
const NEARBY = new RegExp(`\\b(${added.flatMap((entity) => [entity.name, ...(entity.aliases ?? [])]).join('|')})\\b`);
const ACTS = /\b(step|walk|arriv|enter|stand|stood|approach|appear|sit|sat|says?|said|nod|turn|smil|watch|call|speak|spoke|glanc|lean)\w*/i;
const castLines = (text: string) => {
  const at = text.search(/^Cast:/m);
  if (at < 0) return [];
  return text.slice(at).split('\n').slice(1).filter((line) => /^\s*-/.test(line));
};
const CHECKS: Record<string, { test: (text: string, c: Case) => boolean; want: boolean }> = {
  uptake: { test: (t, c) => !!c.target && c.target.test(t), want: true },
  mention: { test: (t) => NEARBY.test(t), want: false },
  // A reachable entity as the subject of a physical or spoken act within the same clause.
  'present-leak': { test: (t) => t.split(/[.!?\n]/).some((s) => NEARBY.test(s) && ACTS.test(s.slice(s.search(NEARBY)))), want: false },
  'cast-leak': { test: (t) => castLines(t).some((line) => NEARBY.test(line)), want: false },
};
const DIALOGUE = /["“][^"”]{3,}["”]/;

function request(arm: Arm, c: Case): { system: string; user: string; temperature?: number } {
  if (c.kind === 'planning') {
    // The precall planner's own request: pinned temp 0.4 / rep-pen 1, the action framed as one instruction.
    return {
      system: renderPromptTemplate(defaultThinkingPrompt, ctx[arm]),
      user: `The player's next action: ${c.action}\n\nList the cast and lay out the beats now. Do not narrate.`,
      temperature: 0.4,
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

const cases = CASES.filter((c) => !only || only.split(',').includes(c.id));
if (args.includes('--dump')) {
  for (const arm of ARMS) console.log(`--- ${arm} reachable roster\n${ctx[arm](REACHABLE)}`);
  console.log(`--- nearby names ${NEARBY}`);
  for (const c of cases) console.log(`\n=== ${c.id} (new)\n${JSON.stringify(request('new', c), null, 2).slice(0, 8000)}`);
  process.exit(0);
}

type Result = { arm: Arm; case: string; run: number; text: string };
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
      results.push({ arm, case: c.id, run, text });
      const hits = c.checks.map((check) => `${check}=${CHECKS[check].test(text, c) ? 1 : 0}`).join(' ');
      console.log(`[${arm}] ${c.id} #${run} ${hits} · ${text.split(/\s+/).length}w`);
      if (args.includes('--show')) console.log(`    ${text.replace(/\n+/g, ' ¶ ')}`);
    } catch (error) {
      console.log(`[${arm}] ${c.id} #${run} FAILED ${(error instanceof Error ? error.message : String(error)).slice(0, 160)}`);
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

console.log('\nTOTALS (↑/↓ = direction wanted; Δ = new − old, 95% CI)');
for (const c of cases) {
  const of = (arm: Arm) => results.filter((r) => r.case === c.id && r.arm === arm);
  for (const check of c.checks) {
    const test = (t: string) => CHECKS[check].test(t, c);
    const [b, a] = [rate(of('old'), test), rate(of('new'), test)];
    console.log(`${`${c.id} ${check}`.padEnd(28)} ${CHECKS[check].want ? '↑' : '↓'}  old ${b.k}/${b.n} · new ${a.k}/${a.n}  ${diffCi(b, a)}`);
  }
  const words = (arm: Arm) => { const xs = of(arm); return xs.length ? (xs.reduce((s, r) => s + r.text.split(/\s+/).length, 0) / xs.length).toFixed(0) : '-'; };
  const [db, da] = [rate(of('old'), (t) => DIALOGUE.test(t)), rate(of('new'), (t) => DIALOGUE.test(t))];
  console.log(`${`${c.id} words / dialogue`.padEnd(28)}    old ${words('old')}w ${db.k}/${db.n} · new ${words('new')}w ${da.k}/${da.n}`);
}
console.log(`duration ${((Date.now() - started) / 1000).toFixed(0)}s`);
