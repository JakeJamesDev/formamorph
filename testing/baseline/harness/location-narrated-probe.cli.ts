// Narrated-move probe: after the narration, does the location request find a move the story made?
//   carried  the narration takes the player into a reachable place the action never asked for (../location-narrated-cases.json)
//   stay     the narration only looks toward a place, talks about it, or moves someone else
//   control  the location router's cases (../location-router-cases.json), every set and world: action only, known answers
//   unlisted the narration carries the player to a place more than one move away (`goes`), so off the list
//
// Three arms, all built by the real locationSuggest pass record over each scene's chip values:
//   reused   the shipped location-change prompts, as Suggest mode sends them after the narration
//   before   the narrated-move prompts before the Elsewhere answer (multi-hop-moves 01), frozen below
//   narrated defaultNarratedMovePrompt / defaultNarratedMoveUserPrompt
// Every run dispatches all cases on every arm together, so batch drift lands on every arm.
//
// The bar (multi-hop-moves Q10, ticket 01) is on the narrated arm's set totals: unlisted moved <= 10%, carried
// moves found >= 90%, stay moved <= the before arm's, control right >= the before arm's. A move to another
// place than the scene names counts as a miss. Per-scene counts are reported beside it.
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
interface Scene {
  set: 'carried' | 'stay' | 'control' | 'unlisted';
  id: string; world: string; at: string; action: string; narration: string; expect: string;
  /** An unlisted scene's real destination. */
  goes?: string;
}
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

const BEFORE_NARRATED_MOVE = `You keep track of where the player character is in an interactive story. You read one turn, the player character's action and the narration that followed, and you name the place where the player character's own body is when the narration ends. You never act in the story; "I" in the action and "you" in the narration are the player character.
<LOCATION|summary.markdown|header="Current Location">\
<LOCATION|destinations.summary.markdown|header="Where The Player Can Go">
Follow only the player character's body through the narration. The answer is a place from the list when the body ends up in it, by walking, by being carried, dragged, led or pushed, or by the scene opening there. The narration often describes a place instead of naming it: match it to the place whose description fits. The answer is the current location when the body ends the narration where it started; a place the player character sees, names, talks about or plans to visit, and a place other characters come from or go to, leave the body where it stands. Reply with only the exact name of one place: the current location or a place from the list.`;
const BEFORE_NARRATED_MOVE_USER = `The player character's action this turn ("I" = the player character): <PLAYER ACTION>
<NARRATION|format=markdown|header="The Narration That Followed">
Reply with only the name of the place where the player character's body is when this narration ends.`;

const ARMS = {
  reused: testInput({ prompts: { ...TEST_PROMPTS, narratedMove: defaultLocationChangePrompt, narratedMoveUser: defaultLocationChangeUserPrompt } }, { thinkingMode: 'off' }),
  before: testInput({ prompts: { ...TEST_PROMPTS, narratedMove: BEFORE_NARRATED_MOVE, narratedMoveUser: BEFORE_NARRATED_MOVE_USER } }, { thinkingMode: 'off' }),
  narrated: testInput({ prompts: { ...TEST_PROMPTS, narratedMove: defaultNarratedMovePrompt, narratedMoveUser: defaultNarratedMoveUserPrompt } }, { thinkingMode: 'off' }),
};
type Arm = keyof typeof ARMS;
const pass = TURN_PASSES.find((p) => p.id === 'locationSuggest');
if (!pass) throw new Error('no locationSuggest pass');

type BuiltWorld = ReturnType<typeof migrateWorld>;
/** The fewest moves from `from` to the place named `name`, or null when no chain of moves reaches it. */
function movesTo(world: BuiltWorld, from: GameLocation, name: string): number | null {
  const seen = new Set([from.id]);
  for (let frontier = [from], hops = 1; frontier.length; hops++) {
    const next: GameLocation[] = [];
    for (const place of frontier) {
      for (const to of navigableDestinations(place, world.locations, world.connections ?? [])) {
        if (seen.has(to.id)) continue;
        if (to.name === name) return hops;
        seen.add(to.id);
        next.push(to);
      }
    }
    frontier = next;
  }
  return null;
}
const hopsOf = new Map<string, number>();

