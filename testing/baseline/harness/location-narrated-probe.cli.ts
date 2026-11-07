// Narrated-move probe: after the narration, does the location request find a move the story made?
//   carried  the narration takes the player into a reachable place the action never asked for (../location-narrated-cases.json)
//   stay     the narration only looks toward a place, talks about it, or moves someone else
//   control  the location router's cases (../location-router-cases.json), every set and world: action only, known answers
//
// Two arms, both built by the real locationSuggest pass record over each scene's chip values:
//   reused   the shipped location-change prompts, as Suggest mode sends them after the narration
//   narrated defaultNarratedMovePrompt / defaultNarratedMoveUserPrompt
// Every run dispatches all cases on both arms together, so batch drift lands on every arm.
//
// The bar (spec Q8) is on the set totals: carried moved >= 90%, stay moved <= 10%. A move to another place than
// the scene names counts as a miss. Per-scene counts are reported beside it.
//
// Usage: npx vite-node testing/baseline/harness/location-narrated-probe.cli.ts --
//          [--endpoint URL] [--model ID] [--runs 10] [--only carried-up,plan] [--dump <scene id>]
//          [--cases <path>] [--pool 8]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  defaultLocationChangePrompt, defaultLocationChangeUserPrompt, defaultNarratedMovePrompt, defaultNarratedMoveUserPrompt,
} from '@/components/game/GamePrompts';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { navigableDestinations } from '@/lib/locationContext';
import { PROMPT_SAMPLER_PINS } from '@/lib/promptSamplers';
import { TURN_PASSES } from '@/lib/turnPipeline/turnPasses';
import { emptyTurnMaterial } from '@/lib/turnPipeline/turnPlan';
import { testInput, TEST_PROMPTS } from '@/lib/turnPipeline/turnTestInputs';
import { migrateWorld } from '@/lib/version';
import type { GameLocation } from '@/types';

const args = process.argv.slice(2);
const argVal = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const endpoint = argVal('--endpoint', 'https://api.lyonade.net/v1/chat/completions');
const model = argVal('--model', 'default');
const runs = Number(argVal('--runs', '10'));
const only = argVal('--only', '');
const dump = argVal('--dump', '');
const poolSize = Number(argVal('--pool', '8'));

interface PlaceSpec { name: string; parent: string | null; summary: string }
interface Scene { set: 'carried' | 'stay' | 'control'; id: string; world: string; at: string; action: string; narration: string; expect: string }
const casesPath = argVal('--cases', 'testing/baseline/location-narrated-cases.json');
const narrated = JSON.parse(readFileSync(path.resolve(casesPath), 'utf8')) as {
  worlds: Record<string, PlaceSpec[]>;
  scenes: Scene[];
};
interface RouterPlaces { current: { name: string; description: string }; destinations: { name: string; description: string }[] }
const router = JSON.parse(readFileSync(path.resolve('testing/baseline/location-router-cases.json'), 'utf8')) as RouterPlaces & {
  worlds?: Record<string, RouterPlaces>;
  cases: { name: string; narration: string; expect: string; world?: string }[];
};

// The router cases' `narration` field holds the player's action. A case without `world` uses the top-level places.
// Each router place list becomes a world: the destinations sit beside the current place under one region.
const routerKey = (world?: string) => (world ? `router:${world}` : 'router');
const routerPlaces: Record<string, RouterPlaces> = {
  [routerKey()]: router,
  ...Object.fromEntries(Object.entries(router.worlds ?? {}).map(([key, places]) => [routerKey(key), places])),
};
const worlds: Record<string, PlaceSpec[]> = {
  ...narrated.worlds,
  ...Object.fromEntries(Object.entries(routerPlaces).map(([key, places]) => [key, [
    { name: 'The Region', parent: null, summary: 'The surrounding region.' },
    { name: places.current.name, parent: 'The Region', summary: places.current.description },
    ...places.destinations.map((d) => ({ name: d.name, parent: 'The Region', summary: d.description })),
  ]])),
};
const controls: Scene[] = router.cases.map((c) => ({
  set: 'control', id: c.name, world: routerKey(c.world), at: routerPlaces[routerKey(c.world)].current.name,
  action: c.narration, narration: '', expect: c.expect,
}));
const scenes = [...controls, ...narrated.scenes].filter((s) => !only || only.split(',').includes(s.id));

const idOf = (world: string, name: string) => `${world}:${name}`;
const built = Object.fromEntries(Object.entries(worlds).map(([key, places]) => {
  const locations: GameLocation[] = places.map((p) => ({
    id: idOf(key, p.name),
    name: p.name,
    aiDescription: p.summary,
    aiSummary: p.summary,
    parentId: p.parent === null ? null : idOf(key, p.parent),
  }));
  const world = migrateWorld({
    worldOverview: { name: key, description: '' }, locations, connections: [], entities: [], stats: [], traits: [],
  });
  return [key, world];
})) as Record<string, ReturnType<typeof migrateWorld>>;

const ARMS = {
  reused: testInput({ prompts: { ...TEST_PROMPTS, narratedMove: defaultLocationChangePrompt, narratedMoveUser: defaultLocationChangeUserPrompt } }, { thinkingMode: 'off' }),
  narrated: testInput({ prompts: { ...TEST_PROMPTS, narratedMove: defaultNarratedMovePrompt, narratedMoveUser: defaultNarratedMoveUserPrompt } }, { thinkingMode: 'off' }),
};
type Arm = keyof typeof ARMS;
const pass = TURN_PASSES.find((p) => p.id === 'locationSuggest');
if (!pass) throw new Error('no locationSuggest pass');

const materialOf = (scene: Scene) => {
  const world = built[scene.world];
  const location = world.locations.find((l: GameLocation) => l.name === scene.at);
  if (!location) throw new Error(`${scene.world} has no ${scene.at}`);
  const ctx = chipValues(authoredChipScene(world, { location, resolve: (text) => text }));
  const destinations = navigableDestinations(location, world.locations, world.connections ?? []).map((l) => l.name);
  if (scene.expect !== 'NONE' && !destinations.includes(scene.expect)) throw new Error(`${scene.id}: ${scene.expect} is not reachable`);
  return {
    ...emptyTurnMaterial({ action: scene.action, effectiveAction: scene.action, turnId: 'probe', baseCtx: ctx, destinations }),
    ctx,
    narration: scene.narration,
  };
};
const materials = new Map(scenes.map((s) => [s.id, materialOf(s)]));

if (dump) {
  const scene = scenes.find((s) => s.id === dump) ?? narrated.scenes.find((s) => s.id === dump);
  if (!scene) throw new Error(`no scene ${dump}`);
  for (const arm of Object.keys(ARMS) as Arm[]) {
    const request = pass.buildRequest(ARMS[arm], materials.get(scene.id) ?? materialOf(scene));
    console.log(`=== ${arm}\n--- system\n${request.systemPrompt}\n--- user\n${request.messages.map((m) => m.content).join('\n')}\n--- cap ${request.maxTokens}\n`);
  }
  process.exit(0);
}

async function send(arm: Arm, scene: Scene) {
  const material = materials.get(scene.id)!;
  const request = pass!.buildRequest(ARMS[arm], material);
  const temperature = PROMPT_SAMPLER_PINS[request.type]?.temperature;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: request.maxTokens, temperature, reasoning_effort: 'none', stream: false,
        messages: [{ role: 'system', content: request.systemPrompt }, ...request.messages],
      }),
    });
    if (res.ok) {
      const body = await res.json() as { choices: Array<{ message: { content: string | null } }> };
      const raw = body.choices[0].message.content ?? '';
      const place = pass!.parseResponse(raw, material);
      return { raw, got: typeof place === 'string' ? place : 'NONE' };
    }
    if (attempt >= 3) throw new Error(`${res.status} ${await res.text()}`);
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
}