const materialOf = (scene: Scene) => {
  const world = built[scene.world];
  const location = world.locations.find((l: GameLocation) => l.name === scene.at);
  if (!location) throw new Error(`${scene.world} has no ${scene.at}`);
  const ctx = chipValues(authoredChipScene(world, { location, resolve: (text) => text }));
  const destinations = navigableDestinations(location, world.locations, world.connections ?? []).map((l) => l.name);
  if (scene.expect !== 'NONE' && !destinations.includes(scene.expect)) throw new Error(`${scene.id}: ${scene.expect} is not reachable`);
  if (scene.set === 'unlisted') {
    const exists = world.locations.some((l: GameLocation) => l.name === scene.goes);
    if (scene.expect !== 'NONE' || !exists || destinations.includes(scene.goes ?? '')) {
      throw new Error(`${scene.id}: ${scene.goes} must exist off the list, with expect NONE`);
    }
    // An unreachable place counts as beyond any hop cap.
    hopsOf.set(scene.id, movesTo(world, location, scene.goes ?? '') ?? Infinity);
  }
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
const ARM_IDS = Object.keys(ARMS) as Arm[];
const perScene = new Map<string, Record<Arm, ReturnType<typeof cell>>>();
const misses: string[] = [];
console.log(`model ${model} · runs ${runs} · scenes ${scenes.length} · arms ${ARM_IDS.join(', ')}`);
const begun = Date.now();

for (let run = 0; run < runs; run++) {
  const jobs = scenes.flatMap((scene) => ARM_IDS.map((arm) => async () => ({ scene, arm, ...await send(arm, scene) })));
  for (const { scene, arm, raw, got } of await pool(jobs, poolSize)) {
    const row = perScene.get(scene.id) ?? { reused: cell(), before: cell(), narrated: cell() };
    perScene.set(scene.id, row);
    const c = row[arm];
    c.n++;
    if (got !== 'NONE') c.moved++;
    if (got === scene.expect) c.right++;
    else misses.push(`${arm.padEnd(8)} ${scene.set.padEnd(8)} ${scene.id} #${run + 1}: want ${scene.expect}, got ${got} :: ${JSON.stringify(raw)}`);
  }
  process.stdout.write(`run ${run + 1}/${runs} · ${Math.round((Date.now() - begun) / 1000)}s\n`);
}

const pct = (a: number, n: number) => `${Math.round((1000 * a) / Math.max(1, n)) / 10}%`;
// What each set counts: stay and unlisted scenes score their moves, the others their right answers.
const METRIC = {
  carried: { label: 'moves found', of: (c: ReturnType<typeof cell>) => c.right },
  stay: { label: 'false moves', of: (c: ReturnType<typeof cell>) => c.moved },
  unlisted: { label: 'moved', of: (c: ReturnType<typeof cell>) => c.moved },
  control: { label: 'right', of: (c: ReturnType<typeof cell>) => c.right },
} as const;
const totals = (set: Scene['set'], arm: Arm) => scenes.filter((s) => s.set === set).reduce((t, s) => {
  const c = perScene.get(s.id)![arm];
  return { n: t.n + c.n, right: t.right + c.right, moved: t.moved + c.moved };
}, cell());

for (const set of ['carried', 'stay', 'unlisted', 'control'] as const) {
  const inSet = scenes.filter((s) => s.set === set);
  if (!inSet.length) continue;
  const metric = METRIC[set];
  console.log(`\n${set} (${metric.label}, per scene)`.padEnd(37) + ARM_IDS.map((arm) => arm.padStart(16)).join(''));
  for (const s of inSet) {
    const row = perScene.get(s.id)!;
    const count = hopsOf.get(s.id);
    const hops = count === undefined ? '' : count === Infinity ? ' (unreachable)' : ` (${count} moves)`;
    console.log(`  ${(s.id + hops).padEnd(34)}${ARM_IDS.map((arm) => `${metric.of(row[arm])}/${row[arm].n}`.padStart(16)).join('')}`);
  }
  const setTotal = (arm: Arm) => {
    const t = totals(set, arm);
    return `${metric.of(t)}/${t.n} (${pct(metric.of(t), t.n)})`.padStart(16);
  };
  console.log(`  ${'TOTAL'.padEnd(34)}${ARM_IDS.map(setTotal).join('')}`);
}

const rate = (set: Scene['set'], arm: Arm, of: 'right' | 'moved') => {
  const t = totals(set, arm);
  return t.n ? t[of] / t.n : NaN;
};

// Unlisted totals split at 3 moves: the scenes beyond it stay off a list that reaches 3 moves.
const unlistedBy = (far: boolean, arm: Arm) => scenes
  .filter((s) => s.set === 'unlisted' && ((hopsOf.get(s.id) ?? 0) > 3) === far)
  .reduce((t, s) => ({ n: t.n + perScene.get(s.id)![arm].n, moved: t.moved + perScene.get(s.id)![arm].moved }), { n: 0, moved: 0 });
for (const far of [true, false]) {
  const label = far ? 'unlisted beyond 3 moves' : 'unlisted 2-3 moves';
  console.log(`  ${label.padEnd(34)}${ARM_IDS.map((arm) => {
    const t = unlistedBy(far, arm);
    return `${t.moved}/${t.n} (${pct(t.moved, t.n)})`.padStart(16);
  }).join('')}`);
}
console.log('\nbar (Q10, ticket 01), narrated arm: unlisted moved <= 10%, carried >= 90%, stay <= before, control >= before');
const checks = [
  ['unlisted moved', rate('unlisted', 'narrated', 'moved'), rate('unlisted', 'narrated', 'moved') <= 0.1],
  ['carried found', rate('carried', 'narrated', 'right'), rate('carried', 'narrated', 'right') >= 0.9],
  ['stay moved', rate('stay', 'narrated', 'moved'), rate('stay', 'narrated', 'moved') <= rate('stay', 'before', 'moved')],
  ['control right', rate('control', 'narrated', 'right'), rate('control', 'narrated', 'right') >= rate('control', 'before', 'right')],
] as const;
for (const [label, value, ok] of checks) console.log(`  ${label.padEnd(16)} ${pct(value, 1).padStart(7)} · ${ok ? 'MEETS' : 'MISSES'}`);
if (misses.length) console.log(`\nmisses:\n  ${misses.join('\n  ')}`);
console.log(`\nwall ${Math.round((Date.now() - begun) / 1000)}s`);