/** Runs `jobs` with at most `limit` in flight. */
async function pool<T>(jobs: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const out: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    while (next < jobs.length) {
      const i = next++;
      out[i] = await jobs[i]();
    }
  }));
  return out;
}

// moved = the player ends somewhere other than where they stood. right = the reply is the scene's answer.
const cell = () => ({ n: 0, right: 0, moved: 0 });
const perScene = new Map<string, Record<Arm, ReturnType<typeof cell>>>();
const misses: string[] = [];
console.log(`model ${model} · runs ${runs} · scenes ${scenes.length} · arms ${Object.keys(ARMS).join(', ')}`);
const begun = Date.now();

for (let run = 0; run < runs; run++) {
  const jobs = scenes.flatMap((scene) => (Object.keys(ARMS) as Arm[]).map((arm) => async () => ({ scene, arm, ...await send(arm, scene) })));
  for (const { scene, arm, raw, got } of await pool(jobs, poolSize)) {
    const row = perScene.get(scene.id) ?? { reused: cell(), narrated: cell() };
    perScene.set(scene.id, row);
    const c = row[arm];
    c.n++;
    if (got !== 'NONE') c.moved++;
    if (got === scene.expect) c.right++;
    else misses.push(`${arm.padEnd(8)} ${scene.set.padEnd(7)} ${scene.id} #${run + 1}: want ${scene.expect}, got ${got} :: ${JSON.stringify(raw)}`);
  }
  process.stdout.write(`run ${run + 1}/${runs} · ${Math.round((Date.now() - begun) / 1000)}s\n`);
}

const pct = (a: number, n: number) => `${Math.round((1000 * a) / Math.max(1, n)) / 10}%`;
// What each set counts: a stay scene scores its moves, the others their right answers.
const METRIC = {
  carried: { label: 'moves found', of: (c: ReturnType<typeof cell>) => c.right },
  stay: { label: 'false moves', of: (c: ReturnType<typeof cell>) => c.moved },
  control: { label: 'right', of: (c: ReturnType<typeof cell>) => c.right },
} as const;
const totals = (set: Scene['set'], arm: Arm) => scenes.filter((s) => s.set === set).reduce((t, s) => {
  const c = perScene.get(s.id)![arm];
  return { n: t.n + c.n, right: t.right + c.right, moved: t.moved + c.moved };
}, cell());

for (const set of ['carried', 'stay', 'control'] as const) {
  const inSet = scenes.filter((s) => s.set === set);
  if (!inSet.length) continue;
  const metric = METRIC[set];
  console.log(`\n${set} (${metric.label}, per scene)          reused    narrated`);
  for (const s of inSet) {
    const row = perScene.get(s.id)!;
    const sceneCount = (arm: Arm) => `${metric.of(row[arm])}/${row[arm].n}`.padStart(8);
    console.log(`  ${s.id.padEnd(30)} ${sceneCount('reused')}  ${sceneCount('narrated')}`);
  }
  const setTotal = (arm: Arm) => {
    const t = totals(set, arm);
    return `${metric.of(t)}/${t.n} (${pct(metric.of(t), t.n)})`.padStart(16);
  };
  console.log(`  ${'TOTAL'.padEnd(24)} ${setTotal('reused')}  ${setTotal('narrated')}`);
}

console.log('\nbar (Q8): carried moves found >= 90%, stay false moves <= 10%');
for (const arm of Object.keys(ARMS) as Arm[]) {
  const carried = totals('carried', arm);
  const stay = totals('stay', arm);
  const ok = carried.n > 0 && stay.n > 0 && carried.right / carried.n >= 0.9 && stay.moved / stay.n <= 0.1;
  console.log(`  ${arm.padEnd(8)} carried ${pct(carried.right, carried.n)} · stay ${pct(stay.moved, stay.n)} · ${ok ? 'MEETS' : 'MISSES'}`);
}
if (misses.length) console.log(`\nmisses:\n  ${misses.join('\n  ')}`);
console.log(`\nwall ${Math.round((Date.now() - begun) / 1000)}s`);
